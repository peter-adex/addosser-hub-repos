import { Metadata } from "next";
<<<<<<< HEAD
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/permissions";
import { hasPageAccess, getUserLandingPage } from "@/lib/rbac";
=======
import { requireAuth } from "@/lib/permissions";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
import { prisma } from "@/lib/prisma";
import { formatCompact, pct, MONTHS } from "@/lib/utils";
import { StatCard } from "@/components/shared/StatCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { Badge } from "@/components/shared/Badge";
import DashboardCharts from "@/components/charts/DashboardCharts";

export const metadata: Metadata = { title: "Dashboard" };

<<<<<<< HEAD
async function getDashboardData(allowedEntityIds: string[], isSystem: boolean) {
=======
async function getDashboardData(entityId: string, isSystem: boolean) {
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [entities, budgets, assetCount, vehicleCount, invoiceCount, userCount] = await Promise.all([
<<<<<<< HEAD
    prisma.entity.findMany({ where: isSystem ? {} : { id: { in: allowedEntityIds } } }),
    prisma.budget.findMany({
      where: {
        financialYear: currentYear,
        ...(isSystem ? {} : { entityGL: { entityId: { in: allowedEntityIds } } }),
=======
    prisma.entity.findMany({ where: isSystem ? {} : { id: entityId } }),
    prisma.budget.findMany({
      where: {
        financialYear: currentYear,
        ...(isSystem ? {} : { entityGL: { entityId } }),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      },
      include: {
        monthlyLines: true,
        actualLines: true,
        entityGL: { include: { entity: true, glAccount: true } },
      },
    }),
<<<<<<< HEAD
    prisma.asset.count({ where: isSystem ? {} : { entityId: { in: allowedEntityIds } } }),
    prisma.vehicle.count({ where: isSystem ? {} : { entityId: { in: allowedEntityIds } } }),
    prisma.invoice.count({ where: isSystem ? {} : { entityId: { in: allowedEntityIds } } }),
=======
    prisma.asset.count({ where: isSystem ? {} : { entityId } }),
    prisma.vehicle.count({ where: isSystem ? {} : { entityId } }),
    prisma.invoice.count({ where: isSystem ? {} : { entityId } }),
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    prisma.user.count(),
  ]);

  const totalAnnual = budgets.reduce((s, b) => s + Number(b.annualAmount), 0);
  const ytdBudget = budgets.reduce((s, b) => {
    return s + b.monthlyLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0);
  }, 0);
  const ytdActual = budgets.reduce((s, b) => {
    return s + b.actualLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0);
  }, 0);

<<<<<<< HEAD
=======
  // Monthly trend (all months so far)
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const monthlyTrend = MONTHS.slice(0, currentMonth).map((month, i) => {
    const m = i + 1;
    const budget = budgets.reduce((s, b) => s + b.monthlyLines.filter((l) => l.month === m).reduce((a, l) => a + Number(l.amount), 0), 0);
    const actual = budgets.reduce((s, b) => s + b.actualLines.filter((l) => l.month === m).reduce((a, l) => a + Number(l.amount), 0), 0);
    return { month, budget, actual };
  });

<<<<<<< HEAD
=======
  // Entity summaries
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const entitySummaries = entities.map((ent) => {
    const entBudgets = budgets.filter((b) => b.entityGL.entityId === ent.id);
    const annual = entBudgets.reduce((s, b) => s + Number(b.annualAmount), 0);
    const ytdB = entBudgets.reduce((s, b) => s + b.monthlyLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);
    const ytdA = entBudgets.reduce((s, b) => s + b.actualLines.filter((l) => l.month <= currentMonth).reduce((a, l) => a + Number(l.amount), 0), 0);
    return { id: ent.id, name: ent.name, code: ent.code, annual, ytdBudget: ytdB, ytdActual: ytdA };
  });

  return { totalAnnual, ytdBudget, ytdActual, assetCount, vehicleCount, invoiceCount, userCount, monthlyTrend, entitySummaries, currentMonth };
}

export default async function DashboardPage() {
  const user = await requireAuth();
<<<<<<< HEAD

  if (!user.isSystem) {
    const allowed = await hasPageAccess("dashboard", "overview", "view");
    if (!allowed) {
      redirect(await getUserLandingPage());
    }
  }

  const additionalEntities = user.isSystem
    ? []
    : await prisma.userEntity.findMany({
        where: { userId: user.id },
        select: { entityId: true },
      });
  const allowedEntityIds = Array.from(
    new Set([user.entityId, ...additionalEntities.map((e) => e.entityId)])
  );

  const data = await getDashboardData(allowedEntityIds, user.isSystem);
=======
  const data = await getDashboardData(user.entityId, user.isSystem);
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
<<<<<<< HEAD
=======
      {/* Header */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">
          {greeting}, {user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening across Addosser entities — FY {new Date().getFullYear()}
        </p>
      </div>

<<<<<<< HEAD
=======
      {/* KPI Grid */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Annual Budget" value={formatCompact(data.totalAnnual)} sub="Across all entities" icon="💰" color="#1B2A8A" />
        <StatCard label="YTD Budget" value={formatCompact(data.ytdBudget)} sub={`Jan – ${MONTHS[data.currentMonth - 1]} ${new Date().getFullYear()}`} icon="📅" color="#FFB800" />
        <StatCard label="YTD Actual Spend" value={formatCompact(data.ytdActual)} sub={`${pct(data.ytdActual, data.ytdBudget)}% utilised`} icon="📈" color="#16a34a" trend={data.ytdActual > data.ytdBudget ? "down" : "up"} />
        <StatCard label="Active Assets" value={data.assetCount} sub={`${data.vehicleCount} vehicles • ${data.invoiceCount} invoices`} icon="🏗️" color="#0284c7" />
      </div>

<<<<<<< HEAD
      <DashboardCharts monthlyTrend={data.monthlyTrend} />

=======
      {/* Charts */}
      <DashboardCharts monthlyTrend={data.monthlyTrend} />

      {/* Entity Budget Table */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Entity Budget Overview</h2>
          <span className="text-xs text-muted-foreground">{data.entitySummaries.length} entities</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {["Entity", "Annual Budget", "YTD Budget", "YTD Actual", "Utilisation", "Variance"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.entitySummaries.map((ent) => {
                const variance = ent.ytdBudget - ent.ytdActual;
                const utilPct = pct(ent.ytdActual, ent.ytdBudget);
                return (
                  <tr key={ent.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground text-sm">{ent.name}</div>
                      <div className="text-xs text-muted-foreground">{ent.code}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-foreground">{formatCompact(ent.annual)}</td>
                    <td className="px-5 py-3.5 text-sm text-foreground">{formatCompact(ent.ytdBudget)}</td>
                    <td className="px-5 py-3.5 text-sm text-foreground">{formatCompact(ent.ytdActual)}</td>
                    <td className="px-5 py-3.5 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={ent.ytdActual} max={ent.ytdBudget} className="flex-1" />
                        <span className="text-xs font-bold text-muted-foreground w-8">{utilPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={variance >= 0 ? "green" : "red"}>
                        {variance >= 0 ? "+" : ""}{formatCompact(variance)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
