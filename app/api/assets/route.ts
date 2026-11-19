<<<<<<< HEAD
import { NextRequest, NextResponse }     from "next/server";
import { getServerSession }              from "next-auth";
import { authOptions }                   from "@/lib/auth";
import { prisma }                        from "@/lib/prisma";
import { logAudit }                      from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { z }                             from "zod";

export const dynamic = "force-dynamic";

const CreateAssetSchema = z.object({
  entityId:            z.string().cuid("Invalid entity"),
  branchId:            z.string().cuid("Branch is required"),
  name:                z.string().min(2, "Name must be at least 2 characters"),
  description:         z.string().optional(),
  classificationId:    z.string().cuid().optional(),
  legacyCategory:      z.string().optional(),
  barcodeTag:          z.string().optional(),
  serialNo:            z.string().optional(),
  make:                z.string().optional(),
  model:               z.string().optional(),
  tags:                z.string().optional(),
  location:            z.string().optional(),
  isMovable:           z.boolean().default(true),
  assignedToId:        z.string().cuid().optional(),
  purchaseDate:        z.string().optional().refine(
    (val) => !val || val.slice(0, 10) <= new Date().toISOString().slice(0, 10),
    { message: "Purchase Date cannot be in the future." },
  ),
  acquisitionValue:    z.number().positive().optional(),
  quantity:            z.number().int().positive().max(10000).default(1),
  residualValue:       z.number().min(0).optional(),
  currentBookValue:    z.number().min(0).optional(),
  usefulLifeYrs:       z.number().int().positive().default(4),
  depreciationMethod:  z.enum(["STRAIGHT_LINE","REDUCING_BALANCE","NONE"]).default("STRAIGHT_LINE"),
  condition:           z.enum(["EXCELLENT","GOOD","FAIR","POOR","CONDEMNED"]).default("GOOD"),
  supplier:            z.string().min(1, "Supplier / Vendor is required"),
  invoiceRef:          z.string().optional(),
  warrantyExpiry:      z.string().optional(),
  insuranceExpiry:     z.string().optional(),
  glAccountCode:       z.string().optional(),
  glAccountId:         z.string().cuid().optional(),
  budgetRef:           z.string().optional(),
  photos:              z.union([z.string(), z.array(z.string())]).optional(),
  documents:           z.array(z.string()).optional(),
=======
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const AssetSchema = z.object({
  entityId: z.string().cuid(),
  name: z.string().min(2),
  assetNo: z.string().min(2),
  category: z.enum(["FURNITURE", "EQUIPMENT", "VEHICLE", "PROPERTY", "IT", "OTHER"]),
  description: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
  currentValue: z.number().optional(),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]).default("GOOD"),
  assignedToId: z.string().cuid().optional(),
  glAccountCode: z.string().optional(),
  photos: z.array(z.string()).optional(),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

<<<<<<< HEAD
  const canView = await hasGranularPermission("assets", "assets", "view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user             = session.user as any;
  const { searchParams } = new URL(req.url);
  const entityId         = searchParams.get("entityId");
  const branchId         = searchParams.get("branchId");
  const classificationId = searchParams.get("classificationId");
  const status           = searchParams.get("status");
  const condition        = searchParams.get("condition");
  const q                = searchParams.get("q");
  const page             = Math.max(1, parseInt(searchParams.get("page")     ?? "1"));
  const approval         = searchParams.get("approval");
  const pageSize         = Math.min(200, parseInt(searchParams.get("pageSize") ?? searchParams.get("take") ?? "20"));

  const where: any = {
    ...(user.isSystem ? (entityId ? { entityId } : {}) : { entityId: entityId ?? user.entityId }),
    ...(branchId         ? { branchId }         : {}),
    ...(classificationId ? { classificationId } : {}),
    ...(status           ? { status }           : {}),
    ...(condition        ? { condition }        : {}),
    ...(approval         ? { approvalStatus: approval } : {}),
    ...(q ? {
      OR: [
        { name:      { contains: q } },
        { assetNo:   { contains: q } },
        { make:      { contains: q } },
        { model:     { contains: q } },
        { serialNo:  { contains: q } },
        { barcodeTag:{ contains: q } },
        { supplier:  { contains: q } },
        { tags:      { contains: q } },
      ],
    } : {}),
  };

  const [assets, total, totalActiveCount, totalMaintCount, totalValueResult] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        entity:         { select: { name: true, code: true } },
        branch:         { select: { name: true, code: true } },
        classification: { select: { name: true, code: true } },
        assignedTo:     { select: { name: true, email: true } },
        createdBy:      { select: { name: true } },
      },
=======
  const canView = await hasPermission("assets", "canView");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");

  const where: any = {
    ...(entityId ? { entityId } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
  };

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: { entity: { select: { name: true, code: true } }, assignedTo: { select: { name: true } } },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.count({ where }),
<<<<<<< HEAD
    prisma.asset.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.asset.count({ where: { ...where, status: "UNDER_MAINTENANCE" } }),
    prisma.asset.aggregate({
      where: { ...where, status: "ACTIVE" },
      _sum:  { currentBookValue: true },
    }),
  ]);

  const totalBookValue = Number(totalValueResult._sum.currentBookValue ?? 0);

  return NextResponse.json({
    success:      true,
    data:         assets,
    total,
    page,
    pageSize,
    totalPages:   Math.ceil(total / pageSize),
    stats: {
      totalActive:       totalActiveCount,
      totalMaintenance:  totalMaintCount,
      totalBookValue,
    },
  });
=======
  ]);

  return NextResponse.json({ success: true, data: assets, total, page, pageSize });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

<<<<<<< HEAD
  const canCreate = await hasGranularPermission("assets", "register", "create");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    const text = await req.text();
    if (!text?.trim()) return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const parsed = CreateAssetSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError  = Object.entries(fieldErrors).find(([, v]) => v?.length);
    const message     = firstError
      ? `${firstError[0]}: ${firstError[1]?.[0]}`
      : parsed.error.issues[0]?.message ?? "Validation failed";
    return NextResponse.json({
      error:   message,
      details: fieldErrors,
    }, { status: 400 });
  }

  const {
    entityId, branchId, name, description, classificationId, legacyCategory,
    barcodeTag, serialNo, make, model, tags, location, isMovable, assignedToId,
    purchaseDate, acquisitionValue, quantity, residualValue, currentBookValue, usefulLifeYrs,
    depreciationMethod, condition, supplier, invoiceRef, warrantyExpiry, insuranceExpiry,
    glAccountCode, glAccountId, budgetRef, photos, documents,
  } = parsed.data;

  const userId = (session.user as any).id;

  const branch = await prisma.branch.findFirst({ where: { id: branchId, entityId } });
  if (!branch) {
    return NextResponse.json({ error: "Branch does not belong to the selected entity" }, { status: 400 });
  }

  if (barcodeTag) {
    const dupBarcode = await prisma.asset.findFirst({ where: { barcodeTag } });
    if (dupBarcode) {
      return NextResponse.json({ error: `Barcode "${barcodeTag}" is already assigned to asset ${dupBarcode.assetNo}` }, { status: 409 });
    }
  }

  if (serialNo) {
    const dupSerial = await prisma.asset.findFirst({ where: { serialNo } });
    if (dupSerial) {
      return NextResponse.json({ error: `Serial number "${serialNo}" is already registered on asset ${dupSerial.assetNo}` }, { status: 409 });
    }
  }

  const entity   = await prisma.entity.findUnique({ where: { id: entityId } });
  const lastAsset = await prisma.asset.findFirst({
    where:   { entityId },
    orderBy: { createdAt: "desc" },
  });

  let seqNum = 1;
  if (lastAsset?.assetNo) {
    const parts   = lastAsset.assetNo.split("/");
    const lastSeq = parseInt(parts[parts.length - 1] ?? "0", 10);
    if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
  }

  const assetNo = `${entity?.code ?? "AST"}/${branch.code ?? branch.name.slice(0, 3).toUpperCase()}/${String(seqNum).padStart(6, "0")}`;

  let photosJson: string | null = null;
  if (photos) {
    if (typeof photos === "string") {
      photosJson = photos;
    } else if (Array.isArray(photos)) {
      photosJson = JSON.stringify(photos);
    }
  }

  const asset = await prisma.asset.create({
    data: {
      assetNo,
      entityId,
      branchId,
      name,
      description:       description    ?? null,
      classificationId:  classificationId ?? null,
      legacyCategory:    legacyCategory ?? null,
      barcodeTag:        barcodeTag     ?? null,
      serialNo:          serialNo       ?? null,
      make:              make           ?? null,
      model:             model          ?? null,
      tags:              tags           ?? null,
      location:          location       ?? null,
      isMovable:         isMovable,
      assignedToId:      assignedToId   ?? null,
      purchaseDate:      purchaseDate   ? new Date(purchaseDate) : null,
      acquisitionValue:  acquisitionValue ?? null,
      unitCost:          acquisitionValue != null
        ? Math.round((acquisitionValue / quantity + Number.EPSILON) * 100) / 100
        : null,
      quantity,
      residualValue:     residualValue   ?? null,
      currentBookValue:  currentBookValue ?? acquisitionValue ?? null,
      usefulLifeYrs,
      depreciationMethod,
      condition,
      approvalStatus:    "PENDING_APPROVAL",
      status:            "ACTIVE",
      supplier:          supplier       ?? null,
      invoiceRef:        invoiceRef     ?? null,
      warrantyExpiry:    warrantyExpiry  ? new Date(warrantyExpiry)  : null,
      insuranceExpiry:   insuranceExpiry ? new Date(insuranceExpiry) : null,
      glAccountCode:     glAccountCode  ?? null,
      budgetRef:         budgetRef      ?? null,
      photos:            photosJson,
      createdById:       userId,
    },
    include: {
      entity:         { select: { name: true, code: true } },
      branch:         { select: { name: true, code: true } },
      classification: { select: { name: true } },
      createdBy:      { select: { name: true, email: true } },
    },
  });

  await logAudit({
    userId,
    action:       "ASSET_CREATED",
    module:       "assets",
    entityId,
    resourceId:   asset.id,
    resourceType: "Asset",
    afterData:    JSON.stringify({ assetNo, name, classificationId, acquisitionValue }),
  });

  return NextResponse.json({
    success: true,
    data:    asset,
    message: "Asset registered. Review the details on the next screen, then submit it for approval.",
  }, { status: 201 });
=======
  const canCreate = await hasPermission("assets", "canCreate");
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = AssetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const existing = await prisma.asset.findUnique({ where: { assetNo: parsed.data.assetNo } });
  if (existing) return NextResponse.json({ error: "Asset number already exists" }, { status: 409 });

  const { photos, purchaseDate, ...rest } = parsed.data;
  const asset = await prisma.asset.create({
    data: {
      ...rest,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      photos: photos ? JSON.stringify(photos) : undefined,
    },
  });

  await logAudit({ userId: (session.user as any).id, action: "ASSET_CREATED", module: "assets", entityId: asset.entityId, resourceId: asset.id });

  return NextResponse.json({ success: true, data: asset }, { status: 201 });
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
