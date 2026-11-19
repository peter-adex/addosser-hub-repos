"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2, Wrench } from "lucide-react"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useVehicles, useVendors, useMutation } from "@/lib/hooks/useApi"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
const REQ = <span className="text-red-500">*</span>
const TYPES = [{value:"oil_change",label:"Oil Change"},{value:"tyre_rotation",label:"Tyre Rotation"},{value:"brake_service",label:"Brake Service"},{value:"engine_service",label:"Engine Service"},{value:"electrical",label:"Electrical Repair"},{value:"body_work",label:"Body Work"},{value:"ac_service",label:"A/C Service"},{value:"general_service",label:"General Service"},{value:"inspection",label:"Inspection"},{value:"other",label:"Other"}]

export default function NewMaintenancePage() {
  const router = useRouter()
  const { mutate, loading:saving, error:saveError } = useMutation()
  const { data: vehRes } = useVehicles({ limit:"200" })
  const { data: venRes } = useVendors({ status:"active" })

  const [vehicleId,   setVehicleId]   = useState("")
  const [vendorId,    setVendorId]    = useState("")
  const [type,        setType]        = useState("")
  const [description, setDescription] = useState("")
  const [date,        setDate]        = useState(new Date().toISOString().split("T")[0])
  const [costNgn,     setCostNgn]     = useState("")
  const [nextDueDate, setNextDueDate] = useState("")
  const [nextDueKm,   setNextDueKm]   = useState("")
  const [errors,      setErrors]      = useState<Record<string,string>>({})

  const vehicleOptions = [{value:"",label:"Select vehicle"}, ...(vehRes?.items??[]).map(v=>({value:v.id,label:v.plateNumber,sub:`${v.make} ${v.model}`}))]
  const vendorOptions  = [{value:"",label:"No vendor"}, ...(venRes?.items??[]).map(v=>({value:v.id,label:v.name,sub:v.city}))]

  function validate() {
    const e:Record<string,string>={}
    if (!vehicleId)        e.vehicleId = "Select a vehicle"
    if (!type)             e.type      = "Select maintenance type"
    if (!costNgn||+costNgn<=0) e.costNgn = "Enter the maintenance cost"
    setErrors(e); return Object.keys(e).length===0
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault(); if (!validate()) return
    const { error } = await mutate("POST", "/api/fleet/maintenance", {
      vehicleId, vendorId:vendorId||undefined, type, description:description||undefined,
      date: new Date(date).toISOString(), costNgn: parseFloat(costNgn),
      nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : undefined,
      nextDueKm: nextDueKm ? parseFloat(nextDueKm) : undefined,
    })
    if (!error) router.push("/fleet/maintenance")
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <button onClick={()=>router.push("/fleet/maintenance")} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors"><ChevronLeft size={14}/> Back to Maintenance</button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center"><Wrench size={20} className="text-brand-navy dark:text-brand-gold"/></div>
        <div><h2 className="text-[20px] font-bold text-foreground">Add Maintenance Record</h2><p className="text-[12px] text-muted-foreground">Log a service or repair</p></div>
      </div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Service Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Vehicle {REQ}</label>
              <SearchableSelect options={vehicleOptions} value={vehicleId} onChange={setVehicleId} placeholder="Select vehicle" error={errors.vehicleId}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Service Vendor</label>
              <SearchableSelect options={vendorOptions} value={vendorId} onChange={setVendorId} placeholder="Select vendor"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Maintenance Type {REQ}</label>
              <SearchableSelect options={TYPES} value={type} onChange={setType} placeholder="Select type" error={errors.type}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Date {REQ}</label>
              <input type="date" className={INP} value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground">Description / Work Done</label>
              <textarea className={INP} rows={3} placeholder="Describe the maintenance work carried out…" value={description} onChange={e=>setDescription(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Total Cost (₦) {REQ}</label>
              <input type="number" min={0} className={INP} placeholder="e.g. 150000" value={costNgn} onChange={e=>setCostNgn(e.target.value)}/>
              {errors.costNgn && <p className="text-[11px] text-red-500">{errors.costNgn}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Next Service Date</label>
              <input type="date" className={INP} value={nextDueDate} onChange={e=>setNextDueDate(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Next Service Mileage (km)</label>
              <input type="number" min={0} className={INP} placeholder="e.g. 50000" value={nextDueKm} onChange={e=>setNextDueKm(e.target.value)}/>
            </div>
          </div>
        </div>
        {saveError && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} {saving?"Saving…":"Add Maintenance Record"}
          </button>
          <button type="button" onClick={()=>router.push("/fleet/maintenance")} className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
