import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
<<<<<<< HEAD
import { requireGranularPermission } from "@/lib/permissions";
=======
import { requirePermission } from "@/lib/permissions";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
import { prisma } from "@/lib/prisma";
import { formatCompact, pct, MONTHS } from "@/lib/utils";
import { StatCard } from "@/components/shared/StatCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Badge } from "@/components/shared/Badge";
import BudgetDetailCharts from "@/components/budgeting/BudgetDetailCharts";

export const metadata: Metadata = { title: "Budget Detail" };

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
<<<<<<< HEAD
  await requireGranularPermission("budgeting", "budgets", "view");
=======
  await requirePermission("budgeting", "canView");
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const budget = await prisma.budget.findUnique({
    where: { id: params.id },
    include: {
      monthlyLines: { orderBy: { month: "asc" } },
      actualLines: { orderBy: { month: "asc" } },
      entityGL: { include: { glAccount: true, entity: true } },
      createdBy: { select: { name: true, email: true } },
      approvals: { include: { approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!budget) notFound();

  const currentMonth = new Date().getMonth() + 1;
  const ytdBudget = budget.monthlyLines.filter((l) => l.month <= currentMonth).reduce((s, l) => s + Number(l.amount), 0);
  const ytdActual = budget.actualLines.filter((l) => l.month <= currentMonth).reduce((s, l) => s + Number(l.amount), 0);

<<<<<<< HEAD
=======
  // Build monthly breakdown
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const monthlyData = MONTHS.map((monthLabel, i) => {
    const m = i + 1;
    const budgetLine = budget.monthlyLines.find((l) => l.month === m);
    const actualLines = budget.actualLines.filter((l) => l.month === m);
    const budgetAmt = Number(budgetLine?.amount ?? 0);
    const actualAmt = actualLines.reduce((s, l) => s + Number(l.amount), 0);
    return {
      month: monthLabel,
      monthNum: m,
      budget: budgetAmt,
      actual: actualAmt,
      balance: budgetAmt - actualAmt,
      utilisation: pct(actualAmt, budgetAmt),
      hasActual: actualAmt > 0,
    };
  });

  return (
    <div className="space-y-6">
<<<<<<< HEAD
=======
      {/* Breadcrumb */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/budgeting" className="hover:text-foreground transition-colors">Budgeting</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{budget.entityGL.glAccount.name}</span>
      </div>

<<<<<<< HEAD
=======
      {/* Header */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <code className="bg-muted px-2.5 py-1 rounded-lg text-sm font-bold text-[#1B2A8A] dark:text-blue-300">
              {budget.entityGL.glAccount.code}
            </code>
            <Badge variant={budget.status === "APPROVED" ? "green" : budget.status === "DRAFT" ? "gray" : "yellow"}>
              {budget.status}
            </Badge>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">{budget.entityGL.glAccount.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {budget.entityGL.entity.name} • FY {budget.financialYear} • {budget.entityGL.glAccount.category}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/budgeting/${params.id}/edit`}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-accent transition-colors"
          >
            Edit Budget
          </Link>
        </div>
      </div>

<<<<<<< HEAD
=======
      {/* KPIs */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Annual Budget" value={formatCompact(Number(budget.annualAmount))} icon="💼" color="#1B2A8A" />
        <StatCard label="YTD Budget" value={formatCompact(ytdBudget)} icon="📅" color="#FFB800" />
        <StatCard label="YTD Actual" value={formatCompact(ytdActual)} sub={`${pct(ytdActual, ytdBudget)}% utilised`} icon="💳" color={ytdActual > ytdBudget ? "#dc2626" : "#16a34a"} trend={ytdActual > ytdBudget ? "down" : "up"} />
      </div>

<<<<<<< HEAD
      <BudgetDetailCharts monthlyData={monthlyData} />

=======
      {/* Charts */}
      <BudgetDetailCharts monthlyData={monthlyData} />

      {/* Monthly table */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Monthly Breakdown — FY {budget.financialYear}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {["Month", "Budget", "Actual", "Balance", "Utilisation", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => (
                <tr key={row.monthNum} className="border-t border-border">
                  <td className="px-5 py-3.5 font-semibold text-foreground text-sm">{row.month} {budget.financialYear}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{formatCompact(row.budget)}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{row.hasActual ? formatCompact(row.actual) : "—"}</td>
                  <td className="px-5 py-3.5 text-sm">
                    {row.hasActual ? (
                      <span className={row.balance >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                        {row.balance >= 0 ? "+" : ""}{formatCompact(row.balance)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3.5 min-w-[140px]">
                    {row.hasActual ? <ProgressBar value={row.actual} max={row.budget} showLabel /> : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.monthNum > currentMonth ? (
                      <Badge variant="gray">Upcoming</Badge>
                    ) : row.hasActual ? (
                      <Badge variant={row.utilisation > 95 ? "red" : row.utilisation > 80 ? "yellow" : "green"}>
                        {row.utilisation > 95 ? "Over Budget" : row.utilisation > 80 ? "Near Limit" : "On Track"}
                      </Badge>
                    ) : (
                      <Badge variant="yellow">Pending</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

<<<<<<< HEAD
=======
      {/* Approval history */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      {budget.approvals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold text-foreground mb-4">Approval History</h2>
          <div className="space-y-3">
            {budget.approvals.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.action === "APPROVED" ? "bg-green-500" : a.action === "REJECTED" ? "bg-red-500" : "bg-yellow-500"}`} />
                <div>
                  <span className="font-semibold text-foreground">{a.approvedBy.name}</span>
                  <span className="text-muted-foreground"> {a.action.toLowerCase()} this budget</span>
                  {a.comment && <p className="text-muted-foreground italic mt-0.5">"{a.comment}"</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
