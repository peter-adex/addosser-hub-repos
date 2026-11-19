import { prisma }                 from "@/lib/prisma";
import { getRoleIdsWithPageAction } from "@/lib/rbac-roles";
import { resend, FROM_EMAIL }     from "@/lib/resend";
import { getBaseUrl }             from "@/lib/base-url";
import { BudgetSubmittedEmail }   from "@/emails/BudgetSubmittedEmail";
import { broadcastToUser }        from "@/lib/sse-store";
import { formatNGN }              from "@/lib/utils";

interface BudgetNotificationParams {
  budgetId:        string;
  submitterId:     string;
  entityId:        string;
  glAccountId:     string;
  financialYear:   number;
  annualAmount:    number;
  distributionType: string;
  budgetType:      "OPEX" | "CAPEX";
  notes?:          string;
}

export async function notifyBudgetApprovers(params: BudgetNotificationParams) {
  const {
    budgetId, submitterId, entityId, glAccountId,
    financialYear, annualAmount, distributionType, budgetType,
  } = params;

  const [submitter, entityGL, entity, appUrl] = await Promise.all([
    prisma.user.findUnique({ where: { id: submitterId }, select: { name: true, email: true } }),
    prisma.entityGLAccount.findFirst({
      where: { id: glAccountId },
      include: { glAccount: true, entity: true },
    }),
    prisma.entity.findUnique({ where: { id: entityId }, select: { name: true, code: true } }),
    Promise.resolve(getBaseUrl()),
  ]);

  if (!submitter || !entityGL || !entity) {
    console.warn("[BudgetNotify] Missing reference data — skipping notifications");
    return;
  }

  const glName      = entityGL.glAccount.name;
  const glCode      = entityGL.glAccount.code;
  const glCategory  = entityGL.glAccount.category;
  const budgetUrl   = `${appUrl}/budgeting/${budgetId}`;
  const amountFmt   = formatNGN(annualAmount);

  const roleIds = await getRoleIdsWithPageAction("budgeting", "approvals", "approve");

  if (!roleIds.length) {
    console.info("[BudgetNotify] No roles are granted Budgeting → Approve Budget → Approve — no notifications sent");
    return;
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where:   { module: "budgeting", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  let step1RoleIds: string[] = roleIds;
  let totalSteps             = 1;

  if (workflow && workflow.steps.length > 0) {
    step1RoleIds = [workflow.steps[0].roleId].filter(Boolean) as string[];
    totalSteps   = workflow.steps.length;

    await prisma.approvalInstance.create({
      data: {
        workflowId:    workflow.id,
        entityId,
        resourceId:    budgetId,
        resourceType:  "Budget",
        requestedById: submitterId,
        currentStep:   1,
        totalSteps,
        status:        "IN_PROGRESS",
        module:        workflow.module || "budgeting",
        steps: {
          create: workflow.steps.map((step, idx) => ({
            stepNumber:  step.stepNumber,
            roleId:      step.roleId,
            roleName:    step.roleName,
            status:      "PENDING",
          })),
        },
      },
    });
  }

  const approvers = await prisma.user.findMany({
    where: {
      roleId:   { in: step1RoleIds },
      isActive: true,
      OR: [{ entityId }, { role: { isSystem: true } }],
    },
    select: {
      id:       true,
      name:     true,
      email:    true,
      roleId:   true,
      role:     { select: { name: true } },
    },
  });

  if (!approvers.length) {
    console.info("[BudgetNotify] No active users found for approver roles — no notifications sent");
    return;
  }

  const stepNumber = 1;

  for (const approver of approvers) {
    const notification = await prisma.notification.create({
      data: {
        userId:    approver.id,
        type:      "APPROVAL",
        title:     `Budget Approval Required — ${budgetType}`,
        message:   `${submitter.name} submitted a ${budgetType} budget of ${amountFmt} for ${glCode} ${glName} (${entity.name}) · FY ${financialYear}. Step ${stepNumber} of ${totalSteps} — your approval is needed.`,
        actionUrl: budgetUrl,
      },
    });

    try {
      broadcastToUser(approver.id, "notification", {
        id:      notification.id,
        type:    notification.type,
        title:   notification.title,
        message: notification.message,
        module:  "budgeting",
        budgetId,
        createdAt: notification.createdAt.toISOString(),
      });
    } catch (e) {
      console.debug("[BudgetNotify] SSE broadcast skipped (user not connected):", e);
    }

    try {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      approver.email,
        subject: `[Action Required] ${budgetType} Budget Approval — ${glCode} ${glName} · ${entity.name}`,
        react:   BudgetSubmittedEmail({
          approverName:     approver.name,
          submitterName:    submitter.name,
          budgetType,
          entityName:       entity.name,
          glCode,
          glName,
          glCategory,
          financialYear,
          annualAmount:     amountFmt,
          distributionType,
          stepNumber,
          totalSteps,
          budgetUrl,
        }),
      });

      console.info(`[BudgetNotify] Email sent to ${approver.email} (${approver.role.name})`);
    } catch (emailErr) {
      console.error(`[BudgetNotify] Email failed for ${approver.email}:`, emailErr);
    }
  }

  await prisma.notification.create({
    data: {
      userId:    submitterId,
      type:      "SUCCESS",
      title:     `${budgetType} Budget Submitted`,
      message:   `Your ${budgetType} budget of ${amountFmt} for ${glCode} ${glName} (FY ${financialYear}) has been sent to ${approvers.length} approver${approvers.length !== 1 ? "s" : ""} for review.`,
      actionUrl: budgetUrl,
      module:    "budgeting",
    },
  });

  try {
    broadcastToUser(submitterId, "notification", {
      type:    "BUDGET_SUBMITTED_CONFIRMATION",
      title:   `${budgetType} Budget Submitted`,
      message: `Sent for approval — awaiting ${approvers.length} approver${approvers.length !== 1 ? "s" : ""}.`,
      budgetId,
    });
  } catch { }

  console.info(
    `[BudgetNotify] ✅ Notified ${approvers.length} approver(s) for budget ${budgetId}`
  );
}
