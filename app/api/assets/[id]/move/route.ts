import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MoveSchema = z.object({
  movementType: z.enum([
    "REALLOCATION",
    "TEMPORARY_LOAN",
    "RETURN",
    "ASSIGNMENT",
    "UNASSIGNMENT",
    "REPAIR_TRANSIT",
  ]),
  toBranchId: z.string().cuid().optional(),
  toLocation: z.string().optional(),
  toAssigneeId: z.string().cuid().optional(),
  reason: z.string().optional(),
  authorisedById: z.string().cuid().optional(),
  movementDate: z.string(),
  returnDate: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = await hasGranularPermission("assets", "movement", "create");
  if (!canEdit)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      branch: { select: { name: true } },
      entity: { select: { name: true } },
    },
  });
  if (!asset)
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (!asset.isMovable) {
    return NextResponse.json(
      {
        error: `"${asset.name}" is marked as non-movable and cannot be reallocated. Edit the asset to change this setting.`,
      },
      { status: 422 },
    );
  }

  const body = await req.json();
  const parsed = MoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const {
    toBranchId,
    toLocation,
    toAssigneeId,
    movementDate,
    returnDate,
    ...rest
  } = parsed.data;

  const [movement] = await prisma.$transaction([
    prisma.assetMovement.create({
      data: {
        assetId: params.id,
        fromBranchId: asset.branchId,
        fromLocation: asset.location,
        fromAssigneeId: asset.assignedToId,
        toBranchId: toBranchId ?? asset.branchId,
        toLocation: toLocation ?? asset.location,
        toAssigneeId: toAssigneeId ?? asset.assignedToId,
        movementDate: new Date(movementDate),
        returnDate: returnDate ? new Date(returnDate) : undefined,
        ...rest,
      },
    }),
    prisma.asset.update({
      where: { id: params.id },
      data: {
        branchId: toBranchId ?? asset.branchId,
        location: toLocation ?? asset.location,
        assignedToId: toAssigneeId ?? asset.assignedToId,
      },
    }),
  ]);

  if (rest.authorisedById && rest.authorisedById !== (session.user as any).id) {
    await createNotification({
      userId: rest.authorisedById,
      type: "ASSET_MOVED",
      title: `Asset Moved — ${asset.name}`,
      message: `Asset ${asset.assetNo} has been ${rest.movementType.replace("_", " ").toLowerCase()} by ${(session.user as any).name}.`,
      actionUrl: `/assets/${params.id}`,
    });
  }

  await logAudit({
    userId: (session.user as any).id,
    action: "ASSET_MOVED",
    module: "assets",
    entityId: asset.entityId,
    resourceId: params.id,
    resourceType: "Asset",
    beforeData: JSON.stringify({
      branchId: asset.branchId,
      location: asset.location,
    }),
    afterData: JSON.stringify({ toBranchId, toLocation }),
  });

  return NextResponse.json({ success: true, data: movement }, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const movements = await prisma.assetMovement.findMany({
    where: { assetId: params.id },
    orderBy: { movementDate: "desc" },
  });

  return NextResponse.json({ success: true, data: movements });
}
