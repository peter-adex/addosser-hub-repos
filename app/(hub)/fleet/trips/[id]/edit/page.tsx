"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2, MapPin, AlertTriangle } from "lucide-react"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useVehicles, useDrivers, useMutation } from "@/lib/hooks/useApi"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
const REQ = <span className="text-red-500 ml-0.5">*</span>

export default function EditTripPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const { mutate, loading: saving } = useMutation()
  const { data: vehRes } = useVehicles({ limit: "200" })
  const { data: drvRes } = useDrivers({ status: "active" })

  const [loading,        setLoading]        = useState(true)
  const [trip,           setTrip]           = useState<any>(null)
  const [vehicleId,      setVehicleId]      = useState("")
  const [driverId,       setDriverId]       = useState("")
  const [startLocation,  setStartLocation]  = useState("")
  const [endLocation,    setEndLocation]    = useState("")
  const [startTime,      setStartTime]      = useState("")
  const [startOdometer,  setStartOdometer]  = useState("")
  const [purpose,        setPurpose]        = useState("")
  const [passengerCount, setPassengerCount] = useState("0")
  const [passengerNames, setPassengerNames] = useState("")
  const [saveError,      setSaveError]      = useState("")
  const [saved,          setSaved]          = useState(false)

  useEffect(() => {
    fetch(`/api/fleet/trips/${id}`, { credentials: "include" })
      .then(r => r.json()).then(d => {
        const t = d.data; if (!t) { setLoading(false); return }
        setTrip(t)
        setVehicleId(t.vehicleId ?? "")
        setDriverId(t.driverId ?? "")
        setStartLocation(t.startLocation ?? "")
        setEndLocation(t.endLocation ?? "")
        setStartTime(t.startTime ? t.startTime.slice(0, 16) : "")
        setStartOdometer(String(t.startOdometer ?? ""))
        setPurpose(t.purpose ?? "")
        setPassengerCount(String(t.passengerCount ?? 0))
        setPassengerNames(t.passengerNames ?? "")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const vehicleOptions = (vehRes?.items ?? []).map(v => ({
    value: v.id, label: v.plateNumber, sub: `${v.make} ${v.model}`,
  }))
  const driverOptions = (drvRes?.items ?? []).map(d => ({
    value: d.id, label: d.user.name, sub: d.user.email,
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError("")
    const { error } = await mutate("PUT", `/api/fleet/trips/${id}`, {
      vehicleId,
      driverId,
      startLocation:  startLocation.trim(),
      endLocation:    endLocation.trim(),
      startTime:      new Date(startTime).toISOString(),
      startOdometer:  parseFloat(startOdometer),
      purpose:        purpose || undefined,
      passengerCount: parseInt(passengerCount) || 0,
      passengerNames: passengerNames || undefined,
    })
    if (!error) { setSaved(true); setTimeout(() => router.push(`/fleet/trips/${id}`), 800) }
    else setSaveError(error ?? "Save failed")
  }

  if (loading) return (
    <div className="max-w-xl space-y-4">
      {[100, 300].map((h, i) => <div key={i} className="bg-card border border-border rounded-xl animate-pulse" style={{ height: h }}/>)}
    </div>
  )

  if (!trip) return (
    <div className="text-center py-16">
      <MapPin size={40} className="mx-auto text-muted-foreground mb-3"/>
      <p className="text-[14px] font-semibold text-foreground">Trip not found</p>
      <button onClick={() => router.push("/fleet/trips")} className="text-brand-navy hover:underline mt-2">← Back</button>
    </div>
  )

  if (trip.isLocked || trip.status !== "ongoing") return (
    <div className="max-w-xl">
      <button onClick={() => router.push(`/fleet/trips/${id}`)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Trip
      </button>
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3"/>
        <p className="text-[14px] font-semibold text-foreground mb-1">Trip cannot be edited</p>
        <p className="text-[12.5px] text-muted-foreground">Only ongoing (not yet ended/locked) trips can be edited.</p>
      </div>
    </div>
  )

  return (
    <div className="animate-fade-in max-w-xl">
      <button onClick={() => router.push(`/fleet/trips/${id}`)}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Trip
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
          <MapPin size={20} className="text-brand-navy dark:text-brand-gold"/>
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-foreground">Edit Trip</h2>
          <p className="text-[12px] text-muted-foreground">{trip.vehicle?.plateNumber} · {trip.startLocation}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Trip Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Vehicle{REQ}</label>
              <SearchableSelect options={vehicleOptions} value={vehicleId} onChange={setVehicleId} placeholder="Select vehicle"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Driver{REQ}</label>
              <SearchableSelect options={driverOptions} value={driverId} onChange={setDriverId} placeholder="Select driver"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Start Location{REQ}</label>
              <input className={INP} value={startLocation} onChange={e => setStartLocation(e.target.value)} placeholder="Start location"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Destination{REQ}</label>
              <input className={INP} value={endLocation} onChange={e => setEndLocation(e.target.value)} placeholder="End location"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Departure Time</label>
              <input type="datetime-local" className={INP} value={startTime} onChange={e => setStartTime(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Start Odometer (km){REQ}</label>
              <input type="number" min={0} className={INP} value={startOdometer} onChange={e => setStartOdometer(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Purpose</label>
              <input className={INP} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Trip purpose"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Number of Passengers</label>
              <input type="number" min={0} max={20} className={INP} value={passengerCount} onChange={e => setPassengerCount(e.target.value)}/>
            </div>
            {parseInt(passengerCount) > 0 && (
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">Passenger Names <span className="text-muted-foreground text-[10.5px]">(comma-separated, optional)</span></label>
                <input className={INP} value={passengerNames} onChange={e => setPassengerNames(e.target.value)} placeholder="e.g. John Adeyemi, Mary Okonkwo"/>
              </div>
            )}
          </div>
        </div>

        {saveError && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.push(`/fleet/trips/${id}`)}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
