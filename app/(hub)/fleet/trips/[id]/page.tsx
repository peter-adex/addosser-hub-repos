"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ChevronLeft, MapPin, Flag, Loader2, Pencil,
  Trash2, Users, Clock, CheckCircle2,
} from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useAuth }     from "@/hooks/useAuth"

const fmtDT = (d?: string | null) => !d ? "—" :
  new Intl.DateTimeFormat("en-NG", { day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:true }).format(new Date(d))

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-border/50 last:border-0">
      <span className="text-[12px] text-muted-foreground w-44 flex-shrink-0">{label}</span>
      <span className="text-[12.5px] font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

export default function TripDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuth()
  const isDriver = !!user?.isDriver
  const canEdit  = !isDriver

  const [trip,       setTrip]       = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [endOdo,     setEndOdo]     = useState("")
  const [endTime,    setEndTime]    = useState("")
  const [ending,     setEnding]     = useState(false)
  const [endErr,     setEndErr]     = useState("")
  const [deleting,   setDeleting]   = useState(false)

  function localNow() {
    const d = new Date(), pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  useEffect(() => {
    setEndTime(localNow())
    fetch(`/api/fleet/trips/${id}`, { credentials: "include" })
      .then(r => r.json()).then(d => { setTrip(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleEndTrip(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(endOdo)
    if (isNaN(val) || val < (trip?.startOdometer ?? 0)) {
      setEndErr(`End odometer must be ≥ start (${trip?.startOdometer?.toLocaleString()} km)`)
      return
    }
    setEnding(true); setEndErr("")
    const res = await fetch(`/api/fleet/trips/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endOdometer: val, endTime: new Date(endTime).toISOString() }),
    })
    const json = await res.json()
    setEnding(false)
    if (res.ok) setTrip(json.data)
    else setEndErr(json.error ?? "Failed to end trip")
  }

  async function handleDelete() {
    if (!confirm("Delete this trip? Cannot be undone.")) return
    setDeleting(true)
    await fetch(`/api/fleet/trips/${id}`, { method: "DELETE", credentials: "include" })
    router.push("/fleet/trips")
  }

  if (loading) return (
    <div className="max-w-2xl space-y-4">
      {[120, 250].map((h, i) => <div key={i} className="bg-card border border-border rounded-xl animate-pulse" style={{ height: h }}/>)}
    </div>
  )

  if (!trip) return (
    <div className="text-center py-16">
      <MapPin size={40} className="mx-auto text-muted-foreground mb-3"/>
      <p className="text-[14px] font-semibold text-foreground mb-1">Trip not found</p>
      <button onClick={() => router.push("/fleet/trips")} className="text-[12.5px] text-brand-navy dark:text-brand-gold hover:underline">← Back</button>
    </div>
  )

  const isOngoing   = trip.status === "ongoing"
  const canEndTrip  = isOngoing && (isDriver || canEdit)
  const dist        = trip.distanceKm != null ? trip.distanceKm :
    (trip.endOdometer && trip.startOdometer) ? (trip.endOdometer - trip.startOdometer) : null

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => router.push("/fleet/trips")}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14}/> Back to Trips
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            {isOngoing && (
              <button onClick={() => router.push(`/fleet/trips/${id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium hover:bg-muted transition-colors">
                <Pencil size={13}/> Edit
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3.5 py-2 text-[12.5px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors">
              {deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>} Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-brand-navy dark:text-brand-gold"/>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{trip.vehicle?.plateNumber}</p>
              <h1 className="text-[16px] font-bold text-foreground">{trip.startLocation} → {trip.endLocation}</h1>
            </div>
          </div>
          <StatusBadge status={trip.status}/>
        </div>

        <InfoRow label="Driver"          value={trip.driver?.user?.name ?? "—"}/>
        <InfoRow label="Vehicle"         value={`${trip.vehicle?.plateNumber} (${trip.vehicle?.make} ${trip.vehicle?.model})`}/>
        <InfoRow label="Departure"       value={fmtDT(trip.startTime)}/>
        <InfoRow label="Arrival"         value={fmtDT(trip.endTime)}/>
        <InfoRow label="Start Odometer"  value={`${trip.startOdometer?.toLocaleString()} km`}/>
        <InfoRow label="End Odometer"    value={trip.endOdometer ? `${trip.endOdometer.toLocaleString()} km` : "—"}/>
        <InfoRow label="Distance"        value={dist != null ? `${Number(dist).toFixed(1)} km` : "—"}/>
        {trip.purpose && <InfoRow label="Purpose" value={trip.purpose}/>}
        <InfoRow label="Passengers"      value={trip.passengerCount ?? 0}/>
        {trip.passengerNames && <InfoRow label="Passenger Names" value={trip.passengerNames}/>}
        {trip.isLocked && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
            <CheckCircle2 size={13} className="text-emerald-500"/> Trip completed and locked
          </div>
        )}
      </div>

      {canEndTrip && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flag size={14} className="text-brand-navy dark:text-brand-gold"/>
            <p className="text-[13px] font-semibold text-foreground">End This Trip</p>
          </div>
          <p className="text-[12.5px] text-muted-foreground mb-4">
            Enter the current odometer reading to complete this trip. The trip will be locked after ending.
          </p>
          <form onSubmit={handleEndTrip} noValidate className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">Arrival Date &amp; Time</label>
                <input type="datetime-local" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  value={endTime} onChange={e => setEndTime(e.target.value)}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  End Odometer (km) * <span className="text-muted-foreground font-normal text-[10.5px]">Min: {trip.startOdometer?.toLocaleString()} km</span>
                </label>
                <input type="number" min={trip.startOdometer} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  placeholder={`≥ ${trip.startOdometer?.toLocaleString()} km`}
                  value={endOdo} onChange={e => { setEndOdo(e.target.value); setEndErr("") }}/>
                {endErr && <p className="text-[11px] text-red-500">{endErr}</p>}
              </div>
            </div>
            <button type="submit" disabled={ending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-[13px] font-semibold disabled:opacity-60 transition-colors">
              {ending ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
              {ending ? "Ending trip…" : "End & Lock Trip"}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
