import { Metadata } from "next";
import Link from "next/link";
<<<<<<< HEAD
import { requireGranularPermission, requireAuth } from "@/lib/permissions";
=======
import { requirePermission, requireAuth } from "@/lib/permissions";
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";

export const metadata: Metadata = { title: "Facility Management" };

export default async function FacilityPage() {
<<<<<<< HEAD
  await requireGranularPermission("facility", "facility", "view");
=======
  await requirePermission("facility", "canView");
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
  const user = await requireAuth();

  const [facilities, workOrders] = await Promise.all([
    prisma.facility.findMany({
      where: user.isSystem ? {} : { entityId: user.entityId },
      include: {
        entity: { select: { name: true, code: true } },
        _count: { select: { workOrders: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        ...(user.isSystem ? {} : { facility: { entityId: user.entityId } }),
        status: { not: "COMPLETED" },
      },
      include: { facility: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const openCount = workOrders.filter((w) => w.status === "OPEN").length;
  const inProgressCount = workOrders.filter((w) => w.status === "IN_PROGRESS").length;
  const criticalCount = workOrders.filter((w) => w.priority === "CRITICAL").length;

  const priorityVariant: Record<string, "red" | "yellow" | "blue" | "gray"> = {
    CRITICAL: "red", HIGH: "yellow", MEDIUM: "blue", LOW: "gray",
  };
  const statusVariant: Record<string, "yellow" | "blue" | "green" | "gray"> = {
    OPEN: "yellow", IN_PROGRESS: "blue", COMPLETED: "green", CANCELLED: "gray",
  };

  return (
    <div className="space-y-6">
<<<<<<< HEAD
=======
      {/* Header */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Facility Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage facilities, work orders and maintenance costs</p>
        </div>
        <button
          className="px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          ＋ New Work Order
        </button>
      </div>

<<<<<<< HEAD
=======
      {/* KPIs */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Facilities" value={facilities.length} icon="🏢" color="#7c3aed" theme={undefined as any} />
        <StatCard label="Open Work Orders" value={openCount} icon="📋" color="#d97706" theme={undefined as any} />
        <StatCard label="In Progress" value={inProgressCount} icon="🔧" color="#0284c7" theme={undefined as any} />
        <StatCard label="Critical Issues" value={criticalCount} sub={criticalCount > 0 ? "Needs attention" : "All clear"} icon="🚨" color={criticalCount > 0 ? "#dc2626" : "#16a34a"} theme={undefined as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
<<<<<<< HEAD
=======
        {/* Facilities list */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-bold text-sm text-foreground">Facilities</div>
          {facilities.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No facilities registered</div>
          ) : (
            facilities.map((f) => (
              <div key={f.id} className="px-5 py-4 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{f.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{f.type} • {f.entity.code}</div>
                  </div>
                  <Badge variant={f.status === "Active" ? "green" : "gray"}>{f.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{f._count.workOrders} work orders</span>
                  {f.area && <span className="text-xs text-muted-foreground">{f.area} m²</span>}
                </div>
              </div>
            ))
          )}
          <div className="p-4">
            <button className="w-full py-2 rounded-xl text-xs font-semibold border-2 border-dashed border-border text-muted-foreground hover:border-[#FFB800] hover:text-[#FFB800] transition-colors">
              + Add Facility
            </button>
          </div>
        </div>

<<<<<<< HEAD
=======
        {/* Work Orders */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">Open Work Orders</span>
            <span className="text-xs text-muted-foreground">{workOrders.length} active</span>
          </div>
          {workOrders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-semibold text-sm">No open work orders</div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {workOrders.map((wo) => (
                <div key={wo.id} className="px-5 py-3.5 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{wo.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{wo.facility.name}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Badge variant={priorityVariant[wo.priority] ?? "gray"}>{wo.priority}</Badge>
                      <Badge variant={statusVariant[wo.status] ?? "gray"}>{wo.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  {wo.estimatedCost && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Est. cost: ₦{Number(wo.estimatedCost).toLocaleString()}
                      {wo.glAccountCode && <span className="ml-2">• GL: {wo.glAccountCode}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
