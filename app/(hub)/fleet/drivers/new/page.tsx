"use client"
import { useState, useRef } from "react"
import { useRouter }        from "next/navigation"
import {
  ChevronLeft, Save, Loader2, Users, Plus, Trash2,
  Camera, AlertTriangle, X,
} from "lucide-react"
import { SearchableSelect }  from "@/components/shared/SearchableSelect"
import { useEntities, useVehicles, useMutation } from "@/lib/hooks/useApi"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"
const REQ = <span className="text-red-500 ml-0.5">*</span>

const LICENSE_TYPES = [
  {value:"federal_road_safety",   label:"FRSC License"},
  {value:"state_drivers_license", label:"State Driver's License"},
  {value:"vehicle_inspection",    label:"Vehicle Inspection Certificate"},
  {value:"commercial",            label:"Commercial License"},
  {value:"heavy_duty",            label:"Heavy Duty License"},
  {value:"motorcycle",            label:"Motorcycle License"},
  {value:"other",                 label:"Other"},
]

function emptyLic() {
  return { type:"federal_road_safety", licenseNumber:"", issuingAuthority:"", issueDate:"", expiryDate:"", isPrimary:false }
}

function ExpiryHint({ date }: { date: string }) {
  if (!date) return null
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days > 90)  return <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400">✓ Valid — {days} days remaining</p>
  if (days > 0)   return <p className="text-[10.5px] text-amber-600 dark:text-amber-400"><AlertTriangle size={10} className="inline mr-0.5"/>Expiring soon — {days} days left</p>
  return              <p className="text-[10.5px] text-red-600 dark:text-red-400"><AlertTriangle size={10} className="inline mr-0.5"/>EXPIRED {Math.abs(days)} days ago</p>
}

export default function NewDriverPage() {
  const router    = useRouter()
  const fileRef   = useRef<HTMLInputElement>(null)
  const { mutate, loading:saving, error:saveError } = useMutation()
  const { data: entRes } = useEntities()
  const { data: vehRes } = useVehicles({ limit:"200" })

  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [phone,    setPhone]    = useState("")
  const [entityId, setEntityId] = useState("")
  const [assignedVehicleId, setAssignedVehicleId] = useState("")

  const [photoPreview,  setPhotoPreview]  = useState<string|null>(null)
  const [photoUrl,      setPhotoUrl]      = useState("")
  const [photoPublicId, setPhotoPublicId] = useState("")
  const [photoStorageProvider, setPhotoStorageProvider] = useState("")
  const [photoStorageKey,      setPhotoStorageKey]      = useState("")
  const [uploading,     setUploading]     = useState(false)
  const [uploadErr,     setUploadErr]     = useState("")

  const [licenses, setLicenses] = useState([{ ...emptyLic(), isPrimary:true }])
  const [errors,   setErrors]   = useState<Record<string,string>>({})

  const entityOptions  = (entRes?.items??[]).map(e=>({value:e.id, label:e.name, sub:e.code}))
  const vehicleOptions = [
    {value:"",label:"No vehicle assigned"},
    ...(vehRes?.items??[]).filter(v=>v.allocationStatus==="available").map(v=>({value:v.id, label:v.plateNumber, sub:`${v.make} ${v.model}`})),
  ]

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadErr("")
    setPhotoPreview(URL.createObjectURL(file))
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file); fd.append("folder","drivers"); fd.append("filename",`driver_${Date.now()}`)
    const res  = await fetch("/api/fleet/upload", { method:"POST", body:fd, credentials:"include" })
    const json = await res.json()
    setUploading(false)
    if (res.ok && json.data?.url) {
      setPhotoUrl(json.data.url)
      setPhotoPublicId(json.data.publicId??"")
      setPhotoStorageProvider(json.data.storageProvider??"")
      setPhotoStorageKey(json.data.storageKey??"")
    } else {
      setUploadErr(json.error ?? "Photo upload failed")
      setPhotoPreview(null)
    }
    e.target.value = ""
  }

  function removePhoto() { setPhotoPreview(null); setPhotoUrl(""); setPhotoPublicId(""); setPhotoStorageProvider(""); setPhotoStorageKey("") }

  function addLicense()            { setLicenses(p=>[...p, emptyLic()]) }
  function removeLicense(i:number) { if (licenses.length>1) setLicenses(p=>p.filter((_,idx)=>idx!==i)) }
  function updateLic(i:number, k:string, v:string|boolean) {
    setLicenses(p=>p.map((l,idx)=>idx===i ? {...l,[k]:v} : k==="isPrimary"&&v ? {...l,isPrimary:false} : l))
  }
  function setPrimary(i:number) { setLicenses(p=>p.map((l,idx)=>({...l, isPrimary:idx===i}))) }

  function validate() {
    const e:Record<string,string>={}
    if (!name.trim())  e.name    = "Full name is required"
    if (!email.trim()) e.email   = "Email is required"
    if (!entityId)     e.entityId= "Select an entity"
    if (licenses.filter(l=>l.isPrimary).length!==1) e.licenses = "Exactly one license must be marked as primary"
    licenses.forEach((l,i)=>{
      if (!l.licenseNumber.trim())    e[`lic_${i}_num`]  = "License number required"
      if (!l.issuingAuthority.trim()) e[`lic_${i}_auth`] = "Issuing authority required"
      if (!l.expiryDate)              e[`lic_${i}_exp`]  = "Expiry date required"
    })
    setErrors(e); return Object.keys(e).length===0
  }

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault(); if (!validate()) return
    const { error } = await mutate("POST", "/api/fleet/drivers", {
      name, email, phone: phone||undefined, entityId,
      assignedVehicleId: assignedVehicleId||undefined,
      photoUrl:          photoUrl||undefined,
      photoPublicId:     photoPublicId||undefined,
      photoStorageProvider: photoStorageProvider||undefined,
      photoStorageKey:      photoStorageKey||undefined,
      licenses: licenses.map(l=>({
        ...l,
        expiryDate: new Date(l.expiryDate).toISOString(),
        issueDate:  l.issueDate ? new Date(l.issueDate).toISOString() : undefined,
      })),
    })
    if (!error) router.push("/fleet/drivers")
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <button onClick={()=>router.push("/fleet/drivers")} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Drivers
      </button>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center">
          <Users size={20} className="text-brand-navy dark:text-brand-gold"/>
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-foreground">Register New Driver</h2>
          <p className="text-[12px] text-muted-foreground">Add a driver profile to the fleet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-3 pb-2 border-b border-border">Driver Photo</p>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div onClick={()=>!uploading&&fileRef.current?.click()}
                className="h-24 w-24 rounded-full border-2 border-dashed border-border hover:border-brand-navy/50 cursor-pointer overflow-hidden bg-muted flex items-center justify-center group transition-colors">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-full h-full object-cover"/>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">
                    <Camera size={22}/>
                    <span className="text-[9px] font-medium">Upload</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <Loader2 size={20} className="animate-spin text-white"/>
                  </div>
                )}
              </div>
              {photoPreview && (
                <button type="button" onClick={removePhoto}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                  <X size={10}/>
                </button>
              )}
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-foreground mb-1">Driver Profile Photo</p>
              <p className="text-[11.5px] text-muted-foreground mb-2">JPG or PNG · Max 2MB · Click circle to upload</p>
              {uploadErr && <p className="text-[11px] text-red-500">{uploadErr}</p>}
              <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-muted transition-colors disabled:opacity-60">
                <Camera size={13}/> {photoPreview?"Change Photo":"Select Photo"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect}/>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Personal Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground">Full Name{REQ}</label>
              <input className={INP} placeholder="e.g. Babatunde Fashola" value={name} onChange={e=>setName(e.target.value)}/>
              {errors.name&&<p className="text-[11px] text-red-500">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Email Address{REQ}</label>
              <input type="email" className={INP} placeholder="driver@addosser.ng" value={email} onChange={e=>setEmail(e.target.value)}/>
              {errors.email&&<p className="text-[11px] text-red-500">{errors.email}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Phone Number</label>
              <input type="tel" className={INP} placeholder="e.g. 08012345678" value={phone} onChange={e=>setPhone(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Entity{REQ}</label>
              <SearchableSelect options={entityOptions} value={entityId} onChange={setEntityId} placeholder="Select entity" error={errors.entityId}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Assign Vehicle</label>
              <SearchableSelect options={vehicleOptions} value={assignedVehicleId} onChange={setAssignedVehicleId} placeholder="Select vehicle (optional)"/>
              <p className="text-[10.5px] text-muted-foreground">Only available (unallocated) pool vehicles are shown</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Driver Licenses{REQ}</p>
              <p className="text-[11.5px] text-muted-foreground">At least one license is required. Mark one as Primary.</p>
            </div>
            <button type="button" onClick={addLicense}
              className="inline-flex items-center gap-1 text-[12px] text-brand-navy dark:text-brand-gold hover:underline font-medium">
              <Plus size={13}/> Add License
            </button>
          </div>
          {errors.licenses&&<p className="text-[11px] text-red-500 mb-3">{errors.licenses}</p>}

          <div className="space-y-4">
            {licenses.map((lic,i)=>(
              <div key={i} className={`rounded-xl border p-4 transition-colors ${lic.isPrimary?"border-brand-navy/30 dark:border-brand-gold/30 bg-brand-navy/[0.02]":"border-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={lic.isPrimary} onChange={()=>setPrimary(i)} className="rounded accent-[#1B3070]"/>
                    <span className="text-[12.5px] font-semibold text-foreground">
                      {lic.isPrimary ? "✓ Primary License" : `License ${i+1}`}
                    </span>
                    {lic.isPrimary && <span className="rounded-full bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold px-2 py-0.5 text-[9.5px] font-bold">PRIMARY</span>}
                  </label>
                  {licenses.length>1 && (
                    <button type="button" onClick={()=>removeLicense(i)} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">License Type{REQ}</label>
                    <SearchableSelect options={LICENSE_TYPES} value={lic.type} onChange={v=>updateLic(i,"type",v)} placeholder="Select type"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">License Number{REQ}</label>
                    <input className={`${INP} uppercase font-mono`} placeholder="e.g. LGS-2024-001234"
                      value={lic.licenseNumber} onChange={e=>updateLic(i,"licenseNumber",e.target.value.toUpperCase())}/>
                    {errors[`lic_${i}_num`]&&<p className="text-[10px] text-red-500">{errors[`lic_${i}_num`]}</p>}
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[11px] font-medium text-muted-foreground">Issuing Authority{REQ}</label>
                    <input className={INP} placeholder="e.g. FRSC Lagos State"
                      value={lic.issuingAuthority} onChange={e=>updateLic(i,"issuingAuthority",e.target.value)}/>
                    {errors[`lic_${i}_auth`]&&<p className="text-[10px] text-red-500">{errors[`lic_${i}_auth`]}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Issue Date</label>
                    <input type="date" className={INP} value={lic.issueDate} onChange={e=>updateLic(i,"issueDate",e.target.value)}/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Expiry Date{REQ}</label>
                    <input type="date" className={INP} value={lic.expiryDate} onChange={e=>updateLic(i,"expiryDate",e.target.value)}/>
                    {errors[`lic_${i}_exp`]&&<p className="text-[10px] text-red-500">{errors[`lic_${i}_exp`]}</p>}
                    <ExpiryHint date={lic.expiryDate}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {saveError&&<div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300">{saveError}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving||uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
            {saving?"Registering…":"Register Driver"}
          </button>
          <button type="button" onClick={()=>router.push("/fleet/drivers")}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
