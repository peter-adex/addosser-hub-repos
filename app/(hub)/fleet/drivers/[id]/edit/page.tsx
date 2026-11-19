"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter }         from "next/navigation"
import { ChevronLeft, Save, Loader2, Camera, X, AlertTriangle } from "lucide-react"
import { SearchableSelect } from "@/components/shared/SearchableSelect"
import { useVehicles, useMutation } from "@/lib/hooks/useApi"

const INP = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition"

function ExpiryHint({ date }: { date: string }) {
  if (!date) return null
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days > 90) return <p className="text-[10.5px] text-emerald-600">✓ Valid — {days}d remaining</p>
  if (days > 0)  return <p className="text-[10.5px] text-amber-600 flex items-center gap-1"><AlertTriangle size={10}/>Expiring in {days} days</p>
  return             <p className="text-[10.5px] text-red-600 flex items-center gap-1"><AlertTriangle size={10}/>EXPIRED {Math.abs(days)} days ago</p>
}

export default function EditDriverPage() {
  const { id }  = useParams<{id:string}>()
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { mutate, loading:saving } = useMutation()
  const { data: vehRes }           = useVehicles({ limit:"200" })

  const [loading,   setLoading]   = useState(true)
  const [name,      setName]      = useState("")
  const [phone,     setPhone]     = useState("")
  const [status,    setStatus]    = useState("active")
  const [assignedVehicleId, setAssignedVehicleId] = useState("")
  const [photoPreview,  setPhotoPreview]  = useState<string|null>(null)
  const [photoUrl,      setPhotoUrl]      = useState("")
  const [photoStorageProvider, setPhotoStorageProvider] = useState("")
  const [photoStorageKey,      setPhotoStorageKey]      = useState("")
  const [uploading,     setUploading]     = useState(false)
  const [licenses,      setLicenses]      = useState<any[]>([])
  const [saved,         setSaved]         = useState(false)

  useEffect(()=>{
    fetch(`/api/fleet/drivers/${id}`,{credentials:"include"}).then(r=>r.json()).then(d=>{
      const dr=d.data; if (!dr) return
      setName(dr.user?.name??""); setPhone(dr.user?.phone??"")
      setStatus(dr.status??"active"); setAssignedVehicleId(dr.assignedVehicleId??"")
      setPhotoPreview(dr.photoUrl??null); setPhotoUrl(dr.photoUrl??"")
      setLicenses((dr.licenses??[]).map((l:any)=>({
        ...l,
        issueDate:  l.issueDate  ? l.issueDate.split("T")[0]  : "",
        expiryDate: l.expiryDate ? l.expiryDate.split("T")[0] : "",
      })))
      setLoading(false)
    })
  },[id])

  async function handlePhotoSelect(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; if (!file) return
    setPhotoPreview(URL.createObjectURL(file)); setUploading(true)
    const fd=new FormData(); fd.append("file",file); fd.append("folder","drivers")
    const res=await fetch("/api/fleet/upload",{method:"POST",body:fd,credentials:"include"})
    const json=await res.json(); setUploading(false)
    if (res.ok) {
      setPhotoUrl(json.data.url)
      setPhotoStorageProvider(json.data.storageProvider??"")
      setPhotoStorageKey(json.data.storageKey??"")
    } else setPhotoPreview(photoUrl||null)
    e.target.value=""
  }

  function updateLic(i:number,k:string,v:string) {
    setLicenses(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l))
  }

  const vehicleOptions=[
    {value:"",label:"No vehicle assigned"},
    ...(vehRes?.items??[]).filter(v=>v.allocationStatus==="available"||v.assignedDriverId===id).map(v=>({value:v.id,label:v.plateNumber,sub:`${v.make} ${v.model} · ${v.status}`})),
  ]
  const statusOpts=[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault()
    const { error } = await mutate("PUT",`/api/fleet/drivers/${id}`,{
      name, phone:phone||undefined, status,
      photoUrl:photoUrl||undefined,
      photoStorageProvider:photoStorageProvider||undefined,
      photoStorageKey:photoStorageKey||undefined,
      assignedVehicleId:assignedVehicleId||null,
    })
    if (!error) { setSaved(true); setTimeout(()=>router.push(`/fleet/drivers/${id}`),900) }
  }

  if (loading) return <div className="max-w-xl space-y-4">{[100,220,200].map((h,i)=><div key={i} className="bg-card border border-border rounded-xl animate-pulse" style={{height:h}}/>)}</div>

  return (
    <div className="animate-fade-in max-w-xl">
      <button onClick={()=>router.push(`/fleet/drivers/${id}`)} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ChevronLeft size={14}/> Back to Driver Profile
      </button>
      <h2 className="text-[20px] font-bold text-foreground mb-6">Edit Driver Profile</h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-3 pb-2 border-b border-border">Profile Photo</p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div onClick={()=>!uploading&&fileRef.current?.click()}
                className="h-20 w-20 rounded-full border-2 border-dashed border-border hover:border-brand-navy/50 cursor-pointer overflow-hidden bg-muted flex items-center justify-center group transition-colors">
                {photoPreview?<img src={photoPreview} alt="" className="w-full h-full object-cover"/>:<Camera size={20} className="text-muted-foreground group-hover:text-brand-navy"/>}
                {uploading&&<div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"><Loader2 size={18} className="animate-spin text-white"/></div>}
              </div>
              {photoPreview&&<button type="button" onClick={()=>{setPhotoPreview(null);setPhotoUrl("")}} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={10}/></button>}
            </div>
            <div>
              <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-muted transition-colors disabled:opacity-60">
                <Camera size={13}/>{photoPreview?" Change Photo":" Upload Photo"}
              </button>
              <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG or WebP · Max 2MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect}/>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border">Driver Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground">Full Name</label>
              <input className={INP} value={name} onChange={e=>setName(e.target.value)}/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Phone</label>
              <input type="tel" className={INP} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="08012345678"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Status</label>
              <SearchableSelect options={statusOpts} value={status} onChange={setStatus} placeholder="Status"/>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-foreground">Assigned Vehicle</label>
              <SearchableSelect options={vehicleOptions} value={assignedVehicleId} onChange={setAssignedVehicleId} placeholder="Select vehicle"/>
            </div>
          </div>
        </div>

        {licenses.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-[13px] font-semibold text-foreground mb-3 pb-2 border-b border-border">License Expiry Dates</p>
            <div className="space-y-3">
              {licenses.map((lic,i)=>(
                <div key={i} className={`rounded-lg border p-3 ${lic.isPrimary?"border-brand-navy/30 dark:border-brand-gold/30 bg-brand-navy/[0.02]":"border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[12.5px] font-semibold text-foreground capitalize">{lic.type.replace(/_/g," ")}</p>
                      {lic.isPrimary&&<span className="rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/10 dark:text-brand-gold px-2 py-0.5 text-[9.5px] font-bold">PRIMARY</span>}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">{lic.licenseNumber}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Expiry Date</label>
                    <input type="date" className={INP} value={lic.expiryDate} onChange={e=>updateLic(i,"expiryDate",e.target.value)}/>
                    <ExpiryHint date={lic.expiryDate}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving||uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors">
            {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
            {saving?"Saving…":saved?"Saved ✓":"Save Changes"}
          </button>
          <button type="button" onClick={()=>router.push(`/fleet/drivers/${id}`)}
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
