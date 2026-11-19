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
    if (!perm.assign && !perm.approve && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allowedEntityIds: string[] = user.isSystem
      ? (await prisma.entity.findMany({ select: { id: true } })).map(
          (e) => e.id,
        )
      : (user.allowedEntityIds ?? [user.entityId]);

    const entityFilter = { entityId: { in: allowedEntityIds } };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      awaitingAssignment,
      assignedPayments,
      paidTodayBatches,
      pendingEscalations,
      totalPendingTranches,
      trendRaw,
      statusCounts,
    ] = await Promise.all([
      prisma.invoice.count({
        where: { ...entityFilter, status: "PAYMENT_QUEUED" },
      }),

      prisma.paymentBatch.count({
        where: { ...entityFilter, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      }),

      prisma.paymentTranche.count({
        where: {
          paymentBatch: entityFilter,
          status: "PAID",
          paidAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      prisma.paymentEscalation.count({
        where: {
          invoice: entityFilter,
          status: "OPEN",
        },
      }),

      prisma.paymentTranche.aggregate({
        where: {
          paymentBatch: entityFilter,
          status: { in: ["PENDING", "SUBMITTED"] },
        },
        _sum: { plannedAmount: true },
      }),

      prisma.$queryRaw<{ month: string; paid: number; outstanding: number }[]>`
        SELECT
          DATE_FORMAT(pt.paidAt, '%b %Y') AS month,
          SUM(CASE WHEN pt.status = 'PAID' THEN pt.plannedAmount ELSE 0 END) AS paid,
          SUM(CASE WHEN pt.status IN ('PENDING','SUBMITTED') THEN pt.plannedAmount ELSE 0 END) AS outstanding
        FROM payment_tranches pt
        JOIN payment_batches pb ON pt.paymentBatchId = pb.id
        WHERE pb.entityId IN (${allowedEntityIds.join(",")})
          AND pt.createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(pt.paidAt, '%b %Y')
        ORDER BY MIN(pt.createdAt)
      `,

      prisma.paymentTranche.groupBy({
        by: ["status"],
        where: { paymentBatch: entityFilter },
        _count: { status: true },
      }),
    ]);

    const STATUS_COLOURS: Record<string, string> = {
      PENDING: "#FFB800",
      SUBMITTED: "#1B2A8A",
      PAID: "#16a34a",
      REJECTED: "#dc2626",
    };

    return NextResponse.json({
      awaitingAssignment,
      assignedPayments,
      paidToday: paidTodayBatches,
      pendingEscalations,
      totalPendingAmount: Number(totalPendingTranches._sum.plannedAmount ?? 0),
      trendData: trendRaw,
      statusBreakdown: statusCounts.map((s) => ({
        name: s.status,
        value: s._count.status,
        colour: STATUS_COLOURS[s.status] ?? "#6B7280",
      })),
    });
  } catch (err: any) {
    console.error("[GET /api/payment/dashboard/head]", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 },
    );
  }
}
