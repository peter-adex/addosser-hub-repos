import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tellerFilter = { tellerId: user.id };

    const [
      myAssigned,
      pendingProcessing,
      paidToday,
      returnedPayments,
      completedPayments,
      recentTranches,
    ] = await Promise.all([
      prisma.paymentBatch.count({
        where: { ...tellerFilter, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      }),

      prisma.paymentTranche.count({
        where: {
          paymentBatch: tellerFilter,
          status: "PENDING",
        },
      }),

      prisma.paymentTranche.count({
        where: {
          paymentBatch: tellerFilter,
          status: "PAID",
          paidAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      prisma.paymentTranche.count({
        where: {
          paymentBatch: tellerFilter,
          status: "REJECTED",
        },
      }),

      prisma.paymentBatch.count({
        where: { ...tellerFilter, status: "COMPLETED" },
      }),

      prisma.paymentBatch.findMany({
        where: { ...tellerFilter },
        orderBy: { assignedAt: "desc" },
        take: 10,
        include: {
          invoice: {
            select: {
              invoiceNo: true,
              vendorName: true,
              amountPayable: true,
              subtotal: true,
              vatAmount: true,
              whtAmount: true,
            },
          },
          entity: { select: { name: true, code: true } },
          tranches: {
            select: {
              id: true,
              trancheNumber: true,
              label: true,
              plannedAmount: true,
              status: true,
              paidAt: true,
            },
            orderBy: { trancheNumber: "asc" },
          },
        },
      }),
    ]);

    return NextResponse.json({
      myAssigned,
      pendingProcessing,
      paidToday,
      returnedPayments,
      completedPayments,
      recentBatches: recentTranches,
    });
  } catch (err: any) {
    console.error("[GET /api/payment/dashboard/teller]", err);
    return NextResponse.json({ error: "Failed to load teller dashboard" }, { status: 500 });
  }
}
