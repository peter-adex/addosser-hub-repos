"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2, BellRing } from "lucide-react"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useVehicles, useMutation } from "@/lib/hooks/useApi"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
const REQ = <span className="text-red-500">*</span>
const TYPES = [{value:"service",label:"Service Reminder"},{value:"document_renewal",label:"Document Renewal"}]
const DOC_TYPES = [{value:"insurance",label:"Insurance"},{value:"vehicle_license",label:"Vehicle License"},{value:"roadworthiness",label:"Roadworthiness"},{value:"hackney_permit",label:"Hackney Permit"},{value:"drivers_license",label:"Driver's License"},{value:"other",label:"Other"}]

export default function NewReminderPage() {
  const router = useRouter()
  const { mutate, loading:saving, error:saveError } = useMutation()
  const { data: vehRes } = useVehicles({ limit:"200" })

  const [vehicleId,        setVehicleId]        = useState("")
  const [type,             setType]             = useState("service")
  const [documentType,     setDocumentType]     = useState("")
  const [title,            setTitle]            = useState("")
  const [dueDate,          setDueDate]          = useState("")
  const [dueMileageKm,     setDueMileageKm]     = useState("")
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("14")
  const [notes,            setNotes]            = useState("")
  const [errors,           setErrors]           = useState<Record<string,string>>({})

  const vehicleOptions = [{value:"",label:"Select vehicle"}, ...(vehRes?.items??[]).filter(v=>v.status!=="retired").map(v=>({value:v.id,label:v.plateNumber,sub:`${v.make} ${v.model}`}))]

  function validate() {
    const e:Record<string,string>={}
    if (!vehicleId)     e.vehicleId = "Select a vehicle"
    if (!title.trim())  e.title     = "Title is required"
    if (!dueDate)       e.dueDate   = "Due date is required"
    setErrors(e); return Object.keys(e).length===0
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault(); if (!validate()) return
    const { error } = await mutate("POST", "/api/fleet/reminders", {
      vehicleId, type, documentType:documentType||undefined, title,
      dueDate: new Date(dueDate).toISOString(),
      dueMileageKm: dueMileageKm ? parseFloat(dueMileageKm) : undefined,
      notifyDaysBefore: parseInt(notifyDaysBefore)||14,
      notes: notes||undefined,
    })
    if (!error) router.push("/fleet/reminders")
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <button onClick={()=>router.push("/fleet/reminders")} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors"><ChevronLeft size={14}/> Back to Reminders</button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center"><BellRing size={20} className="text-brand-navy dark:text-brand-gold"/></div>
        <div><h2 className="text-[20px] font-bold text-foreground">Add Reminder</h2><p className="text-[12px] text-muted-foreground">Set up a vehicle service or document renewal reminder</p></div>
      </div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Vehicle {REQ}</label>
              <SearchableSelect options={vehicleOptions} value={vehicleId} onChange={setVehicleId} placeholder="Select vehicle" error={errors.vehicleId}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Reminder Type {REQ}</label>
              <SearchableSelect options={TYPES} value={type} onChange={setType} placeholder="Select type"/>
            </div>
            {type==="document_renewal" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">Document Type</label>
                <SearchableSelect options={DOC_TYPES} value={documentType} onChange={setDocumentType} placeholder="Select document"/>
              </div>
            )}
            <div className={`flex flex-col gap-1.5 ${type!=="document_renewal"?"sm:col-span-2":""}`}>
              <label className="text-[12px] font-medium text-foreground">Reminder Title {REQ}</label>
              <input className={INP} placeholder="e.g. Annual Insurance Renewal" value={title} onChange={e=>setTitle(e.target.value)}/>
              {errors.title && <p className="text-[11px] text-red-500">{errors.title}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Due Date {REQ}</label>
              <input type="date" className={INP} value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
              {errors.dueDate && <p className="text-[11px] text-red-500">{errors.dueDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Due Mileage (km)</label>
              <input type="number" min={0} className={INP} placeholder="Optional — e.g. 50000" value={dueMileageKm} onChange={e=>setDueMileageKm(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Notify X days before</label>
              <input type="number" min={1} max={90} className={INP} value={notifyDaysBefore} onChange={e=>setNotifyDaysBefore(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground">Notes</label>
              <textarea className={INP} rows={2} placeholder="Any additional notes…" value={notes} onChange={e=>setNotes(e.target.value)}/>
            </div>
          </div>
        </div>
        {saveError && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} {saving?"Saving…":"Add Reminder"}
          </button>
          <button type="button" onClick={()=>router.push("/fleet/reminders")} className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
