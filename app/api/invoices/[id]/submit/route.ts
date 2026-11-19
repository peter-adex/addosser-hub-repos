import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getBaseUrl } from "@/lib/base-url";
import { createWorkflowInstanceFromSelections } from "@/lib/approval-workflow";
import { broadcastToUser } from "@/lib/sse-store";
import { FROM_EMAIL, resend } from "@/lib/resend";
import { InvoiceApprovalEmail } from "@/emails/InvoiceApprovalEmail";
import { invoiceTypeLabel } from "@/lib/invoice-type-labels";
import { formatNGN } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const appUrl = getBaseUrl();

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { name: true, code: true } },
      vendor: { select: { name: true } },
      glAccount: { select: { name: true } },
      approvalSelections: {
        orderBy: { stepNumber: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.submittedById !== userId) {
    return NextResponse.json(
      { error: "Only the submitter can submit this invoice" },
      { status: 403 },
    );
  }

  if (!["DRAFT", "RECALLED"].includes(invoice.status)) {
    return NextResponse.json(
      {
        error: `Cannot submit an invoice in "${invoice.status.replace(/_/g, " ")}" status`,
      },
      { status: 409 },
    );
  }

  const invoiceAmount = Number(invoice.totalAmount);
  const selections = invoice.approvalSelections;

  if (!selections.length) {
    return NextResponse.json(
      {
        error:
          "This invoice has no approvers selected. Please recall it and re-select approvers before submitting.",
      },
      { status: 422 },
    );
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: {
      isActive: true,
      module: { contains: "invoice" },
      entityId: invoice.entityId,
      steps: { some: {} },
    },
  });

  if (!workflow) {
    return NextResponse.json(
      {
        error:
          "No active approval workflow is configured for this entity's invoices. Ask your admin to set one up before submitting.",
      },
      { status: 422 },
    );
  }

  const limitViolations: string[] = [];
  for (const sel of selections) {
    const limit = sel.approvalLimitAmount ? Number(sel.approvalLimitAmount) : null;
    if (limit !== null && invoiceAmount > limit) {
      limitViolations.push(
        `Step ${sel.stepNumber} (${sel.user.name}): limit is ${formatNGN(limit)}, invoice is ${formatNGN(invoiceAmount)}`,
      );
    }
  }

  if (limitViolations.length > 0) {
    const rawText = await req.text().catch(() => "");
    let body: any = {};
    if (rawText.trim()) {
      try {
        body = JSON.parse(rawText);
      } catch {
        console.warn("[InvoiceSubmit] Failed to parse request body as JSON.");
      }
    }
    if (!body.acknowledgedLimitWarning) {
      return NextResponse.json(
        {
          warning: "APPROVAL_LIMIT_EXCEEDED",
          violations: limitViolations,
          message: `This invoice amount (${formatNGN(invoiceAmount)}) exceeds the approval limit of one or more selected approvers. Do you want to proceed?`,
        },
        { status: 200 },
      );
    }
  }

  const deadlockedSteps: string[] = [];
  for (const sel of selections) {
    const approverUser = await prisma.user.findFirst({
      where: {
        id: sel.userId,
        isActive: true,
        OR: [
          { entityId: invoice.entityId },
          { entityAccess: { some: { entityId: invoice.entityId } } },
        ],
      },
      select: { id: true },
    });
    if (!approverUser) {
      deadlockedSteps.push(`Step ${sel.stepNumber} (${sel.user.name})`);
    }
  }

  if (deadlockedSteps.length > 0) {
    return NextResponse.json(
      {
        error: "ENTITY_ACCESS_DENIED",
        message: `Submission Blocked: one or more selected approvers no longer have access to "${invoice.entity.name}". Please recall the invoice and re-select approvers.`,
        details: deadlockedSteps,
      },
      { status: 422 },
    );
  }

  const cancelledInstance = await prisma.approvalInstance.findFirst({
    where: { resourceId: params.id, resourceType: "Invoice", status: "CANCELLED" },
    orderBy: { createdAt: "desc" },
    include: { steps: true },
  });

  let instanceId = "";

  try {
    if (cancelledInstance) {
      await prisma.$transaction(async (tx) => {
        await tx.approvalInstance.update({
          where: { id: cancelledInstance.id },
          data: {
            workflowId: workflow.id,
            status: "IN_PROGRESS",
            currentStep: 1,
            totalSteps: selections.length,
            completedAt: null,
          },
        });

        await tx.approvalInstanceStep.deleteMany({ where: { instanceId: cancelledInstance.id } });

        for (const sel of selections) {
          await tx.approvalInstanceStep.create({
            data: {
              instanceId: cancelledInstance.id,
              stepNumber: sel.stepNumber,
              userId: sel.userId,
              userName: sel.user.name,
              roleId: null,
              roleName: "",
              approvalLimitAmount: sel.approvalLimitAmount,
              isExceptionalApprover: sel.isExceptionalApprover,
              status: sel.stepNumber === 1 ? "PENDING" : "WAITING",
            },
          });
        }

        await tx.invoice.update({
          where: { id: params.id },
          data: { status: "PENDING", approvalStatus: "IN_PROGRESS" },
        });
      });

      instanceId = cancelledInstance.id;
    } else {
      const result = await createWorkflowInstanceFromSelections({
        workflowId: workflow.id,
        entityId: invoice.entityId,
        resourceId: params.id,
        resourceType: "Invoice",
        requestedById: userId,
        selections: selections.map((s) => ({
          stepNumber: s.stepNumber,
          userId: s.userId,
          approvalLimitAmount: s.approvalLimitAmount ? Number(s.approvalLimitAmount) : null,
          isExceptionalApprover: s.isExceptionalApprover,
        })),
      });
      instanceId = result.instanceId;

      await prisma.invoice.update({
        where: { id: params.id },
        data: { status: "PENDING", approvalStatus: "IN_PROGRESS" },
      });
    }
  } catch (dbTxError: any) {
    console.error("[InvoiceSubmit] Transaction failed:", dbTxError);
    return NextResponse.json(
      {
        error: "Failed to start the approval workflow.",
        details: dbTxError?.message ?? "Unknown error",
      },
      { status: 500 },
    );
  }

  if (cancelledInstance) {
    const submitter = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const step1 = selections[0];
    const approvalPageUrl = `${appUrl}/invoice/${params.id}`;
    const emailApprovalUrl = `${appUrl}/login?callbackUrl=${encodeURIComponent(approvalPageUrl)}`;

    const notif = await prisma.notification.create({
      data: {
        userId: step1.userId,
        type: "APPROVAL",
        title: `Invoice Approval Required — Step ${step1.stepNumber}`,
        message: `${submitter?.name ?? "Someone"} submitted ${invoice.invoiceNo} (${formatNGN(invoiceAmount)}) from ${invoice.entity.name} for your approval.`,
        actionUrl: approvalPageUrl,
      },
    });

    try {
      broadcastToUser(step1.userId, "notification", {
        id: notif.id,
        type: "APPROVAL",
        title: notif.title,
        message: notif.message,
        actionUrl: approvalPageUrl,
        createdAt: notif.createdAt.toISOString(),
      });
    } catch {
    }

    try {
      const isExceeded = invoice.isBudgetExceeded ?? false;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: step1.user.email,
        subject: `[Action Required] Invoice Approval — ${invoice.invoiceNo} · ${invoice.entity.name}`,
        react: InvoiceApprovalEmail({
          recipientName: step1.user.name,
          requesterName: submitter?.name ?? "Unknown",
          invoiceNo: invoice.invoiceNo,
          invoiceType: invoiceTypeLabel(invoice.invoiceType),
          vendorName: invoice.vendor?.name ?? invoice.vendorName,
          entityCode: invoice.entity.code,
          glCode: invoice.glAccountCode,
          glName: invoice.glAccount?.name,
          amountPayable: invoiceAmount,
          eventType: isExceeded ? "EXCEPTIONAL" : "PENDING",
          stepLabel: `Step ${step1.stepNumber} of ${selections.length}`,
          isBudgetExceeded: isExceeded,
          exceptionalJustification: invoice.exceptionalJustification ?? undefined,
          actionUrl: emailApprovalUrl,
        }),
      });
    } catch (emailErr) {
      console.error("[InvoiceSubmit] Email notification failed:", emailErr);
    }
  }

  await logAudit({
    userId,
    action: "INVOICE_SUBMITTED",
    module: "invoice",
    entityId: invoice.entityId,
    resourceId: params.id,
    resourceType: "Invoice",
    afterData: JSON.stringify({
      workflowId: workflow.id,
      instanceId,
      isExceptional: invoice.isExceptionalApproval,
      approverSequence: selections.map((s) => ({ step: s.stepNumber, userId: s.userId, name: s.user.name })),
    }),
    meta: {
      limitViolations: JSON.stringify(limitViolations),
    },
  });

  return NextResponse.json({ success: true, data: { instanceId } });
}
