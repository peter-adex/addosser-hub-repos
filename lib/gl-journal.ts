import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { createWorkflowInstance } from "./approval-workflow";

export interface JournalLineInput {
  entityId: string;
  glAccountCode: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
  description?: string;
}

export interface CreateJournalEntryParams {
  lines: JournalLineInput[];
  description: string;
  referenceNo?: string;
  transactionDate: string;
  createdById: string;
  submit: boolean;
}

export async function createJournalEntry(params: CreateJournalEntryParams) {
  const { lines, description, referenceNo, transactionDate, createdById, submit } = params;

  if (lines.length < 2) {
    throw new Error("A journal entry needs at least one debit line and one credit line");
  }

  const totalDebit = lines.filter((l) => l.entryType === "DEBIT").reduce((s, l) => s + l.amount, 0);
  const totalCredit = lines.filter((l) => l.entryType === "CREDIT").reduce((s, l) => s + l.amount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Entry is not balanced: total debits (₦${totalDebit.toLocaleString()}) must equal total credits (₦${totalCredit.toLocaleString()})`);
  }
  if (totalDebit <= 0) {
    throw new Error("Journal entry amount must be greater than zero");
  }

  const resolvedLines: { entityId: string; glAccountId: string; entryType: "DEBIT" | "CREDIT"; amount: number; description?: string }[] = [];
  for (const line of lines) {
    const entity = await prisma.entity.findUnique({ where: { id: line.entityId } });
    if (!entity || !entity.isActive) {
      throw new Error("Entity is invalid or inactive for one of the journal lines");
    }
    const entityGL = await prisma.entityGLAccount.findFirst({
      where: { entityId: line.entityId, isActive: true, glAccount: { code: line.glAccountCode, isActive: true } },
      include: { glAccount: true },
    });
    if (!entityGL) {
      throw new Error(`GL Account "${line.glAccountCode}" is not enabled for entity "${entity.code}"`);
    }
    resolvedLines.push({
      entityId: line.entityId,
      glAccountId: entityGL.glAccountId,
      entryType: line.entryType,
      amount: line.amount,
      description: line.description,
    });
  }

  const txnDate = new Date(transactionDate);

  const journalEntry = await prisma.gLJournalEntry.create({
    data: {
      description,
      referenceNo,
      transactionDate: txnDate,
      status: "DRAFT",
      createdById,
      lines: {
        create: resolvedLines.map((l) => ({
          entityId: l.entityId,
          glAccountId: l.glAccountId,
          entryType: l.entryType,
          amount: l.amount,
          transactionDate: txnDate,
          description: l.description ?? description,
          referenceNo,
          sourceType: "MANUAL_JOURNAL",
          status: "DRAFT",
          createdById,
        })),
      },
    },
    include: { lines: true },
  });

  await logAudit({
    userId: createdById,
    action: "GL_JOURNAL_ENTRY_CREATED",
    module: "finance",
    resourceId: journalEntry.id,
    resourceType: "GLJournalEntry",
    afterData: JSON.stringify({ totalDebit, totalCredit, lineCount: resolvedLines.length }),
  });

  if (!submit) return { journalEntry, submitted: false };

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { module: "finance", action: "JOURNAL", isActive: true },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!workflow || workflow.steps.length === 0) {
    return {
      journalEntry,
      submitted: false,
      message: "Saved as draft — no active 'JOURNAL' approval workflow is configured for the finance module yet. Contact your administrator.",
    };
  }

  const instance = await createWorkflowInstance({
    workflowId: workflow.id,
    entityId: resolvedLines[0].entityId,
    resourceId: journalEntry.id,
    resourceType: "GLJournalEntry",
    requestedById: createdById,
    resourceTitle: `GL Journal Entry — ${description}`,
  });

  const updated = await prisma.gLJournalEntry.update({
    where: { id: journalEntry.id },
    data: { status: "PENDING_APPROVAL", approvalInstanceId: instance.instanceId },
  });
  await prisma.gLTransaction.updateMany({
    where: { journalEntryId: journalEntry.id },
    data: { status: "PENDING_APPROVAL" },
  });

  await logAudit({
    userId: createdById,
    action: "GL_JOURNAL_ENTRY_SUBMITTED",
    module: "finance",
    resourceId: journalEntry.id,
    resourceType: "GLJournalEntry",
    afterData: JSON.stringify({ instanceId: instance.instanceId }),
  });

  return { journalEntry: updated, submitted: true, totalSteps: instance.totalSteps };
}

export async function postJournalEntry(journalEntryId: string) {
  const entry = await prisma.gLJournalEntry.findUnique({ where: { id: journalEntryId } });
  if (!entry) return;

  const now = new Date();
  await prisma.$transaction([
    prisma.gLJournalEntry.update({ where: { id: journalEntryId }, data: { status: "POSTED", postedAt: now } }),
    prisma.gLTransaction.updateMany({ where: { journalEntryId }, data: { status: "POSTED", postedAt: now } }),
  ]);

  await logAudit({
    userId: entry.approvedById ?? entry.createdById,
    action: "GL_JOURNAL_ENTRY_POSTED",
    module: "finance",
    resourceId: journalEntryId,
    resourceType: "GLJournalEntry",
  });
}

export async function rejectJournalEntry(journalEntryId: string) {
  await prisma.$transaction([
    prisma.gLJournalEntry.update({ where: { id: journalEntryId }, data: { status: "REJECTED" } }),
    prisma.gLTransaction.updateMany({ where: { journalEntryId }, data: { status: "REJECTED" } }),
  ]);
}
