import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGranularPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasGranularPermission("budgeting", "budgets", "view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const financialYear = parseInt(searchParams.get("financialYear") ?? String(new Date().getFullYear()));
  const budgetType = (searchParams.get("budgetType") ?? "OPEX") as "OPEX" | "CAPEX";

  if (!entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });

  const currentDate = new Date();
  const asOfMonth = financialYear === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;

  const budgets = await prisma.budget.findMany({
    where: {
      financialYear,
      budgetType,
      entityGL: { entityId },
    },
    include: {
      monthlyLines: { orderBy: { month: "asc" } },
      actualLines: true,
      entityGL: { include: { glAccount: { select: { code: true, name: true, category: true } } } },
    },
    orderBy: { entityGL: { glAccount: { code: "asc" } } },
  });

  const rows = budgets.map((b) => {
    const monthlyBudget = Array.from({ length: 12 }, (_, i) => Number(b.monthlyLines.find((l) => l.month === i + 1)?.amount ?? 0));
    const monthlyActual = Array.from({ length: 12 }, (_, i) =>
      b.actualLines.filter((l) => l.month === i + 1).reduce((s, l) => s + Number(l.amount), 0)
    );

    let runningBudget = 0, runningActual = 0;
    const monthly = monthlyBudget.map((budget, i) => {
      const actual = monthlyActual[i];
      runningBudget += budget;
      runningActual += actual;
      const cumVariance = runningBudget - runningActual;
      return {
        month: i + 1,
        budget,
        actual,
        cumBudget: runningBudget,
        cumActual: runningActual,
        variance: cumVariance,
        variancePct: runningBudget > 0 ? parseFloat(((cumVariance / runningBudget) * 100).toFixed(1)) : 0,
      };
    });

    const ytd = monthly[asOfMonth - 1] ?? monthly[11];
    const annualBudget = monthlyBudget.reduce((s, v) => s + v, 0);

    return {
      budgetId: b.id,
      glCode: b.entityGL.glAccount.code,
      glName: b.entityGL.glAccount.name,
      category: b.entityGL.glAccount.category,
      annualBudget,
      ytdBudget: ytd.cumBudget,
      ytdActual: ytd.cumActual,
      ytdVariance: ytd.variance,
      ytdVariancePct: ytd.variancePct,
      status: ytd.variance >= 0 ? "FAVORABLE" : "UNFAVORABLE",
      monthly,
    };
  });

  const totalMonthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    budget: rows.reduce((s, r) => s + r.monthly[i].budget, 0),
    actual: rows.reduce((s, r) => s + r.monthly[i].actual, 0),
    cumBudget: rows.reduce((s, r) => s + r.monthly[i].cumBudget, 0),
    cumActual: rows.reduce((s, r) => s + r.monthly[i].cumActual, 0),
    variance: rows.reduce((s, r) => s + r.monthly[i].variance, 0),
  }));
  const totalYtd = totalMonthly[asOfMonth - 1] ?? totalMonthly[11];

  return NextResponse.json({
    success: true,
    data: {
      entityId,
      financialYear,
      budgetType,
      asOfMonth,
      rows,
      totals: {
        annualBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
        ytdBudget: totalYtd.cumBudget,
        ytdActual: totalYtd.cumActual,
        ytdVariance: totalYtd.variance,
        ytdVariancePct: totalYtd.cumBudget > 0 ? parseFloat(((totalYtd.variance / totalYtd.cumBudget) * 100).toFixed(1)) : 0,
        monthly: totalMonthly,
      },
    },
  });
}
