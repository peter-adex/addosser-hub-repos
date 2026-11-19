<<<<<<< HEAD
import { redirect } from "next/navigation";

export default function FleetIndexPage() {
  redirect("/fleet/dashboard");
=======
import { Metadata } from "next";
import { requirePermission, requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCompact } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";

export const metadata: Metadata = { title: "Fleet Management" };

export default async function FleetPage() {
  await requirePermission("fleet", "canView");
  const user = await requireAuth();

  const [vehicles, recentLogs] = await Promise.all([
    prisma.vehicle.findMany({
      where: user.isSystem ? {} : { entityId: user.entityId },
      include: {
        entity: { select: { name: true, code: true } },
        fleetLogs: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { plateNo: "asc" },
    }),
    prisma.fleetLog.findMany({
      where: user.isSystem ? {} : { vehicle: { entityId: user.entityId } },
      include: {
        vehicle: { select: { plateNo: true, make: true, model: true } },
        driver: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 8,
    }),
  ]);

  const available = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const inUse = vehicles.filter((v) => v.status === "IN_USE").length;
  const maintenance = vehicles.filter((v) => v.status === "MAINTENANCE").length;
  const totalCost = recentLogs.reduce((s, l) => s + Number(l.cost ?? 0), 0);

  const statusVariant: Record<string, "green" | "blue" | "yellow" | "red"> = {
    AVAILABLE: "green", IN_USE: "blue", MAINTENANCE: "yellow", DECOMMISSIONED: "red",
  };
  const logTypeIcon: Record<string, string> = {
    FUEL: "⛽", MAINTENANCE: "🔧", REPAIR: "🛠️", TRIP: "🚗", INSPECTION: "🔍",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Fleet Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track vehicles, fuel, repairs and GL-linked costs</p>
        </div>
        <button className="px-5 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#FFB800", color: "#1B2A8A" }}>
          ＋ Add Vehicle
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Vehicles" value={vehicles.length} icon="🚗" color="#dc2626" theme={undefined as any} />
        <StatCard label="Available" value={available} icon="✅" color="#16a34a" theme={undefined as any} />
        <StatCard label="In Use" value={inUse} icon="🔵" color="#0284c7" theme={undefined as any} />
        <StatCard label="Recent Spend" value={formatCompact(totalCost)} sub="Last 8 log entries" icon="💳" color="#d97706" theme={undefined as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Vehicle Fleet Grid */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="font-bold text-foreground text-sm px-1">Fleet Vehicles ({vehicles.length})</h2>
          {vehicles.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <span className="text-4xl">🚗</span>
              <span className="font-semibold">No vehicles registered</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicles.map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-2xl p-4 hover:border-[#1B2A8A]/40 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <code className="bg-muted px-2.5 py-1 rounded-lg text-xs font-bold text-foreground">{v.plateNo}</code>
                    <Badge variant={statusVariant[v.status] ?? "gray"}>{v.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="font-semibold text-foreground text-sm">{v.make} {v.model}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{v.year} • {v.color ?? "N/A"} • {v.fuelType ?? "N/A"}</div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span>⛽ GL: {v.glAccountFuel ?? "—"}</span>
                    <span>🔧 GL: {v.glAccountRM ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Logs */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-bold text-sm text-foreground">Recent Logs</div>
          {recentLogs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No logs yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentLogs.map((log) => (
                <div key={log.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{logTypeIcon[log.type] ?? "📝"}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {log.vehicle.make} {log.vehicle.model} · {log.vehicle.plateNo}
                      </div>
                      <div className="text-xs text-muted-foreground">{log.driver.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant="gray">{log.type}</Badge>
                    <div className="text-right">
                      {log.cost ? <span className="font-semibold text-foreground">₦{Number(log.cost).toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}
                      <div className="text-muted-foreground">{new Date(log.date).toLocaleDateString("en-NG")}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 border-t border-border">
            <button className="w-full py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-accent transition-colors">
              Log New Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
