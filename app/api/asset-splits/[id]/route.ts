import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const split = await prisma.assetSplit.findUnique({
    where: { id: params.id },
    include: {
      parentAsset: {
        select: {
          id: true, assetNo: true, name: true, description: true, status: true,
          classification: { select: { name: true, code: true } },
          entity: { select: { name: true, code: true } },
          branch: { select: { name: true } },
        },
      },
      requestedBy: { select: { id: true, name: true, email: true } },
      children:    { select: { id: true, assetNo: true, name: true, serialNo: true, barcodeTag: true, assignedTo: { select: { name: true } } } },
    },
  });
  if (!split) return NextResponse.json({ error: "Split request not found" }, { status: 404 });

  const instance = split.approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: split.approvalInstanceId },
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
    where:   { resourceId: split.id, resourceType: "AssetSplit" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ success: true, data: { split, approvalInstance: instance, audit } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const split = await prisma.assetSplit.findUnique({ where: { id: params.id } });
  if (!split) return NextResponse.json({ error: "Split request not found" }, { status: 404 });

  if (split.requestedById !== userId && !(session.user as any).isSystem) {
    return NextResponse.json({ error: "Only the requester can cancel this request" }, { status: 403 });
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(split.status)) {
    return NextResponse.json({
      error: `Cannot cancel a request that is already ${split.status.toLowerCase().replace("_", " ")}`,
    }, { status: 409 });
  }

  const updated = await prisma.assetSplit.update({
    where: { id: params.id },
    data:  { status: "CANCELLED" },
  });

  if (split.approvalInstanceId) {
    await prisma.approvalInstance.updateMany({
      where: { id: split.approvalInstanceId, status: "IN_PROGRESS" },
      data:  { status: "CANCELLED", completedAt: new Date() },
    });
  }

  await logAudit({
    userId,
    action:       "ASSET_SPLIT_REQUEST_CANCELLED",
    module:       "assets",
    resourceId:   split.id,
    resourceType: "AssetSplit",
  });

  return NextResponse.json({ success: true, data: updated });
}
