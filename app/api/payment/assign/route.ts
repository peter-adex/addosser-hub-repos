import { getPaymentCaps, getPaymentCapsForRole } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentError } from "@/lib/payment";
import { notifyUsers } from "@/lib/payment-extras";
import { getBaseUrl } from "@/lib/base-url";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TrancheSchema = z.object({
  label: z.string().min(1),
  amount: z
    .number()
    .int("Amount must be a whole number — no decimals")
    .positive(),
  percentage: z.number().nullable().optional(),
});

const BodySchema = z.object({
  invoiceId: z.string().min(1),
  tellerId: z.string().min(1),
  instructions: z.string().nullable().optional(),
  tranches: z.array(TrancheSchema).min(1).max(6),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const user = session.user as any;

  const allowed =
    (await getPaymentCaps(user)).assign;
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have permission to assign payments" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.errors?.[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: body.invoiceId },
    include: {
      vendor: true,
      entity: { select: { name: true } },
      paymentBatches: { where: { status: { not: "CANCELLED" } } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (
    invoice.approvalStatus !== "FULLY_APPROVED" ||
    invoice.status !== "APPROVED"
  ) {
    return NextResponse.json(
      { error: "Invoice is not fully approved and ready for payment" },
      { status: 400 },
    );
  }
  if (invoice.paymentBatches.length > 0) {
    return NextResponse.json(
      { error: "This invoice already has an active payment assignment" },
      { status: 409 },
    );
  }

  const teller = await prisma.user.findUnique({
    where: { id: body.tellerId },
    include: { role: { include: { permissions: { include: { app: true } } } } },
  });
  if (!teller || !teller.isActive) {
    return NextResponse.json(
      { error: "Selected Teller not found or inactive" },
      { status: 400 },
    );
  }
  const tellerCanProcess = (await getPaymentCapsForRole(teller.roleId, teller.role.isSystem)).process;
  if (!tellerCanProcess) {
    return NextResponse.json(
      { error: "Selected user does not have Teller processing rights" },
      { status: 400 },
    );
  }

  const totalPayable = Math.round(parseFloat(invoice.amountPayable.toString()));

  const amountSum = body.tranches.reduce((s, t) => s + t.amount, 0);
  if (Math.abs(amountSum - totalPayable) > 1) {
    return NextResponse.json(
      {
        error: `Tranche amounts sum to ₦${amountSum.toLocaleString()} but must equal ₦${totalPayable.toLocaleString()}`,
      },
      { status: 400 },
    );
  }

  const usedPercentages = body.tranches.some(
    (t) => t.percentage != null && t.percentage > 0,
  );
  if (usedPercentages) {
    const pctSum = body.tranches.reduce((s, t) => s + (t.percentage ?? 0), 0);
    if (Math.abs(pctSum - 100) > 0.5) {
      return NextResponse.json(
        { error: `Percentages must sum to 100 (received ${pctSum})` },
        { status: 400 },
      );
    }
  }

  const isSplit = body.tranches.length > 1;

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentBatch.create({
      data: {
        invoiceId: invoice.id,
        entityId: invoice.entityId,
        assignedById: user.id,
        assignedByRoleName: user.roleName ?? "Payment Head",
        tellerId: body.tellerId,
        instructions: body.instructions ?? null,
        isSplitPayment: isSplit,
        totalAmount: totalPayable,
        status: "ASSIGNED",
      },
    });

    await tx.paymentTranche.createMany({
      data: body.tranches.map((t, i) => ({
        paymentBatchId: created.id,
        trancheNumber: i + 1,
        label:
          t.label ||
          (isSplit
            ? `Tranche ${i + 1} of ${body.tranches.length}`
            : "Full Payment"),
        plannedPercentage: t.percentage ?? null,
        plannedAmount: t.amount,
        bankName: invoice.vendor?.bankName ?? null,
        bankAccountNo: invoice.vendor?.bankAccountNo ?? null,
        bankAccountName: invoice.vendor?.bankAccountName ?? null,
      })),
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAYMENT_PROCESSING" },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT_ASSIGNED",
        module: "payment",
        entityId: invoice.entityId,
        resourceId: created.id,
        resourceType: "PaymentBatch",
        afterData: JSON.stringify({
          tellerId: body.tellerId,
          totalAmount: totalPayable,
          trancheCount: body.tranches.length,
          isSplit,
        }),
      },
    });

    await tx.notification.create({
      data: {
        userId: body.tellerId,
        type: "ALERT",
        title: "New Payment Assignment",
        message: `You've been assigned to process payment for invoice ${invoice.invoiceNo} (${invoice.vendor?.name ?? invoice.vendorName}).`,
        actionUrl: "/payment/my-tasks",
      },
    });

    return created;
  });

  try {
    const { sendPaymentAssignedEmail } = await import("@/lib/payment-emails");
    await sendPaymentAssignedEmail({
      to: teller.email,
      tellerName: teller.name,
      assignedByName: user.roleName ?? "Payment Head",
      invoiceNo: invoice.invoiceNo,
      vendorName: invoice.vendor?.name ?? invoice.vendorName,
      entityName: invoice.entity.name,
      totalAmount: totalPayable,
      trancheCount: body.tranches.length,
      instructions: body.instructions ?? undefined,
      actionUrl: `${getBaseUrl()}/payment/my-tasks`,
    });
  } catch {
  }

  try {
    const { broadcastToUser } = await import("@/lib/sse");
    broadcastToUser(body.tellerId, "notification");
  } catch {}

  return NextResponse.json({ batchId: batch.id }, { status: 201 });
}
