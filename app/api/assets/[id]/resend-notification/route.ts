import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resendCurrentStepNotification } from "@/lib/approval-workflow";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (asset.createdById !== user.id && !user.isSystem) {
    return NextResponse.json(
      { error: "Only the requisitioner or a Super Admin can resend this notification" },
      { status: 403 },
    );
  }

  if (asset.approvalStatus !== "IN_APPROVAL") {
    return NextResponse.json(
      { error: "This asset is not currently awaiting approval." },
      { status: 409 },
    );
  }

  const result = await resendCurrentStepNotification(asset.id, "Asset");
  if (!result) {
    return NextResponse.json(
      { error: "There is no pending approval step to resend a notification for." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    message: `Reminder sent for Step ${result.stepNumber} of ${result.totalSteps}.`,
  });
}
