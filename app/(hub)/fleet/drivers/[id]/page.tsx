"use client"
import { useEffect, useState }  from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ChevronLeft, Users, Pencil, Truck, Phone, Mail,
  AlertTriangle, CheckCircle, Clock, ShieldAlert, Calendar,
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useAuth }     from "@/hooks/useAuth"

const fmtDate = (d?: string | null) =>
  !d ? "—" : new Intl.DateTimeFormat("en-NG", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d))

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-border/50 last:border-0">
      <span className="text-[12px] text-muted-foreground w-44 flex-shrink-0">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground text-right">{value ?? "—"}</span>
    </div>
  )
}

function LicenseBadge({ expiryDate }: { expiryDate: string }) {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  if (days < 0)  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 text-[10.5px] font-semibold"><AlertTriangle size={9}/>Expired</span>
  if (days < 30) return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 text-[10.5px] font-semibold"><AlertTriangle size={9}/>{days}d left</span>
  if (days < 90) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[10.5px] font-semibold"><Clock size={9}/>{days}d left</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-[10.5px] font-semibold"><CheckCircle size={9}/>Valid · {days}d</span>
}

export default function DriverDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user, hasPermission } = useAuth()
  const canEdit  = hasPermission("drivers", "canEdit")

  const [driver,  setDriver]  = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/fleet/drivers/${id}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setDriver(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="max-w-2xl space-y-4">
      {[120, 280, 200].map((h, i) => <div key={i} className="bg-card border border-border rounded-xl animate-pulse" style={{ height: h }}/>)}
    </div>
  )

  if (!driver) return (
    <div className="text-center py-20">
      <Users size={44} className="mx-auto text-muted-foreground mb-3"/>
      <p className="text-[15px] font-semibold text-foreground mb-1">Driver not found</p>
      <p className="text-[12.5px] text-muted-foreground mb-4">This driver may have been removed or the link is incorrect.</p>
      <button onClick={() => router.push("/fleet/drivers")}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-navy dark:text-brand-gold hover:underline">
        <ChevronLeft size={13}/> Back to Drivers
      </button>
    </div>
  )

  const initials = driver.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  const primaryLic = driver.licenses?.find((l: any) => l.isPrimary) ?? driver.licenses?.[0]

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => router.push("/fleet/drivers")}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14}/> Back to Drivers
        </button>
        {canEdit && (
          <button onClick={() => router.push(`/fleet/drivers/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors">
            <Pencil size={13}/> Edit Driver
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4 mb-4">
          {driver.photoUrl ? (
            <img src={driver.photoUrl} alt={driver.user.name}
              className="h-16 w-16 rounded-full object-cover border-2 border-border flex-shrink-0"/>
          ) : (
            <div className="h-16 w-16 rounded-full bg-brand-navy/10 dark:bg-brand-gold/10 flex items-center justify-center text-[18px] font-bold text-brand-navy dark:text-brand-gold flex-shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-[19px] font-bold text-foreground">{driver.user.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                driver.status === "active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}>
                {driver.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1"><Mail size={11}/>{driver.user.email}</span>
              {driver.user.phone && <span className="flex items-center gap-1"><Phone size={11}/>{driver.user.phone}</span>}
            </div>
            {driver.entity && (
              <span className="mt-1.5 inline-block rounded-full bg-muted text-muted-foreground text-[10.5px] font-medium px-2 py-0.5">
                {driver.entity.name} · {driver.entity.code}
              </span>
            )}
          </div>
        </div>

        <InfoRow label="Assigned Vehicle"
          value={
            driver.assignedVehicle
              ? <span className="font-mono font-bold flex items-center gap-1"><Truck size={11}/>{driver.assignedVehicle.plateNumber}</span>
              : <span className="text-muted-foreground italic text-[11.5px]">No vehicle assigned</span>
          }
        />
        <InfoRow label="Account Email"  value={driver.user.email}/>
        <InfoRow label="Phone"          value={driver.user.phone ?? "—"}/>
        <InfoRow label="Entity"         value={driver.entity?.name ?? "—"}/>
      </div>

      {driver.licenses?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <p className="text-[13px] font-semibold text-foreground mb-3">
            Driver Licenses <span className="text-[11px] text-muted-foreground font-normal">({driver.licenses.length})</span>
          </p>
          <div className="space-y-3">
            {driver.licenses.map((lic: any) => (
              <div key={lic.id}
                className={`rounded-xl border p-4 ${lic.isPrimary ? "border-brand-navy/25 dark:border-brand-gold/25 bg-brand-navy/[0.02]" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-foreground capitalize">
                      {lic.type.replace(/_/g, " ")}
                    </p>
                    {lic.isPrimary && (
                      <span className="rounded-full bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold px-2 py-0.5 text-[9.5px] font-bold">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <LicenseBadge expiryDate={lic.expiryDate}/>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-[11.5px]">
                  <span className="text-muted-foreground">License No.</span>
                  <span className="font-mono font-semibold text-foreground">{lic.licenseNumber}</span>
                  <span className="text-muted-foreground">Issuing Authority</span>
                  <span className="text-foreground">{lic.issuingAuthority}</span>
                  {lic.issueDate && <>
                    <span className="text-muted-foreground">Issued</span>
                    <span className="text-foreground">{fmtDate(lic.issueDate)}</span>
                  </>}
                  <span className="text-muted-foreground">Expires</span>
                  <span className="text-foreground">{fmtDate(lic.expiryDate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {driver.trips?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-3">
            Recent Trips <span className="text-[11px] text-muted-foreground font-normal">({driver.trips.length})</span>
          </p>
          <div className="space-y-2">
            {driver.trips.slice(0, 5).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">{t.startLocation} → {t.endLocation}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtDate(t.startTime)} · {t.distanceKm ? `${Number(t.distanceKm).toFixed(1)} km` : "—"}
                  </p>
                </div>
                <StatusBadge status={t.status}/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
