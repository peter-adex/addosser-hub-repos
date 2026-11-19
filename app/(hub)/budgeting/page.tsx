import { Metadata } from "next";
import Link from "next/link";
<<<<<<< HEAD
import { requireGranularPermission, requireAuth, hasGranularPermission } from "@/lib/permissions";
=======
import { requirePermission, requireAuth } from "@/lib/permissions";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
import { prisma } from "@/lib/prisma";
import { formatCompact, pct, MONTHS } from "@/lib/utils";
import { StatCard } from "@/components/shared/StatCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Badge } from "@/components/shared/Badge";
<<<<<<< HEAD
import BudgetExport from "@/components/budgeting/BudgetExport";

export const metadata: Metadata = { title: "Budgeting" };

export default async function BudgetingPage({
  searchParams,
}: {
  searchParams: { entity?: string; type?: string };
}) {
  await requireGranularPermission("budgeting", "budgets", "view");
  const user     = await requireAuth();
  const canCreate = await hasGranularPermission("budgeting", "budgets", "create");

  const year         = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const budgetType   = (searchParams.type === "CAPEX" ? "CAPEX" : "OPEX") as "OPEX" | "CAPEX";

  const entities = await prisma.entity.findMany({
    where:   { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) },
=======

export const metadata: Metadata = { title: "Budgeting" };

export default async function BudgetingPage({ searchParams }: { searchParams: { entity?: string } }) {
  await requirePermission("budgeting", "canView");
  const user = await requireAuth();

  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const entities = await prisma.entity.findMany({
    where: { isActive: true, ...(user.isSystem ? {} : { id: user.entityId }) },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    orderBy: { code: "asc" },
  });

  const activeEntityId = searchParams.entity ?? entities[0]?.id;

  const budgets = await prisma.budget.findMany({
    where: {
      financialYear: year,
<<<<<<< HEAD
      budgetType,
      entityGL: { entityId: activeEntityId, glAccount: { isActive: true } },
    },
    include: {
      monthlyLines: true,
      actualLines:  true,
      entityGL:     { include: { glAccount: true } },
=======
      entityGL: { entityId: activeEntityId },
    },
    include: {
      monthlyLines: true,
      actualLines: true,
      entityGL: { include: { glAccount: true } },
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    },
    orderBy: { entityGL: { glAccount: { code: "asc" } } },
  });

  const totalAnnual = budgets.reduce((s, b) => s + Number(b.annualAmount), 0);
<<<<<<< HEAD
  const ytdBudget   = budgets.reduce((s, b) => s + b.monthlyLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);
  const ytdActual   = budgets.reduce((s, b) => s + b.actualLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
=======
  const ytdBudget = budgets.reduce((s, b) => s + b.monthlyLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);
  const ytdActual = budgets.reduce((s, b) => s + b.actualLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Budgeting</h1>
          <p className="text-muted-foreground text-sm mt-1">GL Account budgets per entity — FY {year}</p>
        </div>
<<<<<<< HEAD
        <div className="flex gap-2">
          <BudgetExport
            entities={entities.map((e) => ({ id: e.id, name: e.name, code: e.code }))}
            isAdmin={user.isSystem}
          />
          <Link
            href="/budgeting/variance"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent transition-all"
          >
            📈 Budget vs Actual Variance
          </Link>
          {canCreate && (
            <Link
              href="/budgeting/import"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent transition-all"
            >
              📥 Import Existing Budgets
            </Link>
          )}
          {canCreate && (
            <Link
              href="/budgeting/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{ background: "#FFB800", color: "#1B2A8A" }}
            >
              ＋ New Budget Line
            </Link>
          )}
        </div>
      </div>

=======
        <Link
          href="/budgeting/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          ＋ New Budget Line
        </Link>
      </div>

      {/* Entity tabs */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="flex gap-2 flex-wrap">
        {entities.map((ent) => (
          <Link
            key={ent.id}
<<<<<<< HEAD
            href={`/budgeting?entity=${ent.id}&type=${budgetType}`}
=======
            href={`/budgeting?entity=${ent.id}`}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
            className={`px-4 py-2 rounded-xl font-semibold text-sm border transition-all ${
              activeEntityId === ent.id
                ? "bg-[#1B2A8A] text-white border-transparent"
                : "bg-card text-muted-foreground border-border hover:border-[#1B2A8A]/40"
            }`}
          >
            {ent.code}
          </Link>
        ))}
      </div>

<<<<<<< HEAD
      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl w-fit">
        {(["OPEX", "CAPEX"] as const).map((t) => (
          <Link
            key={t}
            href={`/budgeting?entity=${activeEntityId}&type=${t}`}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              budgetType === t ? "bg-[#FFB800] text-[#1B2A8A]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "OPEX" ? "🔄 OPEX" : "🏗️ CAPEX"}
          </Link>
        ))}
      </div>

      <div className={`px-4 py-3 rounded-xl text-sm border ${budgetType === "OPEX" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" : "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"}`}>
        {budgetType === "OPEX"
          ? "📊 <strong>OPEX</strong> (Operating Expenditure) — Covers ongoing costs required to run daily business operations e.g. salaries, rent, utilities, fuel, maintenance."
          : "🏗️ <strong>CAPEX</strong> (Capital Expenditure) — Investment in long-term assets with a useful life of over one year e.g. vehicles, buildings, technology, equipment."
        }
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Annual Budget" value={formatCompact(totalAnnual)} icon={budgetType === "OPEX" ? "💼" : "🏗️"} color="#1B2A8A" />
=======
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Annual Budget" value={formatCompact(totalAnnual)} icon="💼" color="#1B2A8A" />
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        <StatCard label={`YTD Budget (Jan–${MONTHS[currentMonth - 1]})`} value={formatCompact(ytdBudget)} icon="🗓️" color="#FFB800" />
        <StatCard label="YTD Actual" value={formatCompact(ytdActual)} sub={`${pct(ytdActual, ytdBudget)}% utilised`} icon="💳" color="#16a34a" trend={ytdActual > ytdBudget ? "down" : "neutral"} />
      </div>

<<<<<<< HEAD
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">
            {entities.find((e) => e.id === activeEntityId)?.name ?? ""} — {budgetType} GL Accounts
=======
      {/* GL Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">
            {entities.find((e) => e.id === activeEntityId)?.name ?? ""} — GL Accounts
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          </h2>
          <span className="text-xs text-muted-foreground">{budgets.length} accounts</span>
        </div>

        {budgets.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
<<<<<<< HEAD
            <div className="text-4xl mb-3">{budgetType === "OPEX" ? "📊" : "🏗️"}</div>
            <div className="font-semibold">No {budgetType} budgets found</div>
            {canCreate && (
              <Link href={`/budgeting/new?type=${budgetType}`} className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: "#FFB800", color: "#1B2A8A" }}>
                + Create {budgetType} Budget
              </Link>
            )}
=======
            <div className="text-4xl mb-3">📊</div>
            <div className="font-semibold">No budgets found for this entity</div>
            <p className="text-sm mt-1">Create a budget line to get started.</p>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["GL Code", "Account Name", "Category", "Annual Budget", "Monthly Avg", "YTD Budget", "YTD Actual", "Utilisation", "Status", ""].map((h) => (
<<<<<<< HEAD
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
=======
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                  ))}
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const ytdB = b.monthlyLines.filter((l) => l.month <= currentMonth).reduce((s, l) => s + Number(l.amount), 0);
                  const ytdA = b.actualLines.filter((l) => l.month <= currentMonth).reduce((s, l) => s + Number(l.amount), 0);
                  const utilPct = pct(ytdA, ytdB);
<<<<<<< HEAD
=======
                  const variant = utilPct > 95 ? "red" : utilPct > 80 ? "yellow" : "green";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                  return (
                    <tr key={b.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <code className="bg-muted px-2 py-0.5 rounded-md text-xs font-bold text-[#1B2A8A] dark:text-blue-300">
                          {b.entityGL.glAccount.code}
                        </code>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-sm text-foreground">{b.entityGL.glAccount.name}</td>
<<<<<<< HEAD
                      <td className="px-4 py-3.5"><Badge variant="blue">{b.entityGL.glAccount.category}</Badge></td>
=======
                      <td className="px-4 py-3.5">
                        <Badge variant="blue">{b.entityGL.glAccount.category}</Badge>
                      </td>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                      <td className="px-4 py-3.5 text-sm font-semibold text-foreground">{formatCompact(Number(b.annualAmount))}</td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">{formatCompact(Number(b.annualAmount) / 12)}</td>
                      <td className="px-4 py-3.5 text-sm text-foreground">{formatCompact(ytdB)}</td>
                      <td className="px-4 py-3.5 text-sm text-foreground">{formatCompact(ytdA)}</td>
<<<<<<< HEAD
                      <td className="px-4 py-3.5 min-w-[140px]"><ProgressBar value={ytdA} max={ytdB} showLabel /></td>
                      <td className="px-4 py-3.5">
                        <Badge variant={utilPct > 95 ? "red" : utilPct > 80 ? "yellow" : "green"}>
                          {utilPct > 95 ? "Over Budget" : utilPct > 80 ? "Near Limit" : "On Track"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 flex gap-2">
                        <Link href={`/budgeting/${b.id}`} className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">View</Link>
                        <Link href={`/budgeting/${b.id}/edit`} className="text-xs font-semibold text-muted-foreground hover:underline">Edit</Link>
=======
                      <td className="px-4 py-3.5 min-w-[140px]">
                        <ProgressBar value={ytdA} max={ytdB} showLabel className="w-full" />
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={variant}>
                          {utilPct > 95 ? "Over Budget" : utilPct > 80 ? "Near Limit" : "On Track"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/budgeting/${b.id}`}
                          className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline"
                        >
                          View ›
                        </Link>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
