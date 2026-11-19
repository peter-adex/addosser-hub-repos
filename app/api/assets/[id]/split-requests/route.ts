import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/lib/auth";
import { prisma }                    from "@/lib/prisma";
import { logAudit }                  from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { createWorkflowInstance }    from "@/lib/approval-workflow";
import { checkSplitEligibility, previewSplit } from "@/lib/asset-split";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ChildSpecSchema = z.object({
  serialNo:     z.string().optional(),
  barcodeTag:   z.string().optional(),
  assignedToId: z.string().cuid().optional(),
  branchId:     z.string().cuid().optional(),
  location:     z.string().optional(),
});

const CreateSchema = z.object({
  quantitySplit:  z.number().int().min(1),
  reason:         z.string().min(1, "Split reason is required"),
  effectiveDate:  z.string().min(1, "Effective date is required"),
  children:       z.array(ChildSpecSchema),
  attachmentUrl:  z.string().refine((v) => v.startsWith("/") || /^https?:\/\//.test(v)).optional(),
  submit:         z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canCreate = await hasGranularPermission("assets", "split", "create");
  if (!canCreate) {
    return NextResponse.json({ error: "You do not have permission to split assets" }, { status: 403 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.children.length !== data.quantitySplit) {
    return NextResponse.json({
      error: `You must provide details for exactly ${data.quantitySplit} new asset(s) — got ${data.children.length}.`,
    }, { status: 400 });
  }

  const { eligible, reason, asset } = await checkSplitEligibility(params.id);
  if (!eligible || !asset) {
    return NextResponse.json({ error: reason ?? "Asset is not eligible for splitting" }, { status: 422 });
  }
  if (data.quantitySplit > asset.quantity) {
    return NextResponse.json({
      error: `Cannot split ${data.quantitySplit} units — only ${asset.quantity} available.`,
    }, { status: 422 });
  }

  const serials = data.children.map((c) => c.serialNo).filter(Boolean) as string[];
  const tags    = data.children.map((c) => c.barcodeTag).filter(Boolean) as string[];
  if (new Set(serials).size !== serials.length) {
    return NextResponse.json({ error: "Duplicate serial numbers entered — each new asset needs a unique serial number." }, { status: 422 });
  }
  if (new Set(tags).size !== tags.length) {
    return NextResponse.json({ error: "Duplicate asset tags entered — each new asset needs a unique tag." }, { status: 422 });
  }
  if (serials.length) {
    const clash = await prisma.asset.findFirst({ where: { serialNo: { in: serials } } });
    if (clash) return NextResponse.json({ error: `Serial number "${clash.serialNo}" is already in use by another asset.` }, { status: 422 });
  }
  if (tags.length) {
    const clash = await prisma.asset.findFirst({ where: { barcodeTag: { in: tags } } });
    if (clash) return NextResponse.json({ error: `Asset tag "${clash.barcodeTag}" is already in use by another asset.` }, { status: 422 });
  }

  const preview = previewSplit(asset, data.quantitySplit);

  const split = await prisma.assetSplit.create({
    data: {
      parentAssetId:         asset.id,
      quantitySplit:         data.quantitySplit,
      reason:                data.reason,
      effectiveDate:         new Date(data.effectiveDate),
      status:                "DRAFT",
      requestedById:         userId,
      quantityBefore:        preview.quantityBefore,
      quantityAfter:         preview.quantityAfter,
      totalCostBefore:       preview.totalCostBefore,
      totalCostAfter:        preview.totalCostAfter,
      bookValueBefore:       preview.bookValueBefore,
      accumulatedDeprBefore: preview.accumulatedDeprBefore,
      childSpecs:            data.children,
      attachmentUrl:         data.attachmentUrl,
    },
  });

  await logAudit({
    userId,
    action:       "ASSET_SPLIT_REQUEST_CREATED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   split.id,
    resourceType: "AssetSplit",
    afterData:    JSON.stringify({ quantitySplit: data.quantitySplit, reason: data.reason }),
  });

  if (!data.submit) {
    return NextResponse.json({ success: true, data: split, message: "Split request saved as draft" }, { status: 201 });
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where:   { module: "assets", action: "SPLIT", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    const updated = await prisma.assetSplit.update({
      where: { id: split.id },
      data:  { submittedAt: new Date() },
    });
    return NextResponse.json({
      success: true,
      data:    updated,
      message: "Saved as draft — no active 'SPLIT' approval workflow is configured for the assets module yet. Contact your administrator to configure one.",
    }, { status: 201 });
  }

  const instance = await createWorkflowInstance({
    workflowId:    workflow.id,
    entityId:      asset.entityId,
    resourceId:    split.id,
    resourceType:  "AssetSplit",
    requestedById: userId,
    resourceTitle: `Asset Split — ${asset.assetNo} (${data.quantitySplit} of ${asset.quantity})`,
  });

  const updated = await prisma.assetSplit.update({
    where: { id: split.id },
    data: {
      status:              "PENDING_APPROVAL",
      approvalInstanceId:  instance.instanceId,
      submittedAt:         new Date(),
    },
  });

  await logAudit({
    userId,
    action:       "ASSET_SPLIT_REQUEST_SUBMITTED",
    module:       "assets",
    entityId:     asset.entityId,
    resourceId:   split.id,
    resourceType: "AssetSplit",
    afterData:    JSON.stringify({ instanceId: instance.instanceId }),
  });

  return NextResponse.json({
    success: true,
    data:    updated,
    message: `Submitted for approval — ${instance.totalSteps} step workflow started`,
  }, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [asParent, asChild] = await Promise.all([
    prisma.assetSplit.findMany({
      where:   { parentAssetId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select: { name: true, email: true } },
        children:    { select: { id: true, assetNo: true, name: true } },
      },
    }),
    prisma.asset.findUnique({
      where:  { id: params.id },
      select: {
        parentAssetId: true,
        splitId: true,
        parentAsset: { select: { id: true, assetNo: true, name: true } },
        splitEvent:  { select: { id: true, effectiveDate: true, reason: true, requestedBy: { select: { name: true } } } },
      },
    }),
  ]);

  return NextResponse.json({ success: true, data: { asParent, originatedFrom: asChild?.parentAsset ? { asset: asChild.parentAsset, split: asChild.splitEvent } : null } });
}
