<<<<<<< HEAD
import { Metadata }                       from "next";
import Link                               from "next/link";
import { requireGranularPermission, requireAuth, hasGranularPermission } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { formatCompact }                  from "@/lib/utils";
import { Badge }                          from "@/components/shared/Badge";
import { StatCard }                       from "@/components/shared/StatCard";
import AssetExportButton                  from "@/components/assets/AssetExportButton";

export const metadata: Metadata = { title: "Asset Management" };

const CONDITION_VARIANT: Record<string, "green"|"blue"|"yellow"|"red"> = {
  EXCELLENT: "green", GOOD: "blue", FAIR: "yellow", POOR: "red", CONDEMNED: "red",
};
const STATUS_VARIANT: Record<string, "green"|"yellow"|"red"|"gray"> = {
  ACTIVE: "green", UNDER_MAINTENANCE: "yellow", DISPOSED: "red", MISSING: "red",
  DONATED: "gray", TRANSFERRED: "gray",
};
const APPROVAL_VARIANT: Record<string, "yellow"|"blue"|"green"|"red"> = {
  PENDING_APPROVAL: "yellow", IN_APPROVAL: "blue", APPROVED: "green", REJECTED: "red",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { entity?: string; branch?: string; status?: string; q?: string; approval?: string };
}) {
  await requireGranularPermission("assets", "assets", "view");
  const user = await requireAuth();
  const canCreateAsset = user.isSystem || (await hasGranularPermission("assets", "register", "create"));

  const entityFilter = searchParams.entity ?? (user.isSystem ? undefined : user.entityId);

  const where: any = {
    ...(entityFilter                   ? { entityId:       entityFilter }               : {}),
    ...(searchParams.branch            ? { branchId:       searchParams.branch }         : {}),
    ...(searchParams.status            ? { status:         searchParams.status }          : {}),
    ...(searchParams.approval          ? { approvalStatus: searchParams.approval }        : {}),
    ...(searchParams.q ? {
      OR: [
        { name:    { contains: searchParams.q } },
        { assetNo: { contains: searchParams.q } },
        { serialNo:{ contains: searchParams.q } },
      ],
    } : {}),
  };

  const [assets, totalActive, totalMaintenance, totalValue, pendingApprovals] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        entity:         { select: { name: true, code: true } },
        branch:         { select: { name: true, code: true } },
        classification: { select: { name: true, code: true } },
        assignedTo:     { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.asset.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.asset.count({ where: { ...where, status: "UNDER_MAINTENANCE" } }),
    prisma.asset.aggregate({
      where:  { ...where, status: "ACTIVE" },
      _sum:   { currentBookValue: true },
    }),
    prisma.asset.count({ where: { ...where, approvalStatus: "PENDING_APPROVAL" } }),
  ]);

  const totalBookValue = Number(totalValue._sum.currentBookValue ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Asset Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track, manage and depreciate all company assets
          </p>
        </div>
        <div className="flex gap-2">
          <AssetExportButton filters={{
            q: searchParams.q,
            status: searchParams.status,
            approval: searchParams.approval,
            entity: entityFilter,
            branch: searchParams.branch,
          }} />
          {canCreateAsset && (
            <Link href="/assets/new"
              className="px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "#FFB800", color: "#1B2A8A" }}>
              ＋ Register Asset
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Assets"       value={totalActive}                   icon="✅" color="#16a34a" />
        <StatCard label="Under Maintenance"   value={totalMaintenance}              icon="🔧" color="#d97706" />
        <StatCard label="Total Book Value"    value={formatCompact(totalBookValue)} icon="💰" color="#1B2A8A" />
        <StatCard label="Pending Approval"    value={pendingApprovals}              icon="⏳" color="#dc2626" />
      </div>

      <form method="GET"
        key={JSON.stringify(searchParams)}
        className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          placeholder="Search by name, asset no, serial no…"
          defaultValue={searchParams.q}
          className="flex-1 min-w-48 px-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
        />
        {[
          { label: "Status", key: "status", opts: ["ACTIVE","UNDER_MAINTENANCE","DISPOSED","MISSING"] },
          { label: "Approval", key: "approval", opts: ["PENDING_APPROVAL","IN_APPROVAL","APPROVED","REJECTED"] },
        ].map((f) => (
          <select key={f.key} name={f.key} defaultValue={(searchParams as any)[f.key] ?? ""}
            className="px-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]">
            <option value="">All {f.label}s</option>
            {f.opts.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
          </select>
        ))}
        <button type="submit"
          className="px-5 py-2 rounded-xl text-sm font-bold text-[#1B2A8A]"
          style={{ background: "#FFB800" }}>
          Search
        </button>
        {(searchParams.q || searchParams.status || searchParams.approval) && (
          <Link href="/assets"
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-accent">
            Clear
          </Link>
        )}
      </form>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Asset Register ({assets.length})</h2>
        </div>

        {assets.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <span className="text-5xl">🏗️</span>
            <span className="font-semibold">No assets found</span>
            {canCreateAsset && (
              <Link href="/assets/new" className="text-sm font-bold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                Register your first asset →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Asset No.","Name","Classification","Entity / Branch","Book Value",
                    "Condition","Status","Approval",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <code className="text-xs font-bold bg-muted text-[#1B2A8A] dark:text-blue-300 px-2 py-0.5 rounded">
                        {a.assetNo}
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm text-foreground">{a.name}</div>
                      {a.make && <div className="text-xs text-muted-foreground">{a.make} {a.model}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">
                      {a.classification?.name ?? <span className="italic opacity-50">Unclassified</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm font-medium text-foreground">{a.entity.code}</div>
                      <div className="text-xs text-muted-foreground">{a.branch.name}</div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-foreground">
                      {a.currentBookValue ? formatCompact(Number(a.currentBookValue)) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={CONDITION_VARIANT[a.condition] ?? "gray"}>{a.condition}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={STATUS_VARIANT[a.status] ?? "gray"}>{a.status.replace("_"," ")}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={APPROVAL_VARIANT[a.approvalStatus ?? "PENDING_APPROVAL"] ?? "gray"}>
                        {(a.approvalStatus ?? "PENDING").replace("_"," ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/assets/${a.id}`}
                        className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                        View ›
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
=======
import { Metadata } from "next";
import { requirePermission } from "@/lib/permissions";
import Link from "next/link";

export const metadata: Metadata = { title: "Asset Management" };

export default async function AssetsPage() {
  await requirePermission("assets", "canView");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Asset Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage all company assets</p>
        </div>
        <Link href="/assets/new" className="px-5 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#FFB800", color: "#1B2A8A" }}>
          ＋ Register Asset
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Assets", value: "—", icon: "🏗️", color: "#0284c7" },
          { label: "Active", value: "—", icon: "✅", color: "#16a34a" },
          { label: "Under Maintenance", value: "—", icon: "🔧", color: "#d97706" },
          { label: "Total Value", value: "₦—", icon: "💰", color: "#1B2A8A" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${s.color}18` }}>{s.icon}</div>
            <div>
              <div className="text-xl font-extrabold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <span className="text-5xl">🏗️</span>
        <span className="font-bold text-foreground">Asset Management Module</span>
        <p className="text-sm text-center max-w-md">Register and track physical assets. Costs link automatically to GL accounts in the Budgeting module.</p>
        <div className="flex gap-2 mt-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">Budget-Integrated</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800">GL Linked</span>
        </div>
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      </div>
    </div>
  );
}
