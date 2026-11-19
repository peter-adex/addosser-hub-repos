import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { resend, FROM_EMAIL } from "./resend";
import { logAudit } from "./audit";
import { InvoiceApprovalEmail } from "@/emails/InvoiceApprovalEmail";
import { invoiceTypeLabel } from "@/lib/invoice-type-labels";
import { AssetApprovalEmail } from "@/emails/AssetApprovalEmail";
import { getBaseUrl } from "@/lib/base-url";

export type WorkflowModule = "assets" | "invoice" | "budgeting" | "finance";

export interface ProcessResult {
  success: boolean;
  newInstanceStatus: "IN_PROGRESS" | "FULLY_APPROVED" | "REJECTED";
  nextStep?: number;
  message: string;
}

function buildResourceUrl(resourceType: string, resourceId: string): string {
  const base = getBaseUrl();

  switch (resourceType.toLowerCase()) {
    case "asset":
      return `${base}/assets/approvals`;

    case "invoice":
      return `${base}/invoice/${resourceId}`;

    case "budget":
      return `${base}/budgeting/${resourceId}`;

    case "assetmovement":
      return `${base}/assets/approvals`;

    case "gltransaction":
      return `${base}/finance/gl-entries/${resourceId}`;

    case "gljournalentry":
      return `${base}/finance/gl-entries/journal/${resourceId}`;

    default:
      return `${base}/${resourceType.toLowerCase()}s/${resourceId}`;
  }
}

console.log("🔥 createWorkflowInstance CALLED");

export async function createWorkflowInstance(params: {
  workflowId: string;
  entityId: string;
  resourceId: string;
  resourceType: string;
  requestedById: string;
  resourceTitle?: string;
  resourceUrl?: string;
  requestedByName?: string;
  entityName?: string;
}): Promise<{ instanceId: string; totalSteps: number; message: string }> {
  const { workflowId, entityId, resourceId, resourceType, requestedById } =
    params;

  const resourceUrl =
    params.resourceUrl ?? buildResourceUrl(resourceType, resourceId);
  const resourceTitle =
    params.resourceTitle ??
    `${resourceType} ${resourceId.slice(-8).toUpperCase()}`;

  const workflow = await prisma.approvalWorkflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    throw new Error("Approval workflow not found or has no steps configured");
  }

  const [submitter, entity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: requestedById },
      select: { name: true, email: true },
    }),
    prisma.entity.findUnique({
      where: { id: entityId },
      select: { name: true },
    }),
  ]);

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        workflowId,
        entityId,
        resourceId,
        resourceType,
        requestedById,
        module: workflow.module || "invoice",
        currentStep: 1,
        totalSteps: workflow.steps.length,
        status: "IN_PROGRESS",
      },
    });

    for (const wfStep of workflow.steps) {
      console.log(
        `Creating step ${wfStep.stepNumber}: ${
          wfStep.stepNumber === 1 ? "PENDING" : "WAITING"
        }`,
      );
      const assignedUser = wfStep.userId
        ? await tx.user.findUnique({ where: { id: wfStep.userId }, select: { name: true } })
        : null;
      await tx.approvalInstanceStep.create({
        data: {
          instanceId: inst.id,
          stepNumber: wfStep.stepNumber,
          roleId: wfStep.roleId,
          roleName: wfStep.roleName || "Reviewer",
          userId: wfStep.userId,
          userName: assignedUser?.name ?? "",
          approvalLimitAmount: wfStep.approvalLimitAmount ?? undefined,
          isExceptionalApprover: wfStep.isExceptionalApprover,
          status: wfStep.stepNumber === 1 ? "PENDING" : "WAITING",
        },
      });
    }
    return inst;
  });

  const step1 = workflow.steps[0];
  await _notifyStepApprovers({
    step: step1,
    instanceId: instance.id,
    resourceType,
    resourceTitle,
    resourceUrl,
    submitterName: submitter?.name ?? "Someone",
    entityName: entity?.name ?? "",
    stepNumber: 1,
    totalSteps: workflow.steps.length,
  });

  return {
    instanceId: instance.id,
    totalSteps: workflow.steps.length,
    message: `Approval workflow started — ${workflow.steps.length} step(s)`,
  };
}
export async function createWorkflowInstanceFromSelections(params: {
  workflowId: string;
  entityId: string;
  resourceId: string;
  resourceType: string;
  requestedById: string;
  selections: { stepNumber: number; userId: string; approvalLimitAmount?: number | null; isExceptionalApprover?: boolean }[];
  resourceTitle?: string;
  resourceUrl?: string;
}): Promise<{ instanceId: string; totalSteps: number; message: string }> {
  const { workflowId, entityId, resourceId, resourceType, requestedById, selections } = params;

  if (!selections.length) {
    throw new Error("No approvers were selected for this invoice");
  }

  const workflow = await prisma.approvalWorkflow.findUnique({ where: { id: workflowId } });
  if (!workflow || !workflow.isActive) {
    throw new Error("Approval workflow not found or is inactive");
  }

  const resourceUrl = params.resourceUrl ?? buildResourceUrl(resourceType, resourceId);
  const resourceTitle = params.resourceTitle ?? `${resourceType} ${resourceId.slice(-8).toUpperCase()}`;

  const sortedSelections = [...selections].sort((a, b) => a.stepNumber - b.stepNumber);

  sortedSelections.forEach((s, i) => {
    if (s.stepNumber !== i + 1) {
      throw new Error("Approval sequence is invalid — steps must be numbered 1..N with no gaps");
    }
  });

  const userIds = sortedSelections.map((s) => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const [submitter, entity] = await Promise.all([
    prisma.user.findUnique({ where: { id: requestedById }, select: { name: true, email: true } }),
    prisma.entity.findUnique({ where: { id: entityId }, select: { name: true } }),
  ]);

  const instance = await prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.create({
      data: {
        workflowId,
        entityId,
        resourceId,
        resourceType,
        requestedById,
        module: workflow.module || "invoice",
        currentStep: 1,
        totalSteps: sortedSelections.length,
        status: "IN_PROGRESS",
      },
    });

    for (const sel of sortedSelections) {
      const u = userById.get(sel.userId);
      if (!u) throw new Error(`Selected approver ${sel.userId} not found`);
      await tx.approvalInstanceStep.create({
        data: {
          instanceId: inst.id,
          stepNumber: sel.stepNumber,
          userId: u.id,
          userName: u.name,
          roleId: null,
          roleName: "",
          approvalLimitAmount: sel.approvalLimitAmount ?? null,
          isExceptionalApprover: !!sel.isExceptionalApprover,
          status: sel.stepNumber === 1 ? "PENDING" : "WAITING",
        },
      });
    }
    return inst;
  });

  const step1 = sortedSelections[0];
  await _notifyStepApprovers({
    step: { roleId: null, roleName: "", userId: step1.userId, stepNumber: 1 },
    instanceId: instance.id,
    resourceType,
    resourceTitle,
    resourceUrl,
    submitterName: submitter?.name ?? "Someone",
    entityName: entity?.name ?? "",
    stepNumber: 1,
    totalSteps: sortedSelections.length,
  });

  return {
    instanceId: instance.id,
    totalSteps: sortedSelections.length,
    message: `Approval workflow started — ${sortedSelections.length} step(s)`,
  };
}

export async function processApprovalAction(params: {
  instanceId: string;
  approverId: string;
  action: "APPROVED" | "REJECTED";
  comment?: string;
  ipAddress?: string;
}): Promise<ProcessResult> {
  const { instanceId, approverId, action, comment, ipAddress } = params;

  console.log("[WORKFLOW ENGINE EXECUTED]", { instanceId, approverId, action });

  if (!instanceId)
    throw new Error("Missing required transaction identifier: instanceId");

  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      workflow: true,
    },
  });

  if (!instance) throw new Error("Approval instance tracker record not found");
  if (instance.status !== "IN_PROGRESS") {
    throw new Error(
      `Workflow sequence execution has already been terminated or processed: ${instance.status}`,
    );
  }

  const currentStepRow = instance.steps.find(
    (s) => s.stepNumber === instance.currentStep,
  );
  if (!currentStepRow)
    throw new Error("Current step not found in workflow steps");

  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: {
      id: true,
      roleId: true,
      name: true,
      email: true,
      entityId: true,
    },
  });

  if (!approver) throw new Error("Approver user not found");

  const hasEntityAccess =
    approver.entityId === instance.entityId ||
    (await prisma.userEntity.findFirst({
      where: {
        userId: approver.id,
        entityId: instance.entityId,
      },
    }));

  const isEntitled = currentStepRow.userId
    ? approver.id === currentStepRow.userId
    : approver.roleId === currentStepRow.roleId;

  if (!isEntitled || !hasEntityAccess) {
    throw new Error("You are not authorised to approve this requisition");
  }

  if (currentStepRow.status !== "PENDING") {
    throw new Error("This step is not currently pending");
  }

  await prisma.approvalInstanceStep.update({
    where: {
      instanceId_stepNumber: { instanceId, stepNumber: instance.currentStep },
    },
    data: {
      status: action as any,
      approvedById: approverId,
      actionedAt: new Date(),
      comment,
    },
  });

  const module =
    instance.workflow?.module ?? instance.resourceType.toLowerCase();

  if (action === "REJECTED") {
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "REJECTED", completedAt: new Date() },
    });

    await _updateResourceStatus(
      instance.resourceType,
      instance.resourceId,
      "REJECTED",
      instanceId,
    );
    await _notifyRequester(
      instance,
      "REJECTED",
      instance.currentStep,
      approver.name,
      comment,
    );

    await logAudit({
      userId: approverId,
      action: `${module.toUpperCase()}_STEP_REJECTED`,
      module,
      entityId: instance.entityId,
      resourceId: instance.resourceId,
      resourceType: instance.resourceType,
      afterData: JSON.stringify({ step: instance.currentStep, comment }),
      meta: { ipAddress },
    });

    return {
      success: true,
      newInstanceStatus: "REJECTED",
      message: "Workflow rejected",
    };
  }

  const isLastStep = instance.currentStep >= instance.totalSteps;

  if (isLastStep) {
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "FULLY_APPROVED", completedAt: new Date() },
    });

    await _updateResourceStatus(
      instance.resourceType,
      instance.resourceId,
      "FULLY_APPROVED",
      instanceId,
    );
    await _notifyRequester(
      instance,
      "FULLY_APPROVED",
      instance.currentStep,
      approver.name,
      comment,
    );

    await logAudit({
      userId: approverId,
      action: `${module.toUpperCase()}_FULLY_APPROVED`,
      module,
      entityId: instance.entityId,
      resourceId: instance.resourceId,
      resourceType: instance.resourceType,
      afterData: JSON.stringify({ totalSteps: instance.totalSteps }),
      meta: { ipAddress },
    });

    return {
      success: true,
      newInstanceStatus: "FULLY_APPROVED",
      message: "Fully approved — all steps complete",
    };
  }

  const nextStep = instance.currentStep + 1;
  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data: { currentStep: nextStep },
  });
  console.log("[ADVANCING TO NEXT STEP]", {
    instanceId,
    currentStep: instance.currentStep,
    nextStep,
  });

  await prisma.$transaction([
    prisma.approvalInstance.update({
      where: { id: instanceId },
      data: {
        currentStep: nextStep,
      },
    }),

    prisma.approvalInstanceStep.update({
      where: {
        instanceId_stepNumber: {
          instanceId,
          stepNumber: nextStep,
        },
      },
      data: {
        status: "PENDING",
      },
    }),
  ]);

  const nextStepRow = instance.steps.find((s) => s.stepNumber === nextStep);
  console.log("[NEXT STEP FOUND]", nextStepRow);

  if (nextStepRow) {
    console.log("[CALLING _notifyStepApprovers]", {
      roleId: nextStepRow.roleId,
      stepNumber: nextStep,
    });

    await _notifyStepApprovers({
      step: nextStepRow,
      instanceId,
      resourceType: instance.resourceType,
      resourceTitle: `${instance.resourceType} ${instance.resourceId.slice(-8).toUpperCase()}`,
      resourceUrl: buildResourceUrl(instance.resourceType, instance.resourceId),
      submitterName: approver.name,
      entityName: "",
      stepNumber: nextStep,
      totalSteps: instance.totalSteps,
    });
  }

  await logAudit({
    userId: approverId,
    action: `${module.toUpperCase()}_STEP_APPROVED`,
    module,
    entityId: instance.entityId,
    resourceId: instance.resourceId,
    resourceType: instance.resourceType,
    afterData: JSON.stringify({ step: instance.currentStep, nextStep }),
    meta: { ipAddress },
  });

  return {
    success: true,
    newInstanceStatus: "IN_PROGRESS",
    nextStep,
    message: `Advanced to step ${nextStep}`,
  };
}

export async function getWorkflowStatus(
  resourceId: string,
  resourceType: string,
) {
  return prisma.approvalInstance.findFirst({
    where: { resourceId, resourceType },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: {
          actionedBy: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resendCurrentStepNotification(
  resourceId: string,
  resourceType: string,
): Promise<{ stepNumber: number; totalSteps: number } | null> {
  const instance = await prisma.approvalInstance.findFirst({
    where: { resourceId, resourceType, status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
    include: {
      entity: { select: { name: true } },
    },
  });
  if (!instance) return null;

  const pendingStep = await prisma.approvalInstanceStep.findFirst({
    where: { instanceId: instance.id, stepNumber: instance.currentStep, status: "PENDING" },
  });
  if (!pendingStep) return null;

  const submitter = await prisma.user.findUnique({
    where: { id: instance.requestedById },
    select: { name: true },
  });

  const resourceUrl = buildResourceUrl(resourceType, resourceId);
  const resourceTitle = `${resourceType} ${resourceId.slice(-8).toUpperCase()}`;

  await _notifyStepApprovers({
    step: {
      roleId: pendingStep.roleId,
      roleName: pendingStep.roleName,
      userId: pendingStep.userId,
      stepNumber: pendingStep.stepNumber,
    },
    instanceId: instance.id,
    resourceType,
    resourceTitle,
    resourceUrl,
    submitterName: submitter?.name ?? "Someone",
    entityName: instance.entity?.name ?? "",
    stepNumber: pendingStep.stepNumber,
    totalSteps: instance.totalSteps,
  });

  return { stepNumber: pendingStep.stepNumber, totalSteps: instance.totalSteps };
}

interface NotifyStepParams {
  step: { roleId: string | null; roleName: string; userId?: string | null; stepNumber: number };
  instanceId: string;
  resourceType: string;
  resourceTitle: string;
  resourceUrl: string;
  submitterName: string;
  entityName: string;
  stepNumber: number;
  totalSteps: number;
}

async function _notifyStepApprovers(p: NotifyStepParams): Promise<void> {

  const workflowInstance = await prisma.approvalInstance.findUnique({
    where: { id: p.instanceId },
    select: { entityId: true, resourceId: true },
  });

  const targetEntityId = workflowInstance?.entityId ?? "";

  let approvers: { id: string; name: string; email: string }[];
  if (p.step.userId) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: p.step.userId },
      select: { id: true, name: true, email: true },
    });
    approvers = assignedUser ? [assignedUser] : [];
  } else if (p.step.roleId) {
    approvers = await prisma.user.findMany({
      where: {
        roleId: p.step.roleId,
        isActive: true,
        OR: [
          { entityId: targetEntityId },
          { entityAccess: { some: { entityId: targetEntityId } } },
        ],
      },
      select: { id: true, name: true, email: true },
    });
  } else {
    console.error(
      `[_notifyStepApprovers] Step ${p.stepNumber} of instance ${p.instanceId} has neither roleId nor userId set — skipping notification.`,
    );
    approvers = [];
  }

  let invoiceEmailData: {
    invoiceNo: string; invoiceType: string; vendorName: string;
    entityCode: string; glCode: string; glName?: string; amountPayable: number; isBudgetExceeded: boolean;
    exceptionalJustification?: string;
  } | null = null;

  if (p.resourceType === "Invoice" && workflowInstance?.resourceId) {
    const invoice = await prisma.invoice
      .findUnique({
        where: { id: workflowInstance.resourceId },
        include: { entity: { select: { code: true } }, glAccount: { select: { name: true } } },
      })
      .catch(() => null);

    if (invoice) {
      invoiceEmailData = {
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoiceTypeLabel(invoice.invoiceType),
        vendorName: invoice.vendorName,
        entityCode: invoice.entity.code,
        glCode: invoice.glAccountCode,
        glName: invoice.glAccount?.name,
        amountPayable: Number(invoice.amountPayable),
        isBudgetExceeded: invoice.isBudgetExceeded,
        exceptionalJustification: invoice.exceptionalJustification ?? undefined,
      };
    }
  }

  let assetEmailData: {
    assetNo: string; assetName: string; classification: string;
    entityCode: string; branchName: string; acquisitionValue: number;
  } | null = null;

  if (p.resourceType === "Asset" && workflowInstance?.resourceId) {
    const asset = await prisma.asset
      .findUnique({
        where: { id: workflowInstance.resourceId },
        include: {
          entity: { select: { code: true } },
          branch: { select: { name: true } },
          classification: { select: { name: true } },
        },
      })
      .catch(() => null);

    if (asset) {
      assetEmailData = {
        assetNo: asset.assetNo,
        assetName: asset.name,
        classification: asset.classification?.name ?? "—",
        entityCode: asset.entity.code,
        branchName: asset.branch?.name ?? "—",
        acquisitionValue: Number(asset.acquisitionValue ?? 0),
      };
    }
  }

  for (const approver of approvers) {
    await prisma.notification.create({
      data: {
        userId: approver.id,
        type: "APPROVAL",
        title: `Approval Required — ${p.resourceType}`,
        message: `${p.submitterName} submitted "${p.resourceTitle}" for approval. You are Step ${p.stepNumber} of ${p.totalSteps}.`,
        actionUrl: p.resourceUrl,
        relatedInstanceId: p.instanceId,
      },
    });

    try {
      if (invoiceEmailData) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: approver.email,
          subject: `[Action Required] Invoice Approval — ${invoiceEmailData.invoiceNo} · ${p.entityName}`,
          react: InvoiceApprovalEmail({
            recipientName: approver.name,
            requesterName: p.submitterName,
            invoiceNo: invoiceEmailData.invoiceNo,
            invoiceType: invoiceEmailData.invoiceType,
            vendorName: invoiceEmailData.vendorName,
            entityCode: invoiceEmailData.entityCode,
            glCode: invoiceEmailData.glCode,
            glName: invoiceEmailData.glName,
            amountPayable: invoiceEmailData.amountPayable,
            eventType: invoiceEmailData.isBudgetExceeded ? "EXCEPTIONAL" : "PENDING",
            stepLabel: `Step ${p.stepNumber} of ${p.totalSteps}`,
            isBudgetExceeded: invoiceEmailData.isBudgetExceeded,
            exceptionalJustification: invoiceEmailData.exceptionalJustification,
            actionUrl: p.resourceUrl,
          }),
        })
      } else if (assetEmailData) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: approver.email,
          subject: `[Action Required] Asset Approval — ${assetEmailData.assetNo} · ${p.entityName}`,
          react: AssetApprovalEmail({
            approverName: approver.name,
            requesterName: p.submitterName,
            assetName: assetEmailData.assetName,
            assetTag: assetEmailData.assetNo,
            classification: assetEmailData.classification,
            entityCode: assetEmailData.entityCode,
            branchName: assetEmailData.branchName,
            acquisitionValue: assetEmailData.acquisitionValue,
            stepLabel: `Step ${p.stepNumber} of ${p.totalSteps}`,
            actionUrl: p.resourceUrl,
            workflowAction: "REGISTER",
          }),
        })
      } else {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: approver.email,
            subject: `[Step ${p.stepNumber}/${p.totalSteps}] Approval Required — ${p.resourceTitle}`,
            html: `
              <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E8F0">
                <div style="background:#1B2A8A;padding:24px 32px;text-align:center">
                  <div style="color:#FFB800;font-size:18px;font-weight:800">ADDOSSER ENTERPRISE HUB</div>
                  <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px">${p.resourceType} Approval</div>
                </div>
                <div style="padding:28px 32px">
                  <h2 style="color:#d97706;font-size:19px;margin:0 0 12px">Approval Required</h2>
                  <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 20px">
                    Hello <strong style="color:#1A1D2E">${approver.name}</strong>,<br/>
                    <strong>${p.submitterName}</strong> submitted <strong>${p.resourceTitle}</strong> for your approval
                    — Step ${p.stepNumber} of ${p.totalSteps}${p.entityName ? ` (${p.entityName})` : ""}.
                  </p>
                  <a href="${p.resourceUrl}" style="display:block;text-align:center;background:#FFB800;color:#1B2A8A;padding:14px 28px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;margin-bottom:16px">
                    Review &amp; Approve →
                  </a>
                  <hr style="border-color:#E4E8F0;margin:20px 0"/>
                  <p style="color:#9CA3AF;font-size:11px;margin:0">
                    Clicking the button above opens the Addosser Hub and marks this notification as read automatically.
                  </p>
                </div>
              </div>
            `,
        })
      }
    } catch (e: any) {
      console.error("[EMAIL FAILED]", {
        email: approver.email,
        error: e?.message,
        fullError: e,
      });
    }

    await prisma.approvalInstanceStep.update({
      where: {
        instanceId_stepNumber: {
          instanceId: p.instanceId,
          stepNumber: p.stepNumber,
        },
      },
      data: { notifiedAt: new Date() },
    });
  }
}

async function _notifyRequester(
  instance: any,
  outcome: "FULLY_APPROVED" | "REJECTED",
  stepNumber: number,
  approverName: string,
  comment?: string,
): Promise<void> {
  const actionUrl = buildResourceUrl(
    instance.resourceType,
    instance.resourceId,
  );
  await prisma.notification.create({
    data: {
      userId: instance.requestedById,
      type: outcome === "FULLY_APPROVED" ? "SUCCESS" : "ERROR",
      title:
        outcome === "FULLY_APPROVED"
          ? `${instance.resourceType} Approved ✅`
          : `${instance.resourceType} Rejected ❌`,
      message:
        outcome === "FULLY_APPROVED"
          ? `Your ${instance.resourceType.toLowerCase()} has been fully approved by all ${instance.totalSteps} approver(s).`
          : `Your ${instance.resourceType.toLowerCase()} was rejected at step ${stepNumber} by ${approverName}.${comment ? ` Reason: ${comment}` : ""}`,
      actionUrl,
      relatedInstanceId: instance.id,
    },
  });
}

async function _updateResourceStatus(
  resourceType: string,
  resourceId: string,
  outcome: "FULLY_APPROVED" | "REJECTED",
  instanceId?: string,
): Promise<void> {
  const status = outcome === "FULLY_APPROVED" ? "APPROVED" : "REJECTED";
  const normalizedType = resourceType.toLowerCase();

  if (normalizedType === "asset") {
    const currentAsset = await prisma.asset.findUnique({
      where: { id: resourceId },
      select: { pendingChangeInstanceId: true, pendingChanges: true },
    });
    const isRevision =
      !!instanceId &&
      currentAsset?.pendingChangeInstanceId === instanceId &&
      currentAsset.pendingChanges != null;

    if (isRevision) {
      if (outcome === "FULLY_APPROVED") {
        const patch = currentAsset!.pendingChanges as Record<string, any>;
        const DATE_FIELDS = new Set(["purchaseDate", "warrantyExpiry", "insuranceExpiry"]);
        const applyData: Record<string, any> = {};
        for (const [k, v] of Object.entries(patch)) {
          applyData[k] = DATE_FIELDS.has(k) && typeof v === "string" ? new Date(v) : v;
        }
        await prisma.asset.update({
          where: { id: resourceId },
          data: { ...applyData, pendingChanges: Prisma.JsonNull, pendingChangeInstanceId: null },
        });
      } else {
        await prisma.asset.update({
          where: { id: resourceId },
          data: { pendingChanges: Prisma.JsonNull, pendingChangeInstanceId: null },
        });
      }
      return;
    }

    await prisma.asset.update({
      where: { id: resourceId },
      data: { approvalStatus: status as any },
    });
  } else if (normalizedType === "invoice") {
    await prisma.invoice.update({
      where: { id: resourceId },
      data: {
        status: status as any,
        approvalStatus: outcome,
      },
    });
    if (outcome === "REJECTED") {
      await prisma.actualLine.deleteMany({ where: { invoiceId: resourceId } });
    }
  } else if (normalizedType === "assetmovement") {
    const movement = await prisma.assetMovement.findUnique({
      where: { id: resourceId },
    });
    if (!movement) return;

    if (outcome === "FULLY_APPROVED") {
      await prisma.$transaction([
        prisma.asset.update({
          where: { id: movement.assetId },
          data: {
            entityId: movement.toEntityId ?? undefined,
            branchId: movement.toBranchId ?? undefined,
            location: movement.toLocation ?? undefined,
          },
        }),
        prisma.assetMovement.update({
          where: { id: resourceId },
          data: { requestStatus: "COMPLETED", completedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.assetMovement.update({
        where: { id: resourceId },
        data: { requestStatus: "REJECTED" },
      });
    }
  } else if (normalizedType === "assetsplit") {
    const split = await prisma.assetSplit.findUnique({ where: { id: resourceId } });
    if (!split) return;

    if (outcome === "FULLY_APPROVED") {
      const specs = Array.isArray(split.childSpecs) ? (split.childSpecs as any[]) : [];
      await prisma.$transaction(async (tx) => {
        const { executeSplitInTransaction } = await import("@/lib/asset-split");
        await executeSplitInTransaction(
          tx,
          { id: split.id, parentAssetId: split.parentAssetId, quantitySplit: split.quantitySplit },
          specs,
        );
        await tx.assetSplit.update({
          where: { id: resourceId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      });
    } else {
      await prisma.assetSplit.update({
        where: { id: resourceId },
        data: { status: "REJECTED" },
      });
    }
  } else if (normalizedType === "assetdispose") {
    const disposal = await prisma.assetDisposal.findUnique({ where: { id: resourceId } });
    if (!disposal) return;

    if (outcome === "FULLY_APPROVED") {
      await prisma.$transaction([
        prisma.asset.update({
          where: { id: disposal.assetId },
          data:  { status: "DISPOSED", currentBookValue: 0 },
        }),
        prisma.assetDisposal.update({
          where: { id: resourceId },
          data:  { requestStatus: "COMPLETED", completedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.assetDisposal.update({
        where: { id: resourceId },
        data: { requestStatus: "REJECTED" },
      });
    }
  } else if (normalizedType === "gltransaction") {
    const { postGLCredit, rejectGLCredit } = await import("./gl-transactions");
    if (outcome === "FULLY_APPROVED") {
      await postGLCredit(resourceId);
    } else {
      await rejectGLCredit(resourceId);
    }
  } else if (normalizedType === "gljournalentry") {
    const { postJournalEntry, rejectJournalEntry } = await import("./gl-journal");
    if (outcome === "FULLY_APPROVED") {
      await postJournalEntry(resourceId);
    } else {
      await rejectJournalEntry(resourceId);
    }
  }
}
