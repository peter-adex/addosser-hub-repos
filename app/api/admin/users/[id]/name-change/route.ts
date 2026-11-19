import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const caller = session?.user as any;
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!caller.isSystem && caller.roleName !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, pendingName: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!target.pendingName) {
    return NextResponse.json({ error: "This user has no pending name change" }, { status: 409 });
  }

  const requestedName = target.pendingName;

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: action === "approve" ? requestedName : target.name,
      pendingName: null,
      pendingNameRequestedAt: null,
    },
    select: { id: true, name: true },
  });

  await prisma.notification.create({
    data: {
      userId: target.id,
      type: action === "approve" ? "SUCCESS" : "WARNING",
      title: action === "approve" ? "Name Change Approved" : "Name Change Rejected",
      message:
        action === "approve"
          ? `Your name change to "${requestedName}" has been approved and is now active.`
          : `Your request to change your name to "${requestedName}" was not approved. Your name remains "${target.name}".`,
      actionUrl: "/profile",
    },
  });

  await logAudit({
    userId: caller.id,
    action: action === "approve" ? "NAME_CHANGE_APPROVED" : "NAME_CHANGE_REJECTED",
    module: "admin",
    resourceType: "User",
    resourceId: target.id,
    afterData: JSON.stringify({ requestedName, previousName: target.name }),
  });

  return NextResponse.json({ success: true, data: updated });
}
