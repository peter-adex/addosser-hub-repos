import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { hasGranularPermission } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PaySchema = z.object({
  paymentRef: z.string().min(1, "Payment reference is required"),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canApprove = await hasGranularPermission("invoice", "payment", "edit");
  const user = session.user as any;
  if (!canApprove && !user.isSystem) {
    return NextResponse.json(
      { error: "Forbidden — approval permission required" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = PaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { submittedBy: { select: { id: true, name: true } } },
  });

  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: `Invoice must be APPROVED before payment. Current status: ${invoice.status}`,
      },
      { status: 409 },
    );
  }

  const paidAt = parsed.data.paymentDate
    ? new Date(parsed.data.paymentDate)
    : new Date();

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      status: "PAID",
      paidAt,
      paymentRef: parsed.data.paymentRef,
    },
  });

  if (invoice.glAccountCode) {
    const existingActualLine = await prisma.actualLine.findFirst({
      where: { invoiceId: invoice.id },
    });

    if (!existingActualLine) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const entityGL = await prisma.entityGLAccount.findFirst({
        where: {
          entityId: invoice.entityId,
          glAccount: { code: invoice.glAccountCode },
        },
      });

      if (entityGL) {
        const budget = await prisma.budget.findFirst({
          where: {
            entityGLId: entityGL.id,
            financialYear: currentYear,
            budgetType: "OPEX",
            status: "APPROVED",
          },
        });

        if (budget) {
          await prisma.actualLine.create({
            data: {
              budgetId: budget.id,
              month: currentMonth,
              amount: invoice.amountPayable,
              description: `Invoice ${invoice.invoiceNo} — ${invoice.vendorName} (recorded at payment — legacy invoice)`,
              referenceNo: parsed.data.paymentRef,
              recordedAt: paidAt,
              invoiceId: invoice.id,
            },
          });
        }
      }
    }
  }

  await createNotification({
    userId: invoice.submittedById,
    title: "Invoice Paid ✅",
    message: `Invoice ${invoice.invoiceNo} has been marked as paid (Ref: ${parsed.data.paymentRef})`,
    type: "PAYMENT",
    actionUrl: `/invoice/${invoice.id}`,
  });

  await logAudit({
    userId: user.id,
    action: "INVOICE_PAID",
    module: "invoice",
    entityId: invoice.entityId,
    resourceId: invoice.id,
    resourceType: "Invoice",
    afterData: JSON.stringify({
      status: "PAID",
      paymentRef: parsed.data.paymentRef,
      paidAt,
    }),
  });

  return NextResponse.json({ success: true, data: updated });
}
