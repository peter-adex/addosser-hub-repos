import { getPaymentCaps } from "@/lib/payment-access";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const RECOGNIZED_STATUSES: Record<string, string[]> = {
  APPROVED_PLUS: [
    "APPROVED",
    "PAID",
    "PAYMENT_PROCESSING",
    "PARTIALLY_PAID",
    "PAYMENT_ESCALATED",
    "PAYMENT_QUEUED",
    "OVERDUE",
    "EXCEPTIONAL",
  ],
  PAID_ONLY: ["PAID"],
  ALL_NON_DRAFT: [
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "PAID",
    "REJECTED",
    "OVERDUE",
    "EXCEPTIONAL",
    "PAYMENT_PROCESSING",
    "PARTIALLY_PAID",
    "PAYMENT_ESCALATED",
    "PAYMENT_QUEUED",
  ],
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const user = session.user as any;

    const perm = await getPaymentCaps(user);
    if (!perm.view('trial-balance') && !user.isSystem) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const allowedEntityIds = user.isSystem ? null : (user.allowedEntityIds ?? null);
    const { searchParams } = new URL(req.url);

    const entityId = searchParams.get("entityId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const statusMode = searchParams.get("statusMode") || "APPROVED_PLUS";
    const statuses = RECOGNIZED_STATUSES[statusMode] ?? RECOGNIZED_STATUSES.APPROVED_PLUS;

    const entityFilter: any = {
      ...(allowedEntityIds ? { entityId: { in: allowedEntityIds } } : {}),
      ...(entityId && entityId !== "ALL" ? { entityId } : {}),
    };

    const dateFilterField = (field: string) => {
      if (!dateFrom && !dateTo) return {};
      const range: any = {};
      if (dateFrom) range.gte = new Date(dateFrom);
      if (dateTo) range.lte = new Date(dateTo + "T23:59:59");
      return { [field]: range };
    };

    const drillSection = searchParams.get("drillSection");
    const drillGlCode = searchParams.get("drillGlCode");
    if (drillSection && drillGlCode) {
      if (drillSection === "expense") {
        const invoices = await prisma.invoice.findMany({
          where: {
            ...entityFilter,
            status: { in: statuses },
            glAccountCode: drillGlCode,
            ...dateFilterField("createdAt"),
          },
          select: {
            id: true,
            invoiceNo: true,
            vendorName: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            entity: { select: { code: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return NextResponse.json({
          rows: invoices.map((i) => ({
            id: i.id,
            ref: i.invoiceNo,
            party: i.vendorName,
            entityCode: i.entity.code,
            amount: Number(i.totalAmount),
            status: i.status,
            date: i.createdAt,
            href: `/invoice/${i.id}`,
          })),
        });
      }

      if (drillSection === "settlement") {
        const entries = await prisma.paymentJournalEntry.findMany({
          where: {
            ...entityFilter,
            ...dateFilterField("entryDate"),
            OR: [{ debitGLCode: drillGlCode }, { creditGLCode: drillGlCode }],
          },
          select: {
            id: true,
            entryRef: true,
            invoiceNo: true,
            vendorName: true,
            debitGLCode: true,
            creditGLCode: true,
            netAmount: true,
            entryDate: true,
            invoiceId: true,
            entity: { select: { code: true } },
          },
          orderBy: { entryDate: "desc" },
          take: 200,
        });
        return NextResponse.json({
          rows: entries.map((e) => ({
            id: e.id,
            ref: e.entryRef,
            party: e.vendorName,
            entityCode: e.entity.code,
            amount: Number(e.netAmount),
            status: e.debitGLCode === drillGlCode ? "DEBIT" : "CREDIT",
            date: e.entryDate,
            href: `/invoice/${e.invoiceId}`,
            note: e.invoiceNo,
          })),
        });
      }

      return NextResponse.json({ error: "Invalid drillSection" }, { status: 400 });
    }

    const invoiceWhere = {
      ...entityFilter,
      status: { in: statuses },
      ...dateFilterField("createdAt"),
    };

    const [expenseGroups, invoiceCount] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["glAccountCode"],
        where: invoiceWhere,
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.invoice.count({ where: invoiceWhere }),
    ]);

    const glCodes = expenseGroups.map((g) => g.glAccountCode);
    const glAccounts = glCodes.length
      ? await prisma.gLAccount.findMany({
          where: { code: { in: glCodes } },
          select: { code: true, name: true, category: true },
        })
      : [];
    const glByCode = new Map(glAccounts.map((g) => [g.code, g]));

    const expenseRows = expenseGroups
      .map((g) => ({
        glCode: g.glAccountCode,
        glName: glByCode.get(g.glAccountCode)?.name ?? "(Unmapped GL)",
        category: glByCode.get(g.glAccountCode)?.category ?? "—",
        debit: Number(g._sum.totalAmount ?? 0),
        count: g._count,
      }))
      .sort((a, b) => a.glCode.localeCompare(b.glCode));

    const expenseTotal = expenseRows.reduce((s, r) => s + r.debit, 0);

    const journalWhere = {
      ...entityFilter,
      ...dateFilterField("entryDate"),
    };

    const [debitGroups, creditGroups] = await Promise.all([
      prisma.paymentJournalEntry.groupBy({
        by: ["debitGLCode", "debitGLName"],
        where: journalWhere,
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.paymentJournalEntry.groupBy({
        by: ["creditGLCode", "creditGLName"],
        where: journalWhere,
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    const settlementRows = [
      ...debitGroups.map((g) => ({
        glCode: g.debitGLCode,
        glName: g.debitGLName,
        debit: Number(g._sum.netAmount ?? 0),
        credit: 0,
        count: g._count,
      })),
      ...creditGroups.map((g) => ({
        glCode: g.creditGLCode,
        glName: g.creditGLName,
        debit: 0,
        credit: Number(g._sum.netAmount ?? 0),
        count: g._count,
      })),
    ].sort((a, b) => a.glCode.localeCompare(b.glCode));

    const settlementDebitTotal = debitGroups.reduce((s, g) => s + Number(g._sum.netAmount ?? 0), 0);
    const settlementCreditTotal = creditGroups.reduce((s, g) => s + Number(g._sum.netAmount ?? 0), 0);

    const entities = await prisma.entity.findMany({
      where: {
        isActive: true,
        ...(allowedEntityIds ? { id: { in: allowedEntityIds } } : {}),
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      entities,
      expense: {
        rows: expenseRows,
        total: expenseTotal,
        invoiceCount,
      },
      settlement: {
        rows: settlementRows,
        debitTotal: settlementDebitTotal,
        creditTotal: settlementCreditTotal,
        isBalanced: Math.abs(settlementDebitTotal - settlementCreditTotal) < 0.01,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/trial-balance]", err);
    return NextResponse.json({ error: "Failed to load trial balance" }, { status: 500 });
  }
}
