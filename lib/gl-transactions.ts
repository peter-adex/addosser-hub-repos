import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { createWorkflowInstance } from "./approval-workflow";

export interface CreateCreditParams {
  entityId: string;
  glAccountCode: string;
  amount: number;
  transactionDate: string;
  description: string;
  referenceNo?: string;
  attachmentUrl?: string;
  createdById: string;
  submit: boolean;
}

export async function postInvoiceDebit(params: {
  entityId: string;
  glAccountId: string;
  amount: number;
  invoiceId: string;
  invoiceNo: string;
  vendorName: string;
  createdById: string;
  transactionDate?: Date;
  assetId?: string | null;
}) {
  const { entityId, glAccountId, amount, invoiceId, invoiceNo, vendorName, createdById, assetId } = params;
  const transactionDate = params.transactionDate ?? new Date();

  return prisma.gLTransaction.create({
    data: {
      entityId,
      glAccountId,
      entryType: "DEBIT",
      amount,
      transactionDate,
      description: `Invoice ${invoiceNo} — ${vendorName}`,
      sourceType: "INVOICE",
      sourceId: invoiceId,
      invoiceId,
      assetId: assetId ?? null,
      status: "POSTED",
      createdById,
      postedAt: transactionDate,
    },
  });
}

export async function createManualCredit(params: CreateCreditParams) {
  const { entityId, glAccountCode, amount, transactionDate, description, referenceNo, attachmentUrl, createdById, submit } = params;

  if (amount <= 0) throw new Error("Credit amount must be greater than zero");

  const entityGL = await prisma.entityGLAccount.findFirst({
    where: { entityId, isActive: true, glAccount: { code: glAccountCode, isActive: true } },
    include: { glAccount: true },
  });
  if (!entityGL) {
    throw new Error(`GL Account "${glAccountCode}" is not enabled for this entity`);
  }

  const txn = await prisma.gLTransaction.create({
    data: {
      entityId,
      glAccountId: entityGL.glAccountId,
      entryType: "CREDIT",
      amount,
      transactionDate: new Date(transactionDate),
      description,
      referenceNo,
      attachmentUrl,
      sourceType: "MANUAL_CREDIT",
      status: "DRAFT",
      createdById,
    },
  });

  await logAudit({
    userId: createdById,
    action: "GL_CREDIT_CREATED",
    module: "finance",
    entityId,
    resourceId: txn.id,
    resourceType: "GLTransaction",
    afterData: JSON.stringify({ glAccountCode, amount, transactionDate }),
  });

  if (!submit) return { transaction: txn, submitted: false };

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { module: "finance", action: "CREDIT", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    return {
      transaction: txn,
      submitted: false,
      message: "Saved as draft — no active 'CREDIT' approval workflow is configured for the finance module yet. Contact your administrator.",
    };
  }

  const instance = await createWorkflowInstance({
    workflowId: workflow.id,
    entityId,
    resourceId: txn.id,
    resourceType: "GLTransaction",
    requestedById: createdById,
    resourceTitle: `GL Credit — ${entityGL.glAccount.code} (${entityGL.glAccount.name})`,
  });

  const updated = await prisma.gLTransaction.update({
    where: { id: txn.id },
    data: { status: "PENDING_APPROVAL", approvalInstanceId: instance.instanceId },
  });

  await logAudit({
    userId: createdById,
    action: "GL_CREDIT_SUBMITTED",
    module: "finance",
    entityId,
    resourceId: txn.id,
    resourceType: "GLTransaction",
    afterData: JSON.stringify({ instanceId: instance.instanceId }),
  });

  return { transaction: updated, submitted: true, totalSteps: instance.totalSteps };
}

export async function postGLCredit(transactionId: string) {
  const txn = await prisma.gLTransaction.findUnique({ where: { id: transactionId } });
  if (!txn) return;

  const financialYear = txn.transactionDate.getFullYear();
  const month = txn.transactionDate.getMonth() + 1;

  const entityGL = await prisma.entityGLAccount.findFirst({
    where: { entityId: txn.entityId, glAccountId: txn.glAccountId },
  });

  let budget = null;
  if (entityGL) {
    budget = await prisma.budget.findFirst({
      where: { entityGLId: entityGL.id, financialYear, budgetType: "OPEX", status: { in: ["APPROVED", "ACTIVE"] } },
    });
  }

  if (budget) {
    const actualLine = await prisma.actualLine.create({
      data: {
        budgetId: budget.id,
        month,
        amount: -Math.abs(Number(txn.amount)),
        description: `GL Credit offset — ${txn.description ?? ""}`.trim(),
        referenceNo: txn.referenceNo,
      },
    });
    await prisma.gLTransaction.update({
      where: { id: transactionId },
      data: { status: "POSTED", postedAt: new Date(), linkedActualLineId: actualLine.id },
    });
  } else {
    await prisma.gLTransaction.update({
      where: { id: transactionId },
      data: { status: "POSTED", postedAt: new Date() },
    });
  }

  await logAudit({
    userId: txn.approvedById ?? txn.createdById,
    action: "GL_CREDIT_POSTED",
    module: "finance",
    entityId: txn.entityId,
    resourceId: transactionId,
    resourceType: "GLTransaction",
  });
}

export async function rejectGLCredit(transactionId: string) {
  await prisma.gLTransaction.update({
    where: { id: transactionId },
    data: { status: "REJECTED" },
  });
}

export async function getGLAccountLedger(
  glAccountId: string,
  entityId?: string,
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    entryType?: "DEBIT" | "CREDIT";
    sourceType?: string;
    referenceNo?: string;
  },
) {
  const transactions = await prisma.gLTransaction.findMany({
    where: {
      glAccountId,
      ...(entityId ? { entityId } : {}),
      ...(filters?.dateFrom || filters?.dateTo
        ? { transactionDate: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
        : {}),
      ...(filters?.entryType ? { entryType: filters.entryType } : {}),
      ...(filters?.sourceType ? { sourceType: filters.sourceType } : {}),
      ...(filters?.referenceNo ? { referenceNo: { contains: filters.referenceNo } } : {}),
    },
    orderBy: { transactionDate: "asc" },
    include: {
      entity: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });

  let runningBalance = 0;
  if (filters?.dateFrom) {
    const [debitSum, creditSum] = await Promise.all([
      prisma.gLTransaction.aggregate({
        where: { glAccountId, ...(entityId ? { entityId } : {}), status: "POSTED", entryType: "DEBIT", transactionDate: { lt: filters.dateFrom } },
        _sum: { amount: true },
      }),
      prisma.gLTransaction.aggregate({
        where: { glAccountId, ...(entityId ? { entityId } : {}), status: "POSTED", entryType: "CREDIT", transactionDate: { lt: filters.dateFrom } },
        _sum: { amount: true },
      }),
    ]);
    runningBalance = Number(debitSum._sum.amount ?? 0) - Number(creditSum._sum.amount ?? 0);
  }
  const openingBalance = runningBalance;

  const rows = transactions.map((t) => {
    const isPosted = t.status === "POSTED";
    if (isPosted) {
      runningBalance += t.entryType === "DEBIT" ? Number(t.amount) : -Number(t.amount);
    }
    return { ...t, balance: isPosted ? runningBalance : null };
  });

  const totalDebit = transactions.filter((t) => t.status === "POSTED" && t.entryType === "DEBIT").reduce((s, t) => s + Number(t.amount), 0);
  const totalCredit = transactions.filter((t) => t.status === "POSTED" && t.entryType === "CREDIT").reduce((s, t) => s + Number(t.amount), 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    netBalance: totalDebit - totalCredit,
    transactionCount: transactions.length,
    openingBalance,
  };
}
