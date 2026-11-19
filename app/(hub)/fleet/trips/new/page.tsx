"use client"
import { useState, useEffect } from "react"
import { useRouter }           from "next/navigation"
import { ChevronLeft, Save, Loader2, MapPin, Users, AlertTriangle, CheckCircle } from "lucide-react"
import { SearchableSelect }    from "@/components/shared/SearchableSelect"
import { useVehicles, useDrivers, useMutation } from "@/lib/hooks/useApi"
import { useAuth }             from "@/hooks/useAuth"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
const REQ = <span className="text-red-500 ml-0.5">*</span>

function localDTNow() {
  const d = new Date(), pad = (n: number) => String(n).padStart(2,"0")
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NewTripPage() {
  const router   = useRouter()
  const { user } = useAuth()
  const isDriver = !!user?.isDriver
  const { mutate, loading:saving, error:saveError } = useMutation()
  const { data: vehRes } = useVehicles({ limit:"200" })
  const { data: drvRes } = useDrivers({ status:"active" })

  const [vehicleId,      setVehicleId]      = useState("")
  const [driverId,       setDriverId]       = useState("")
  const [autoDriver,     setAutoDriver]     = useState<string|null>(null)
  const [startLocation,  setStartLocation]  = useState("")
  const [endLocation,    setEndLocation]    = useState("")
  const [startTime,      setStartTime]      = useState(localDTNow())
  const [startOdometer,  setStartOdometer]  = useState("")
  const [purpose,        setPurpose]        = useState("")
  const [passengerCount, setPassengerCount] = useState("0")
  const [passengerNames, setPassengerNames] = useState("")
  const [lastOdometer,   setLastOdometer]   = useState<number|null>(null)
  const [odomWarn,       setOdomWarn]       = useState("")
  const [errors,         setErrors]         = useState<Record<string,string>>({})

  useEffect(() => {
    if (!vehicleId) { setLastOdometer(null); setOdomWarn(""); setAutoDriver(null); return }
    fetch(`/api/fleet/vehicles/${vehicleId}`,{ credentials:"include" })
      .then(r=>r.json()).then(d=>{
        const v = d.data
        if (!v) return
        if (v.mileage != null) setLastOdometer(v.mileage)
        if (v.assignedDriver) {
          setDriverId(v.assignedDriver.id ?? "")
          setAutoDriver(v.assignedDriver.user?.name ?? null)
        }
      }).catch(()=>{})
  },[vehicleId])

  useEffect(() => {
    if (lastOdometer===null||!startOdometer) { setOdomWarn(""); return }
    const val = parseFloat(startOdometer)
    if (!isNaN(val)&&val<lastOdometer)
      setOdomWarn(`Last recorded: ${lastOdometer.toLocaleString()} km — your entry is lower.`)
    else setOdomWarn("")
  },[startOdometer, lastOdometer])

  useEffect(() => {
    if (!isDriver||!drvRes?.items) return
    const me = drvRes.items[0]; if(me) setDriverId(me.id)
  },[isDriver, drvRes])

  const vehicleOptions = (vehRes?.items??[]).filter(v=>v.status!=="retired").map(v=>({
    value:v.id, label:v.plateNumber,
    sub:`${v.make} ${v.model}${v.assignedDriver?` · ${v.assignedDriver.user?.name}`:" · No driver"}`,
  }))
  const driverOptions = (drvRes?.items??[]).map(d=>({value:d.id, label:d.user.name, sub:d.user.email}))

  function validate() {
    const e:Record<string,string>={}
    if (!vehicleId)             e.vehicleId     = "Select a vehicle"
    if (!driverId)              e.driverId      = "Select a driver"
    if (!startLocation.trim())  e.startLocation = "Start location required"
    if (!endLocation.trim())    e.endLocation   = "Destination required"
    if (!startOdometer||isNaN(+startOdometer)) e.startOdometer = "Enter valid odometer"
    else if (lastOdometer!==null&&parseFloat(startOdometer)<lastOdometer)
      e.startOdometer = `Must be ≥ last recorded (${lastOdometer.toLocaleString()} km)`
    setErrors(e); return Object.keys(e).length===0
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault(); if (!validate()) return
    const {error} = await mutate("POST","/api/fleet/trips",{
      vehicleId, driverId,
      startLocation: startLocation.trim(),
      endLocation:   endLocation.trim(),
      startTime:     new Date(startTime).toISOString(),
      startOdometer: parseFloat(startOdometer),
      purpose:       purpose||undefined,
      passengerCount:parseInt(passengerCount)||0,
      passengerNames:passengerNames||undefined,
    })
    if (!error) router.push("/fleet/trips")
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <button onClick={()=>router.push("/fleet/trips")}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Trips
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
          <MapPin size={20} className="text-brand-navy dark:text-brand-gold"/>
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-foreground">Log New Trip</h2>
          <p className="text-[12px] text-muted-foreground">Record a vehicle departure and journey</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Vehicle &amp; Driver</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Vehicle{REQ}</label>
              <SearchableSelect options={vehicleOptions} value={vehicleId}
                onChange={v=>{setVehicleId(v);setAutoDriver(null);setDriverId("")}}
                placeholder="Select vehicle" error={errors.vehicleId}/>
              {lastOdometer!==null&&(
                <p className="text-[10.5px] text-muted-foreground">
                  Last recorded odometer: <strong>{lastOdometer.toLocaleString()} km</strong>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Driver{REQ}</label>
              {isDriver ? (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px] text-foreground">
                  {user?.name} <span className="text-[11px] text-muted-foreground">(you)</span>
                </div>
              ) : autoDriver ? (
                <div>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                    <CheckCircle size={13} className="text-emerald-600 flex-shrink-0"/>
                    <span className="text-[13px] text-foreground font-medium">{autoDriver}</span>
                    <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400">Auto-selected</span>
                    <button type="button" onClick={()=>{setAutoDriver(null);setDriverId("")}}
                      className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">Change</button>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">Assigned driver for this vehicle</p>
                </div>
              ) : (
                <SearchableSelect options={driverOptions} value={driverId} onChange={setDriverId}
                  placeholder="Select driver" error={errors.driverId}/>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Journey Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">From (Start Location){REQ}</label>
              <input className={INP} placeholder="e.g. Head Office, Victoria Island"
                value={startLocation} onChange={e=>setStartLocation(e.target.value)}/>
              {errors.startLocation&&<p className="text-[11px] text-red-500">{errors.startLocation}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">To (Destination){REQ}</label>
              <input className={INP} placeholder="e.g. Ikeja Branch"
                value={endLocation} onChange={e=>setEndLocation(e.target.value)}/>
              {errors.endLocation&&<p className="text-[11px] text-red-500">{errors.endLocation}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Departure Time{REQ}</label>
              <input type="datetime-local" className={INP} value={startTime}
                onChange={e=>setStartTime(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Start Odometer (km){REQ}</label>
              <input type="number" min={0} className={INP} placeholder="e.g. 45230"
                value={startOdometer} onChange={e=>setStartOdometer(e.target.value)}/>
              {errors.startOdometer&&<p className="text-[11px] text-red-500">{errors.startOdometer}</p>}
              {odomWarn&&!errors.startOdometer&&(
                <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-2.5 py-1.5">
                  <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5"/>
                  <p className="text-[10.5px] text-amber-700 dark:text-amber-300">{odomWarn}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Purpose / Reason</label>
              <input className={INP} placeholder="e.g. Client visit, Official errand"
                value={purpose} onChange={e=>setPurpose(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Number of Passengers</label>
              <input type="number" min={0} max={20} className={INP}
                value={passengerCount} onChange={e=>setPassengerCount(e.target.value)}/>
            </div>
            {parseInt(passengerCount)>0&&(
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                  <Users size={12} className="text-muted-foreground"/>
                  Passenger Name(s) <span className="text-muted-foreground text-[10.5px] font-normal">(optional)</span>
                </label>
                <input className={INP} placeholder="e.g. John Adeyemi, Mary Okonkwo"
                  value={passengerNames} onChange={e=>setPassengerNames(e.target.value)}/>
                <p className="text-[10.5px] text-muted-foreground">Separate multiple names with commas</p>
              </div>
            )}
          </div>
        </div>

        {saveError&&<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
            {saving?"Starting trip…":"Start Trip"}
          </button>
          <button type="button" onClick={()=>router.push("/fleet/trips")}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
