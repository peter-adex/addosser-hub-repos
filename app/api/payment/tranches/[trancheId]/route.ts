import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { trancheId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.process && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const tranche = await prisma.paymentTranche.findUnique({
      where: { id: params.trancheId },
      include: {
        proofs: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            uploadedAt: true,
          },
        },
        paymentBatch: {
          include: {
            invoice: {
              include: {
                vendor: {
                  select: {
                    bankName: true,
                    bankAccountNo: true,
                    bankAccountName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tranche) {
      return NextResponse.json(
        { error: "Payment tranche not found" },
        { status: 404 },
      );
    }

    if (tranche.paymentBatch.tellerId !== user.id && !user.isSystem) {
      return NextResponse.json(
        { error: "You are not the Teller assigned to this payment" },
        { status: 403 },
      );
    }

    const serialized = {
      id: tranche.id,
      trancheNumber: tranche.trancheNumber,
      label: tranche.label,
      plannedAmount: tranche.plannedAmount.toString(),
      plannedPercentage: tranche.plannedPercentage?.toString() ?? null,
      status: tranche.status,
      paymentMethod: tranche.paymentMethod,
      transactionRef: tranche.transactionRef,
      tellerNotes: tranche.tellerNotes,
      proofs: tranche.proofs,
      paymentBatch: {
        id: tranche.paymentBatch.id,
        isSplitPayment: tranche.paymentBatch.isSplitPayment,
        totalAmount: tranche.paymentBatch.totalAmount.toString(),
        assignmentNote: tranche.paymentBatch.instructions,
        invoice: {
          id: tranche.paymentBatch.invoice.id,
          invoiceNo: tranche.paymentBatch.invoice.invoiceNo,
          vendorName: tranche.paymentBatch.invoice.vendorName,
          subtotal: tranche.paymentBatch.invoice.subtotal.toString(),
          vatAmount: tranche.paymentBatch.invoice.vatAmount.toString(),
          vatRate: tranche.paymentBatch.invoice.vatRate.toString(),
          whtAmount: tranche.paymentBatch.invoice.whtAmount.toString(),
          whtRate: tranche.paymentBatch.invoice.whtRate.toString(),
          totalAmount: tranche.paymentBatch.invoice.totalAmount.toString(),
          amountPayable: tranche.paymentBatch.invoice.amountPayable.toString(),
          description: tranche.paymentBatch.invoice.description,
          glAccountCode: tranche.paymentBatch.invoice.glAccountCode,
          vendor: tranche.paymentBatch.invoice.vendor
            ? {
                bankName: tranche.paymentBatch.invoice.vendor.bankName,
                bankAccountNo:
                  tranche.paymentBatch.invoice.vendor.bankAccountNo,
                bankAccountName:
                  tranche.paymentBatch.invoice.vendor.bankAccountName,
              }
            : null,
        },
      },
    };

    return NextResponse.json(serialized);
  } catch (err: any) {
    console.error("[GET /api/payment/tranches/[trancheId]]", err);
    return NextResponse.json(
      { error: "Failed to load payment details" },
      { status: 500 },
    );
  }
}
