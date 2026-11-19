import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const movement = await prisma.assetMovement.findUnique({
    where: { id: params.id },
    include: {
      asset: {
        select: {
          id: true, assetNo: true, name: true, description: true, status: true,
          classification: { select: { name: true, code: true } },
          purchaseDate: true, acquisitionValue: true,
        },
      },
      fromEntity:  { select: { id: true, name: true, code: true } },
      toEntity:    { select: { id: true, name: true, code: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!movement) return NextResponse.json({ error: "Movement request not found" }, { status: 404 });

  const [fromBranch, toBranch] = await Promise.all([
    movement.fromBranchId ? prisma.branch.findUnique({ where: { id: movement.fromBranchId }, select: { name: true } }) : null,
    movement.toBranchId   ? prisma.branch.findUnique({ where: { id: movement.toBranchId },   select: { name: true } }) : null,
  ]);

  const instance = movement.approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: movement.approvalInstanceId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: {
              actionedBy:   { select: { name: true, email: true } },
              assignedUser: { select: { name: true, email: true } },
            },
          },
          workflow: { select: { name: true } },
        },
      })
    : null;

  const audit = await prisma.auditLog.findMany({
    where:   { resourceId: movement.id, resourceType: "AssetMovement" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    success: true,
    data: { movement, fromBranch, toBranch, approvalInstance: instance, audit },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const movement = await prisma.assetMovement.findUnique({ where: { id: params.id } });
  if (!movement) return NextResponse.json({ error: "Movement request not found" }, { status: 404 });

  if (movement.requestedById !== userId && !(session.user as any).isSystem) {
    return NextResponse.json({ error: "Only the requester can cancel this request" }, { status: 403 });
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(movement.requestStatus ?? "")) {
    return NextResponse.json({
      error: `Cannot cancel a request that is already ${movement.requestStatus?.toLowerCase().replace("_", " ")}`,
    }, { status: 409 });
  }

  const updated = await prisma.assetMovement.update({
    where: { id: params.id },
    data:  { requestStatus: "CANCELLED" },
  });

  if (movement.approvalInstanceId) {
    await prisma.approvalInstance.updateMany({
      where: { id: movement.approvalInstanceId, status: "IN_PROGRESS" },
      data:  { status: "CANCELLED", completedAt: new Date() },
    });
  }

  await logAudit({
    userId,
    action:       "ASSET_MOVEMENT_REQUEST_CANCELLED",
    module:       "assets",
    entityId:     movement.fromEntityId ?? undefined,
    resourceId:   movement.id,
    resourceType: "AssetMovement",
  });

  return NextResponse.json({ success: true, data: updated });
}
