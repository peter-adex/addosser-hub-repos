import { Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const PAYMENT_CREDIT_GL_CODE = process.env.PAYMENT_CREDIT_GL_CODE ?? "2001";
const WHT_PAYABLE_GL_CODE = process.env.WHT_PAYABLE_GL_CODE ?? "2002";

async function generateJournalRef(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JNL-${year}-`;

  const count = await tx.paymentJournalEntry.count({
    where: { entryRef: { startsWith: prefix } },
  });

  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

export async function postJournalForTranche(
  trancheId: string,
  actorId: string,
  tx: Tx
) {
  const tranche = await tx.paymentTranche.findUniqueOrThrow({
    where: { id: trancheId },
    include: {
      paymentBatch: {
        include: {
          invoice: {
            include: {
              glAccount: { select: { code: true, name: true } },
              vendor: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const invoice = tranche.paymentBatch.invoice;
  const batchId = tranche.paymentBatchId;

  const batchTotal = tranche.paymentBatch.totalAmount;
  const trancheAmount = tranche.plannedAmount;

  const proportion = new Prisma.Decimal(trancheAmount).div(batchTotal);

  const grossAmount = new Prisma.Decimal(invoice.subtotal).mul(proportion);
  const vatAmount = new Prisma.Decimal(invoice.vatAmount).mul(proportion);
  const whtAmount = new Prisma.Decimal(invoice.whtAmount).mul(proportion);
  const netAmount = grossAmount.plus(vatAmount).minus(whtAmount);

  const expenseGLCode = invoice.glAccountCode;
  const expenseGLName = invoice.glAccount?.name ?? expenseGLCode;

  const creditGL = await tx.gLAccount.findFirst({
    where: { code: PAYMENT_CREDIT_GL_CODE },
    select: { name: true },
  });
  const creditGLName = creditGL?.name ?? "Bank / Accounts Payable";

  const entryRef = await generateJournalRef(tx);
  const entryDate = tranche.paidAt ?? new Date();

  const description = `Payment — ${invoice.invoiceNo} (${
    tranche.label ?? `Tranche ${tranche.trancheNumber}`
  }) — ${invoice.vendor?.name ?? invoice.vendorName}`;

  await tx.paymentJournalEntry.create({
    data: {
      paymentBatchId: batchId,
      paymentTrancheId: trancheId,
      invoiceId: invoice.id,
      entityId: tranche.paymentBatch.entityId,
      entryRef,
      entryDate,
      description,
      debitGLCode: expenseGLCode,
      debitGLName: expenseGLName,
      creditGLCode: PAYMENT_CREDIT_GL_CODE,
      creditGLName: creditGLName,
      grossAmount,
      vatAmount,
      whtAmount,
      netAmount,
      vendorName: invoice.vendor?.name ?? invoice.vendorName,
      invoiceNo: invoice.invoiceNo,
      createdById: actorId,
    },
  });

  return { entryRef, grossAmount, vatAmount, whtAmount, netAmount };
}
