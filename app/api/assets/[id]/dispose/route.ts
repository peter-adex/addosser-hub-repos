import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { createWorkflowInstance } from "@/lib/approval-workflow";
import { calcDepreciation } from "@/lib/depreciation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DisposeSchema = z.object({
  disposalType: z.enum(["SALE", "SCRAP", "DONATION", "WRITE_OFF"]),
  disposalDate: z.string(),
  salePrice: z.number().min(0).optional(),
  recipient: z.string().optional(),
  reason: z.string().optional(),
  documents: z.array(z.string()).optional(),
  submit: z.boolean().default(false),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canView = await hasGranularPermission("assets", "dispose", "view");
  if (!canView)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const disposals = await prisma.assetDisposal.findMany({
    where: { assetId: params.id },
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ success: true, data: disposals });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canCreate = await hasGranularPermission("assets", "dispose", "create");
  if (!canCreate) {
    return NextResponse.json(
      { error: "You do not have permission to request an asset disposal" },
      { status: 403 },
    );
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { entity: { select: { name: true } } },
  });
  if (!asset)
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (asset.status === "DISPOSED") {
    return NextResponse.json(
      { error: "Asset has already been disposed" },
      { status: 409 },
    );
  }

  const pending = await prisma.assetDisposal.findFirst({
    where: {
      assetId: params.id,
      requestStatus: { in: ["DRAFT", "PENDING_APPROVAL"] },
    },
  });
  if (pending) {
    return NextResponse.json(
      {
        error:
          "A disposal request is already pending for this asset. Cancel it first, or wait for it to be approved/rejected.",
      },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = DisposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const deprResult = calcDepreciation(
    asset.purchaseDate,
    asset.acquisitionValue?.toNumber() ?? null,
    asset.residualValue?.toNumber() ?? null,
    asset.usefulLifeYrs,
  );

  const bookValueAtDate =
    deprResult?.netBookValue ??
    Number(asset.currentBookValue ?? asset.acquisitionValue ?? 0);
  const salePrice = data.salePrice ?? 0;
  const gainLoss =
    data.disposalType === "SALE"
      ? salePrice - bookValueAtDate
      : -bookValueAtDate;

  const disposal = await prisma.assetDisposal.create({
    data: {
      assetId: asset.id,
      disposalType: data.disposalType,
      disposalDate: new Date(data.disposalDate),
      salePrice: data.salePrice,
      bookValueAtDate,
      gainLoss,
      recipient: data.recipient,
      reason: data.reason,
      documents: data.documents ? JSON.stringify(data.documents) : undefined,
      requestStatus: "DRAFT",
      requestedById: userId,
    },
  });

  await logAudit({
    userId,
    action: "ASSET_DISPOSAL_REQUEST_CREATED",
    module: "assets",
    entityId: asset.entityId,
    resourceId: disposal.id,
    resourceType: "AssetDisposal",
    afterData: JSON.stringify({
      disposalType: data.disposalType,
      bookValueAtDate,
      gainLoss,
    }),
  });

  if (!data.submit) {
    return NextResponse.json(
      {
        success: true,
        data: disposal,
        message: "Disposal request saved as draft",
      },
      { status: 201 },
    );
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { module: "assets", action: "DISPOSE", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    return NextResponse.json(
      {
        success: true,
        data: disposal,
        message:
          "Saved as draft — no active 'DISPOSE' approval workflow is configured for the assets module yet. Contact your administrator to configure one.",
      },
      { status: 201 },
    );
  }

  const instance = await createWorkflowInstance({
    workflowId: workflow.id,
    entityId: asset.entityId,
    resourceId: disposal.id,
    resourceType: "AssetDisposal",
    requestedById: userId,
    resourceTitle: `Asset Disposal — ${asset.assetNo} (${data.disposalType})`,
  });

  const updated = await prisma.assetDisposal.update({
    where: { id: disposal.id },
    data: {
      requestStatus: "PENDING_APPROVAL",
      approvalInstanceId: instance.instanceId,
      submittedAt: new Date(),
    },
  });

  await logAudit({
    userId,
    action: "ASSET_DISPOSAL_REQUEST_SUBMITTED",
    module: "assets",
    entityId: asset.entityId,
    resourceId: disposal.id,
    resourceType: "AssetDisposal",
    afterData: JSON.stringify({ instanceId: instance.instanceId }),
  });

  return NextResponse.json(
    {
      success: true,
      data: updated,
      message: `Submitted for approval — ${instance.totalSteps} step workflow started`,
    },
    { status: 201 },
  );
}
