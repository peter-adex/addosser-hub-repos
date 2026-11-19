import { prisma } from "./prisma";

export async function nextJournalReference(entityId: string): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `JRN-${year}-`;

  const last = await prisma.paymentJournalEntry.findFirst({
    where:   { entityId, entryRef: { startsWith: prefix } },
    orderBy: { entryRef: "desc" },
    select:  { entryRef: true },
  });

  const seq = last
    ? parseInt(last.entryRef.replace(prefix, ""), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export async function postTrancheJournal(trancheId: string, postedById: string) {
  const tranche = await prisma.paymentTranche.findUniqueOrThrow({
    where: { id: trancheId },
    include: {
      paymentBatch: {
        include: {
          invoice: {
            include: {
              glAccount: { select: { code: true, name: true } },
              vendor:    { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const inv    = tranche.paymentBatch.invoice;
  const net    = Number(tranche.plannedAmount);
  const glCode = inv.glAccount?.code ?? inv.glAccountCode ?? "EXPENSE";
  const glName = inv.glAccount?.name ?? "Expense Account";

  const entryRef  = await nextJournalReference(tranche.paymentBatch.entityId);
  const entryDate = tranche.paidAt ?? new Date();

  return prisma.paymentJournalEntry.create({
    data: {
      entityId:         tranche.paymentBatch.entityId,
      paymentBatchId:   tranche.paymentBatchId,
      paymentTrancheId: tranche.id,
      invoiceId:        tranche.paymentBatch.invoiceId,
      entryRef,
      entryDate,
      description:  `${inv.invoiceNo} · ${inv.vendor?.name ?? inv.vendorName} · ${tranche.label ?? "Full Payment"}`,
      invoiceNo:    inv.invoiceNo,
      vendorName:   inv.vendor?.name ?? inv.vendorName,
      debitGLCode:  glCode,
      debitGLName:  glName,
      creditGLCode: "BANK",
      creditGLName: "Bank / Cash Account",
      grossAmount:  net,
      vatAmount:    0,
      whtAmount:    0,
      netAmount:    net,
      createdById:  postedById,
    },
  });
}
