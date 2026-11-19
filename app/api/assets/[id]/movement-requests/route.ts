import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { createWorkflowInstance } from "@/lib/approval-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AttachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().refine((v) => v.startsWith("/") || /^https?:\/\//.test(v)),
  storageProvider: z.string().optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
});

const CreateSchema = z.object({
  toEntityId: z.string().cuid().optional(),
  toBranchId: z.string().cuid().optional(),
  toLocation: z.string().optional(),
  toAssigneeId: z.string().cuid().optional(),
  reason: z.string().min(1, "Movement reason is required"),
  movementDate: z.string().min(1, "Movement date is required"),
  attachmentUrl: z.string().url().optional(),
  attachments: z.array(AttachmentSchema).max(10).optional(),
  remarks: z.string().optional(),
  submit: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const canCreate = await hasGranularPermission("assets", "movement", "create");
  const canEdit = await hasGranularPermission("assets", "edit", "edit");
  if (!canCreate && !canEdit) {
    return NextResponse.json(
      { error: "You do not have permission to request asset movements" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { id: true, name: true, code: true, isActive: true } },
      branch: { select: { id: true, name: true, entityId: true } },
    },
  });
  if (!asset)
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (!asset.isMovable) {
    return NextResponse.json(
      {
        error: `"${asset.name}" is marked as non-movable and cannot be reallocated.`,
      },
      { status: 422 },
    );
  }
  if (asset.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error: `Asset must be ACTIVE to be moved (current status: ${asset.status}).`,
      },
      { status: 422 },
    );
  }
  if (!data.toEntityId && !data.toBranchId && !data.toLocation) {
    return NextResponse.json(
      {
        error:
          "Provide at least a new entity, branch/location, or specific location.",
      },
      { status: 400 },
    );
  }

  if (data.toEntityId) {
    const toEntity = await prisma.entity.findUnique({
      where: { id: data.toEntityId },
    });
    if (!toEntity || !toEntity.isActive) {
      return NextResponse.json(
        { error: "Destination entity does not exist or is inactive." },
        { status: 422 },
      );
    }
  }
  if (data.toBranchId) {
    const toBranch = await prisma.branch.findUnique({
      where: { id: data.toBranchId },
    });
    if (!toBranch || !toBranch.isActive) {
      return NextResponse.json(
        { error: "Destination branch/location does not exist or is inactive." },
        { status: 422 },
      );
    }
    const targetEntityId = data.toEntityId ?? asset.entityId;
    if (toBranch.entityId !== targetEntityId) {
      return NextResponse.json(
        {
          error:
            "Destination branch/location does not belong to the destination entity.",
        },
        { status: 422 },
      );
    }
  }
  if (data.toAssigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.toAssigneeId },
    });
    if (!assignee || !assignee.isActive) {
      return NextResponse.json(
        { error: "Selected user does not exist or is inactive." },
        { status: 422 },
      );
    }
  }

  const sameEntity = !data.toEntityId || data.toEntityId === asset.entityId;
  const sameBranch = !data.toBranchId || data.toBranchId === asset.branchId;
  const sameLocation =
    !data.toLocation || data.toLocation === (asset.location ?? "");
  if (sameEntity && sameBranch && sameLocation) {
    return NextResponse.json(
      {
        error:
          "The proposed entity/location is the same as the current entity/location.",
      },
      { status: 422 },
    );
  }

  const movement = await prisma.assetMovement.create({
    data: {
      assetId: asset.id,
      movementType: "REALLOCATION",
      status: "Pending Request",
      requestStatus: "DRAFT",
      fromEntityId: asset.entityId,
      toEntityId: data.toEntityId ?? asset.entityId,
      fromBranchId: asset.branchId,
      toBranchId: data.toBranchId ?? asset.branchId,
      fromLocation: asset.location,
      toLocation: data.toLocation ?? asset.location,
      assetCodeSnapshot: asset.assetNo,
      assetDescSnapshot: asset.name,
      reason: data.reason,
      remarks: data.remarks,
      attachmentUrl: data.attachmentUrl,
      attachments: data.attachments?.length
        ? JSON.stringify(data.attachments)
        : undefined,
      toAssigneeId: data.toAssigneeId,
      movementDate: new Date(data.movementDate),
      requestedById: userId,
    },
  });

  await logAudit({
    userId,
    action: "ASSET_MOVEMENT_REQUEST_CREATED",
    module: "assets",
    entityId: asset.entityId,
    resourceId: movement.id,
    resourceType: "AssetMovement",
    afterData: JSON.stringify({
      toEntityId: data.toEntityId,
      toBranchId: data.toBranchId,
      toLocation: data.toLocation,
    }),
  });

  if (!data.submit) {
    return NextResponse.json(
      {
        success: true,
        data: movement,
        message: "Movement request saved as draft",
      },
      { status: 201 },
    );
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { module: "assets", action: "MOVE", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    return NextResponse.json(
      {
        success: true,
        data: movement,
        message:
          "Saved as draft — no active 'MOVE' approval workflow is configured for the assets module yet. Contact your administrator to configure one, or an admin may complete the movement directly.",
      },
      { status: 201 },
    );
  }

  const instance = await createWorkflowInstance({
    workflowId: workflow.id,
    entityId: asset.entityId,
    resourceId: movement.id,
    resourceType: "AssetMovement",
    requestedById: userId,
    resourceTitle: `Asset Movement — ${asset.assetNo}`,
  });

  const updated = await prisma.assetMovement.update({
    where: { id: movement.id },
    data: {
      requestStatus: "PENDING_APPROVAL",
      approvalInstanceId: instance.instanceId,
      submittedAt: new Date(),
    },
  });

  await logAudit({
    userId,
    action: "ASSET_MOVEMENT_REQUEST_SUBMITTED",
    module: "assets",
    entityId: asset.entityId,
    resourceId: movement.id,
    resourceType: "AssetMovement",
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.assetMovement.findMany({
    where: { assetId: params.id, requestStatus: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      fromEntity: { select: { name: true, code: true } },
      toEntity: { select: { name: true, code: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });

  const assigneeIds = Array.from(
    new Set(requests.map((r) => r.toAssigneeId).filter(Boolean)),
  ) as string[];

  const assignees = assigneeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const assigneeById = new Map(assignees.map((a) => [a.id, a]));

  return NextResponse.json({
    success: true,
    data: requests.map((r) => ({
      ...r,
      toAssignee: r.toAssigneeId
        ? (assigneeById.get(r.toAssigneeId) ?? null)
        : null,
      attachments: r.attachments ? JSON.parse(r.attachments) : [],
    })),
  });
}
