"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useReminders } from "@/lib/hooks/useApi"
import { PermissionGuard, usePagePermissions } from "@/components/shared/PermissionGuard"

function fmtDate(d: string) { return new Intl.DateTimeFormat("en-NG",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d)) }

function RemindersContent() {
  const router = useRouter()
  const perms = usePagePermissions("reminders")
  const [statusF, setStatusF] = useState("")

  const statusOptions = [
    { value:"",            label:"All Statuses" },
    { value:"pending",     label:"Pending"      },
    { value:"overdue",     label:"Overdue"      },
    { value:"acknowledged",label:"Acknowledged" },
    { value:"completed",   label:"Completed"    },
  ]

  const { data, loading, error } = useReminders({ status: statusF })
  const reminders = data?.items ?? []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reminders"
        subtitle={`${data?.pagination?.total ?? 0} reminders`}
        action={
          perms.canCreate ? (
            <button onClick={() => router.push("/fleet/reminders/new")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors">
              <Plus size={14}/> Add Reminder
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-3 mb-5">
        <div className="w-52">
          <SearchableSelect options={statusOptions} value={statusF} onChange={setStatusF} placeholder="Filter by status"/>
        </div>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700">{error}</div>}
      {loading && <div className="bg-card border border-border rounded-lg">{Array.from({length:4}).map((_,i)=><div key={i} className="h-12 border-b border-border/50 bg-muted/20 animate-pulse"/>)}</div>}
      {!loading && reminders.length === 0 && <EmptyState title="No reminders" description="Add reminders for insurance renewals, vehicle services, and document renewals."/>}

      {!loading && reminders.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Title","Vehicle","Type","Due Date","Status"].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reminders.map(r => (
                  <tr key={r.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${r.status==="overdue"?"bg-red-50/50 dark:bg-red-950/10":""}`}>
                    <td className="px-4 py-3 font-semibold text-foreground">{r.title}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-foreground">{r.vehicle?.plateNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{r.type.replace(/_/g," ")}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.dueDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status}/></td>
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

export default function RemindersPage() {
  return (
    <PermissionGuard module="reminders" action="canView">
      <RemindersContent />
    </PermissionGuard>
  )
}
