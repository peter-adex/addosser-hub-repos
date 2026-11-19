"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useMaintenance, useVehicles } from "@/lib/hooks/useApi"
import { PermissionGuard, usePagePermissions } from "@/components/shared/PermissionGuard"

function fmt(n: number) { return "₦" + Math.round(n).toLocaleString("en-NG") }
function fmtDate(d: string) { return new Intl.DateTimeFormat("en-NG",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d)) }

function MaintenanceContent() {
  const router = useRouter()
  const perms = usePagePermissions("maintenance")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo,   setDateTo]   = useState("")
  const [vehicleId, setVehicleId] = useState("")

  const { data: vRes } = useVehicles({ limit:"200" })
  const { data, loading, error } = useMaintenance({ dateFrom, dateTo })
  const records = data?.items ?? []

  const vehicleOptions = [
    { value:"", label:"All Vehicles" },
    ...(vRes?.items ?? []).map(v => ({ value:v.id, label:v.plateNumber, sub:`${v.make} ${v.model}` })),
  ]

  const total = records.reduce((s,r) => s + r.costNgn, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Maintenance"
        subtitle={`${data?.pagination?.total ?? 0} records · Total: ${fmt(total)}`}
        action={
          perms.canCreate ? (
            <button onClick={() => router.push("/fleet/maintenance/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors">
              <Plus size={14}/> Add Record
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="w-64">
          <SearchableSelect options={vehicleOptions} value={vehicleId} onChange={setVehicleId} placeholder="Filter by vehicle"/>
        </div>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30"/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30"/>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{error}</div>}
      {loading && <div className="bg-card border border-border rounded-lg">{Array.from({length:4}).map((_,i)=><div key={i} className="h-12 border-b border-border/50 bg-muted/20 animate-pulse"/>)}</div>}
      {!loading && records.length === 0 && <EmptyState title="No maintenance records" description="Log your first maintenance record to start tracking vehicle upkeep."/>}

      {!loading && records.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Date","Vehicle","Type","Description","Cost","Next Due","Vendor"].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.filter(r => !vehicleId || r.vehicleId === vehicleId).map(r => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground text-[11.5px]">{r.vehicle?.plateNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.description ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{fmt(r.costNgn)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.nextDueDate ? fmtDate(r.nextDueDate) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.vendor?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MaintenancePage() {
  return (
    <PermissionGuard module="maintenance" action="canView">
      <MaintenanceContent />
    </PermissionGuard>
  )
}
