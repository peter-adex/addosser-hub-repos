import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { z }                         from "zod";

export const dynamic = "force-dynamic";

const UpdateAssetSchema = z.object({
  entityId:            z.string().cuid().optional(),
  branchId:            z.string().cuid().nullable().optional(),
  name:                z.string().min(2).optional(),
  description:         z.string().optional(),
  classificationId:    z.string().cuid().nullable().optional(),
  legacyCategory:       z.string().optional(),
  barcodeTag:          z.string().optional(),
  serialNo:            z.string().optional(),
  make:                z.string().optional(),
  model:               z.string().optional(),
  tags:                z.string().optional(),
  location:            z.string().optional(),
  isMovable:           z.boolean().optional(),
  assignedToId:        z.string().cuid().nullable().optional(),
  purchaseDate:        z.string().optional().refine(
    (val) => !val || val.slice(0, 10) <= new Date().toISOString().slice(0, 10),
    { message: "Purchase Date cannot be in the future." },
  ),
  acquisitionValue:    z.number().positive().optional(),
  residualValue:       z.number().min(0).optional(),
  currentBookValue:    z.number().min(0).optional(),
  usefulLifeYrs:       z.number().int().positive().optional(),
  depreciationMethod:  z.enum(["STRAIGHT_LINE","REDUCING_BALANCE","NONE"]).optional(),
  condition:           z.enum(["EXCELLENT","GOOD","FAIR","POOR","CONDEMNED"]).optional(),
  status:              z.enum(["ACTIVE","UNDER_MAINTENANCE","DISPOSED","MISSING","DONATED","TRANSFERRED"]).optional(),
  supplier:            z.string().min(1).optional(),
  invoiceRef:          z.string().optional(),
  warrantyExpiry:      z.string().optional(),
  insuranceExpiry:     z.string().optional(),
  glAccountCode:       z.string().optional(),
  glAccountId:         z.string().cuid().optional(),
  budgetRef:           z.string().optional(),
  photos:              z.array(z.string()).optional(),
});

const IMMEDIATE_FIELDS = new Set(["status", "assignedToId", "location", "condition"]);

function decimalToNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function dateToISODate(v: unknown): string | null {
  if (!v) return null;
  return new Date(v as any).toISOString().slice(0, 10);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asset = await prisma.asset.findUnique({
    where:   { id: params.id },
    include: {
      entity:          { select: { id: true, name: true, code: true } },
      branch:          { select: { id: true, name: true } },
      classification:  { select: { name: true, code: true } },
      assignedTo:      { select: { name: true, email: true, avatar: true } },
      createdBy:       { select: { name: true } },
      maintenanceLogs: { orderBy: { performedAt: "desc" } },
      depreciations:   { orderBy: { year: "asc" } },
    },
  });

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: asset });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = session.user as any;
  const { hasGranularPermission } = await import("@/lib/permissions");
  const canEdit = await hasGranularPermission("assets", "edit", "edit");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (asset.pendingChangeInstanceId) {
    return NextResponse.json({
      error: "This asset already has a pending update awaiting approval. Cancel it first if you want to make different changes.",
    }, { status: 409 });
  }
  if (asset.approvalStatus === "IN_APPROVAL") {
    return NextResponse.json({
      error: "Cannot edit while this asset's registration is awaiting approval.",
    }, { status: 409 });
  }

  const body   = await req.json();
  const parsed = UpdateAssetSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).find((v) => v?.length)?.[0];
    return NextResponse.json({ error: firstError ?? "Validation failed" }, { status: 400 });
  }

  const { photos, warrantyExpiry, insuranceExpiry, purchaseDate, ...rest } = parsed.data;

  const normalizedUpdate: Record<string, any> = {
    ...rest,
    ...(photos          ? { photos: JSON.stringify(photos) }        : {}),
    ...(warrantyExpiry   ? { warrantyExpiry: new Date(warrantyExpiry) }   : {}),
    ...(insuranceExpiry  ? { insuranceExpiry: new Date(insuranceExpiry) } : {}),
    ...(purchaseDate     ? { purchaseDate: new Date(purchaseDate) }       : {}),
  };

  const changed: Record<string, any> = {};
  for (const [key, value] of Object.entries(normalizedUpdate)) {
    const current = (asset as any)[key];
    let isDifferent: boolean;
    if (value instanceof Date) {
      isDifferent = dateToISODate(current) !== dateToISODate(value);
    } else if (typeof value === "number" && (key === "acquisitionValue" || key === "residualValue" || key === "currentBookValue")) {
      isDifferent = decimalToNumber(current) !== value;
    } else {
      isDifferent = current !== value;
    }
    if (isDifferent) changed[key] = value;
  }

  if (Object.keys(changed).length === 0) {
    return NextResponse.json({ success: true, data: asset, staged: false, message: "No changes to save." });
  }

  const immediateChanges: Record<string, any> = {};
  const stageableChanges: Record<string, any> = {};
  for (const [key, value] of Object.entries(changed)) {
    if (IMMEDIATE_FIELDS.has(key)) immediateChanges[key] = value;
    else stageableChanges[key] = value;
  }

  const shouldStage = asset.approvalStatus === "APPROVED" && Object.keys(stageableChanges).length > 0;

  if (shouldStage) {
    const updated = await prisma.asset.update({
      where: { id: params.id },
      data: {
        ...immediateChanges,
        pendingChanges: stageableChanges,
      },
    });

    await logAudit({
      userId:       currentUser.id,
      action:       "ASSET_REVISION_STAGED",
      module:       "assets",
      entityId:     asset.entityId,
      resourceId:   params.id,
      resourceType: "Asset",
      beforeData:   JSON.stringify(asset),
      afterData:    JSON.stringify(stageableChanges),
    });

    return NextResponse.json({
      success: true,
      data:    updated,
      staged:  true,
      message: "Changes staged. Review them on the next screen, then submit for approval — your edits won't take effect until then.",
    });
  }

  const updated = await prisma.asset.update({
    where: { id: params.id },
    data:  { ...immediateChanges, ...stageableChanges },
  });

  await logAudit({
    userId:       currentUser.id,
    action:       "ASSET_UPDATED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   params.id,
    resourceType: "Asset",
    beforeData:   JSON.stringify(asset),
    afterData:    JSON.stringify(updated),
  });

  return NextResponse.json({ success: true, data: updated, staged: false });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;

  const asset = await prisma.asset.findUnique({
    where:   { id: params.id },
    include: { _count: { select: { maintenanceLogs: true } } },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const isOwner = asset.createdById === user.id;
  if (!isOwner && !user.isSystem) {
    return NextResponse.json({ error: "Only the requisitioner or a Super Admin can delete this asset" }, { status: 403 });
  }
  if (asset.approvalStatus !== "PENDING_APPROVAL") {
    return NextResponse.json({
      error: "This asset can no longer be deleted — it has already been submitted for approval.",
    }, { status: 409 });
  }

  if (asset._count.maintenanceLogs > 0) {
    return NextResponse.json({
      error: `Cannot delete — asset has ${asset._count.maintenanceLogs} maintenance log(s). Dispose it instead.`,
    }, { status: 409 });
  }

  await prisma.asset.delete({ where: { id: params.id } });

  await logAudit({
    userId:       user.id,
    action:       "ASSET_DELETED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   params.id,
    resourceType: "Asset",
    beforeData:   JSON.stringify(asset),
  });

  return NextResponse.json({ success: true });
}
