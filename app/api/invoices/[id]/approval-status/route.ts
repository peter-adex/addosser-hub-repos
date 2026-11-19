import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasGranularPermission("invoice", "invoices", "view");
  if (!canView)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = session.user as any;

  const instance = await prisma.approvalInstance.findFirst({
    where: {
      resourceId: params.id,
      resourceType: "Invoice",
    },
    include: {
      steps: {
        include: { actionedBy: { select: { name: true, email: true } } },
        orderBy: { stepNumber: "asc" },
      },
      workflow: { select: { name: true, module: true } },
    },
  });

  const myPendingStep =
    instance?.steps.find(
      (s) =>
        s.status === "PENDING" &&
        (s.userId ? s.userId === user.id : s.roleId === user.roleId),
    ) ?? null;

  return NextResponse.json({
    success: true,
    data: { instance, myPendingStep },
  });
}
