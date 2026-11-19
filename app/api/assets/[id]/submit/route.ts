import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowInstance } from "@/lib/approval-workflow";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { entity: { select: { name: true } } },
  });

  if (!asset)
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.createdById !== userId && !(session.user as any).isSystem) {
    return NextResponse.json(
      { error: "Only the asset creator can submit for approval" },
      { status: 403 },
    );
  }
  if (asset.approvalStatus !== "PENDING_APPROVAL") {
    return NextResponse.json(
      {
        error: `Asset is already ${asset.approvalStatus.toLowerCase().replace("_", " ")}`,
      },
      { status: 409 },
    );
  }

  const claim = await prisma.asset.updateMany({
    where: { id: params.id, approvalStatus: "PENDING_APPROVAL" },
    data: { approvalStatus: "IN_APPROVAL" },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { error: "This asset has already been submitted for approval." },
      { status: 409 },
    );
  }

  const workflow =
    (await prisma.approvalWorkflow.findFirst({
      where: {
        module: "assets",
        action: "REGISTER",
        isActive: true,
        entityId: asset.entityId,
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    })) ??
    (await prisma.approvalWorkflow.findFirst({
      where: {
        module: "assets",
        action: "REGISTER",
        isActive: true,
        entityId: null,
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    }));

  if (!workflow || workflow.steps.length === 0) {
    await prisma.asset.update({
      where: { id: params.id },
      data: { approvalStatus: "PENDING_APPROVAL" },
    });
    return NextResponse.json(
      {
        error:
          "No approval workflow configured for asset registration. Contact your administrator.",
      },
      { status: 422 },
    );
  }

  try {
    const instance = await createWorkflowInstance({
      workflowId: workflow.id,
      entityId: asset.entityId,
      resourceId: asset.id,
      resourceType: "Asset",
      requestedById: userId,
    });

    await logAudit({
      userId,
      action: "ASSET_SUBMITTED_FOR_APPROVAL",
      module: "assets",
      entityId: asset.entityId,
      resourceId: params.id,
      resourceType: "Asset",
      afterData: JSON.stringify({
        workflowId: workflow.id,
        instanceId: instance.instanceId,
      }),
    });

    return NextResponse.json({
      success: true,
      data: {
        instanceId: instance.instanceId,
        totalSteps: workflow.steps.length,
      },
      message: `Submitted for approval — ${workflow.steps.length} step workflow started`,
    });
  } catch (err: any) {
    await prisma.asset
      .update({
        where: { id: params.id },
        data: { approvalStatus: "PENDING_APPROVAL" },
      })
      .catch(() => {});
    return NextResponse.json(
      { error: err.message ?? "Failed to start approval workflow" },
      { status: 500 },
    );
  }
}
