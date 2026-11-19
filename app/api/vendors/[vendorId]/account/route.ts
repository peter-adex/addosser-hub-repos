import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { vendorId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const isSystem = user.isSystem === true;
    const hasPaymentView =
      (await getPaymentCaps(user)).view();

    if (!hasPaymentView) {
      return NextResponse.json(
        { error: "Access denied — you need Payment Processing view access" },
        { status: 403 },
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.vendorId },
      include: {
        entity: { select: { name: true, code: true } },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (!isSystem && vendor.entityId) {
      const allowedEntityIds: string[] = user.allowedEntityIds ?? [
        user.entityId,
      ];
      if (!allowedEntityIds.includes(vendor.entityId)) {
        return NextResponse.json(
          { error: "You do not have access to this vendor's entity" },
          { status: 403 },
        );
      }
    }

    const invoices = await prisma.invoice.findMany({
      where: { vendorId: params.vendorId },
      include: {
        paymentBatches: {
          where: { status: { not: "CANCELLED" } },
          include: {
            tranches: {
              orderBy: { trancheNumber: "asc" },
              include: {
                proofs: {
                  select: {
                    id: true,
                    fileName: true,
                    fileUrl: true,
                    uploadedAt: true,
                  },
                  orderBy: { uploadedAt: "desc" },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const invoiceSummaries = invoices.map((inv) => {
      const allTranches = inv.paymentBatches.flatMap((b) => b.tranches);

      const totalPaidNum = allTranches
        .filter((t) => t.status === "PAID")
        .reduce(
          (sum, t) => sum + Number(t.approvedAmount ?? t.plannedAmount),
          0,
        );

      const amountPayableNum = Number(inv.amountPayable);
      const outstandingNum = Math.max(0, amountPayableNum - totalPaidNum);

      const trancheDetails = allTranches.map((t) => ({
        id: t.id,
        trancheNumber: t.trancheNumber,
        label: t.label,
        plannedAmount: t.plannedAmount.toString(),
        status: t.status,
        transactionRef: t.transactionRef,
        paymentMethod: t.paymentMethod,
        paidAt: t.paidAt?.toISOString() ?? null,
        proofs: t.proofs.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          fileUrl: p.fileUrl,
          uploadedAt: p.uploadedAt.toISOString(),
        })),
      }));

      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        description: inv.description,
        subtotal: inv.subtotal.toString(),
        vatAmount: inv.vatAmount.toString(),
        whtAmount: inv.whtAmount.toString(),
        amountPayable: inv.amountPayable.toString(),
        status: inv.status,
        createdAt: inv.createdAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        totalPaid: totalPaidNum.toFixed(2),
        outstandingBalance: outstandingNum.toFixed(2),
        tranches: trancheDetails,
      };
    });

    const totalInvoicedNum = invoices
      .filter((inv) => inv.status !== "REJECTED")
      .reduce((sum, inv) => sum + Number(inv.amountPayable), 0);

    const totalPaidNum = invoiceSummaries.reduce(
      (sum, inv) => sum + parseFloat(inv.totalPaid),
      0,
    );

    const outstandingNum = Math.max(0, totalInvoicedNum - totalPaidNum);

    const fullyApprovedCount = invoiceSummaries.filter(
      (i) => i.status === "APPROVED" && parseFloat(i.totalPaid) === 0,
    ).length;

    const partialCount = invoiceSummaries.filter(
      (i) => i.status === "PARTIALLY_PAID",
    ).length;

    const paidCount = invoiceSummaries.filter(
      (i) => i.status === "PAID",
    ).length;

    const response = {
      id: vendor.id,
      name: vendor.name,
      code: vendor.code,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      bankName: vendor.bankName,
      bankAccountNo: vendor.bankAccountNo,
      bankAccountName: vendor.bankAccountName,
      entity: vendor.entity
        ? {
            name: vendor.entity.name,
            code: vendor.entity.code,
          }
        : null,

      totalInvoiced: totalInvoicedNum.toFixed(2),
      totalPaid: totalPaidNum.toFixed(2),
      outstanding: outstandingNum.toFixed(2),

      fullyApprovedCount,
      partialCount,
      paidCount,

      invoices: invoiceSummaries,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[GET /api/vendors/[vendorId]/account]", err);
    return NextResponse.json(
      { error: "Failed to load vendor account data" },
      { status: 500 },
    );
  }
}
