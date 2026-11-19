'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Save,
  Loader2,
  Truck,
  Camera,
  X,
  TrendingDown,
  FileText,
  Paperclip,
  Trash2,
  Download,
  ZoomIn,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon
} from 'lucide-react'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import {
  useEntities,
  useDrivers,
  useVendors,
  useVehicleDocumentTypes,
  useMutation
} from '@/lib/hooks/useApi'

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition'
const REQ = <span className='text-red-500 ml-0.5'>*</span>
const fmtNgn = (n: number) =>
  '₦' +
  n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

function extFromMime (mime = ''): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'text/csv': 'csv',
    'text/plain': 'txt'
  }
  return map[mime] ?? mime.split('/')[1] ?? 'bin'
}
function safeFilename (name: string, mime: string): string {
  const ext = extFromMime(mime)
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`
}

const CATEGORY_OPTS = [
  { value: 'saloon', label: 'Saloon / Sedan', sub: 'Executive sedan' },
  { value: 'suv', label: 'SUV', sub: 'Sport utility' },
  { value: 'jeep', label: 'Jeep / 4WD', sub: 'Off-road' },
  { value: 'truck', label: 'Truck / Van', sub: 'Commercial/cargo' },
  { value: 'motorcycle', label: 'Motorcycle', sub: 'Two-wheel' }
]
const USE_OPTS = [
  { value: 'pool', label: 'Pool Vehicle', sub: 'Shared across drivers' },
  {
    value: 'status',
    label: 'Status Vehicle',
    sub: 'Dedicated to one staff member'
  }
]
const STATUS_OPTS = [
  { value: 'idle', label: 'Idle' },
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'In Maintenance' }
]

function Lightbox ({
  images,
  startIndex,
  onClose
}: {
  images: { url: string; isPrimary?: boolean }[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length)
  const next = () => setIdx(i => (i + 1) % images.length)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  return (
    <div
      className='fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center'
      onClick={onClose}
    >
      <button
        className='absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition'
        onClick={onClose}
      >
        <X size={18} />
      </button>
      {images.length > 1 && (
        <button
          className='absolute left-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition'
          onClick={e => {
            e.stopPropagation()
            prev()
          }}
        >
          <ChevronLeftIcon size={20} />
        </button>
      )}
      <div
        className='relative max-w-[90vw] max-h-[90vh]'
        onClick={e => e.stopPropagation()}
      >
        <img
          src={images[idx].url}
          alt=''
          className='max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl'
        />
        {images[idx].isPrimary && (
          <span className='absolute bottom-3 left-1/2 -translate-x-1/2 bg-brand-navy/90 text-brand-gold text-[10px] font-bold px-3 py-1 rounded-full'>
            PRIMARY
          </span>
        )}
        <p className='absolute bottom-3 right-3 text-[11px] text-white/50'>
          {idx + 1} / {images.length}
        </p>
      </div>
      {images.length > 1 && (
        <button
          className='absolute right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition'
          onClick={e => {
            e.stopPropagation()
            next()
          }}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  )
}

function computeAge (purchaseDate: string) {
  const start = new Date(purchaseDate)
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  if (months < 0) months = 0
  return { yrs: Math.floor(months / 12), mos: months % 12, total: months }
}
function DepreciationPreview ({
  cost,
  years,
  purchaseDate
}: {
  cost: number
  years: number
  purchaseDate: string
}) {
  if (!cost || !purchaseDate) return null
  const lifeM = years * 12
  const depM = cost / lifeM
  const depY = cost / years
  const age = computeAge(purchaseDate)
  const elap = Math.min(age.total, lifeM)
  const accDep = depM * elap
  const nbv = Math.max(0, cost - accDep)
  const pct = Math.min(100, (elap / lifeM) * 100)
  const pDt = new Date(purchaseDate)
  const rDt = new Date(pDt)
  rDt.setFullYear(rDt.getFullYear() + years)
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d)
  return (
    <div className='mt-4 rounded-xl bg-[#0f1e3c] text-white overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-3 border-b border-white/[0.08]'>
        <TrendingDown size={14} className='text-brand-gold' />
        <p className='text-[12.5px] font-semibold'>Depreciation Preview</p>
        <span className='text-[11px] text-white/50'>
          Straight-line · {years}-year useful life
        </span>
      </div>
      <div className='divide-y divide-white/[0.06]'>
        {[
          {
            label: 'Age of Vehicle',
            value: `${age.yrs} yrs ${age.mos} months`
          },
          { label: 'Acquisition Value (AQUI)', value: fmtNgn(cost) },
          { label: 'Depreciation / Month', value: fmtNgn(depM) },
          { label: 'Depreciation / Year', value: fmtNgn(depY) },
          {
            label: 'Accumulated Depreciation',
            value: fmtNgn(accDep),
            hl: 'amber'
          },
          { label: 'Net Book Value (NBV)', value: fmtNgn(nbv), hl: 'gold' }
        ].map(row => (
          <div
            key={row.label}
            className='flex items-center justify-between px-5 py-3'
          >
            <span className='text-[12.5px] text-white/70'>{row.label}</span>
            <span
              className={`text-[13px] font-semibold ${
                row.hl === 'gold'
                  ? 'text-brand-gold'
                  : row.hl === 'amber'
                  ? 'text-amber-400'
                  : 'text-white'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <div className='px-5 py-3 border-t border-white/[0.06]'>
        <div className='flex justify-between text-[11px] text-white/50 mb-1.5'>
          <span>Depreciation progress</span>
          <span>{pct.toFixed(0)}% depreciated</span>
        </div>
        <div className='h-2 rounded-full bg-white/10 overflow-hidden mb-2'>
          <div
            className='h-full rounded-full bg-brand-gold'
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className='flex justify-between text-[10.5px] text-white/40'>
          <span>Purchase: {fmt(pDt)}</span>
          <span>Replacement due: {fmt(rDt)}</span>
        </div>
      </div>
    </div>
  )
}

interface UploadedDoc {
  name: string
  documentTypeId: string
  typeName: string
  url: string
  publicId: string
  storageProvider: string
  storageKey: string
  fileSize: number
  mimeType: string
  expiryDate: string
  uploading: boolean
  error: string
  tempId: string
}

export default function NewVehiclePage () {
  const router = useRouter()
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const { mutate, loading: saving, error: saveError } = useMutation()
  const { data: entRes } = useEntities()
  const { data: drvRes } = useDrivers({ status: 'active' })
  const { data: venRes } = useVendors({ status: 'active' })
  const { data: docTypeRes } = useVehicleDocumentTypes()

  const [plateNumber, setPlate] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [category, setCategory] = useState('')
  const [vehicleUse, setUse] = useState('pool')
  const [status, setStatus] = useState('idle')
  const [colour, setColour] = useState('')
  const [chassisNumber, setChassis] = useState('')
  const [engineNumber, setEngine] = useState('')
  const [mileage, setMileage] = useState('0')
  const [entityId, setEntityId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [acqValue, setAcqValue] = useState('')
  const [usefulLife, setUsefulLife] = useState('5')
  const [staffName, setStaffName] = useState('')
  const [staffDept, setStaffDept] = useState('')
  const [staffRole, setStaffRole] = useState('')
  const [staffId, setStaffId] = useState('')
  const [staffPhone, setStaffPhone] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [photos, setPhotos] = useState<
    { url: string; publicId: string; storageProvider: string; storageKey: string; preview: string }[]
  >([])
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [docTypeId, setDocTypeId] = useState('')
  const [docExpiry, setDocExpiry] = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [docAdding, setDocAdding] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isStatus = vehicleUse === 'status'
  const acqVal = parseFloat(acqValue) || 0
  const lifeYrs = parseInt(usefulLife) || 5

  const entityOptions = (entRes?.items ?? []).map(e => ({
    value: e.id,
    label: e.name,
    sub: e.code
  }))
  const driverOptions = [
    { value: '', label: 'Unassigned' },
    ...(drvRes?.items ?? []).map(d => ({
      value: d.id,
      label: d.user.name,
      sub: d.user.email
    }))
  ]
  const vendorOptions = (venRes?.items ?? []).map(v => ({
    value: v.id,
    label: v.name,
    sub: v.city
  }))
  const docTypeOptions = (docTypeRes?.items ?? []).map(t => ({
    value: t.id,
    label: t.name,
    sub: t.description || undefined
  }))
  const usedDocTypeIds = new Set(docs.map(d => d.documentTypeId).filter(Boolean))
  const availableDocTypeOptions = docTypeOptions.filter(o => !usedDocTypeIds.has(o.value))
  const lightboxImages = photos.map((p, i) => ({
    url: p.preview,
    isPrimary: i === 0
  }))

  async function handlePhotoSelect (e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadErr('')
    for (const file of files) {
      const preview = URL.createObjectURL(file)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'vehicles')
      try {
        const res = await fetch('/api/fleet/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include'
        })
        const json = await res.json()
        if (res.ok && json.data?.url)
          setPhotos(p => [
            ...p,
            {
              url: json.data.url,
              publicId: json.data.publicId ?? '',
              storageProvider: json.data.storageProvider ?? '',
              storageKey: json.data.storageKey ?? '',
              preview
            }
          ])
        else
          setUploadErr(json.error ?? 'Upload failed — check storage config.')
      } catch {
        setUploadErr('Network error during upload.')
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  function validateDocFields () {
    const e: Record<string, string> = {}
    if (!docTypeId) e.docType = 'Select a document type'
    else if (usedDocTypeIds.has(docTypeId))
      e.docType = `A ${docTypeName(docTypeId)} document has already been added for this vehicle`
    setErrors(p => ({ ...p, ...e }))
    return Object.keys(e).length === 0
  }

  function docTypeName (id: string) {
    return docTypeOptions.find(o => o.value === id)?.label ?? id
  }

  function addDocWithoutFile () {
    if (!validateDocFields()) return
    const typeName = docTypeName(docTypeId)
    setDocs(p => [
      ...p,
      {
        name: typeName,
        documentTypeId: docTypeId,
        typeName,
        url: '',
        publicId: '',
        storageProvider: '',
        storageKey: '',
        fileSize: 0,
        mimeType: '',
        expiryDate: docExpiry,
        uploading: false,
        error: '',
        tempId: `${Date.now()}`
      }
    ])
    setDocTypeId('')
    setDocExpiry('')
    setErrors(p => {
      const n = { ...p }
      delete n.docType
      return n
    })
  }

  async function handleDocSelect (e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateDocFields()) {
      e.target.value = ''
      return
    }
    setDocUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'vehicle-docs')
    const res = await fetch('/api/fleet/upload', {
      method: 'POST',
      body: fd,
      credentials: 'include'
    })
    const json = await res.json()
    setDocUploading(false)
    if (res.ok && json.data?.url) {
      const typeName = docTypeName(docTypeId)
      setDocs(p => [
        ...p,
        {
          name: typeName,
          documentTypeId: docTypeId,
          typeName,
          url: json.data.url,
          publicId: json.data.publicId ?? '',
          storageProvider: json.data.storageProvider ?? '',
          storageKey: json.data.storageKey ?? '',
          fileSize: file.size,
          mimeType: file.type,
          expiryDate: docExpiry,
          uploading: false,
          error: '',
          tempId: `${Date.now()}`
        }
      ])
      setDocTypeId('')
      setDocExpiry('')
    } else
      setErrors(p => ({
        ...p,
        docUpload: json.error ?? 'Document upload failed'
      }))
    e.target.value = ''
  }

  function removeDoc (tempId: string) {
    setDocs(p => p.filter(d => d.tempId !== tempId))
  }

  function validate () {
    const e: Record<string, string> = {}
    if (!plateNumber.trim()) e.plateNumber = 'Plate number required'
    if (!make.trim()) e.make = 'Make required'
    if (!model.trim()) e.model = 'Model required'
    if (!year || isNaN(+year) || +year < 1990) e.year = 'Valid year required'
    if (!category) e.category = 'Select vehicle category'
    if (!chassisNumber.trim()) e.chassisNumber = 'Chassis / VIN required'
    if (!entityId) e.entityId = 'Select an entity'
    if (isStatus && !staffName.trim()) e.staffName = 'Staff name required'
    if (mileage.trim() === '' || isNaN(+mileage) || +mileage < 0)
      e.mileage = 'Current mileage is required'
    if (!vendorId) e.vendorId = 'Select a purchase vendor'
    if (!purchaseDate) e.purchaseDate = 'Purchase date is required'
    if (!acqValue.trim() || isNaN(+acqValue) || +acqValue <= 0)
      e.acqValue = 'Acquisition value is required'
    if (!usefulLife.trim() || isNaN(+usefulLife) || +usefulLife <= 0)
      e.usefulLife = 'Useful life is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit (ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    const payload: any = {
      plateNumber: plateNumber.replace(/\s+/g, '').toUpperCase(),
      make,
      model,
      year: parseInt(year),
      category,
      vehicleUse,
      status,
      colour: colour || undefined,
      chassisNumber: chassisNumber.toUpperCase(),
      engineNumber: engineNumber.toUpperCase() || undefined,
      mileage: parseFloat(mileage) || 0,
      entityId,
      assignedDriverId: (!isStatus && driverId) || undefined,
      purchaseVendorId: vendorId || undefined,
      purchaseDate: purchaseDate
        ? new Date(purchaseDate).toISOString()
        : undefined,
      acquisitionValueNgn: acqVal || undefined,
      usefulLifeYears: lifeYrs
    }
    if (isStatus) {
      payload.statusStaffName = staffName || undefined
      payload.statusStaffDept = staffDept || undefined
      payload.statusStaffRole = staffRole || undefined
      payload.statusStaffId = staffId || undefined
      payload.statusStaffPhone = staffPhone || undefined
      payload.statusStaffEmail = staffEmail || undefined
    }
    if (photos.length)
      payload.photos = photos.map((p, i) => ({
        url: p.url,
        publicId: p.publicId,
        storageProvider: p.storageProvider || undefined,
        storageKey: p.storageKey || undefined,
        isPrimary: i === 0
      }))
    if (docs.length)
      payload.documents = docs.map(d => ({
        name: d.name,
        documentTypeId: d.documentTypeId,
        url: d.url || undefined,
        publicId: d.publicId || undefined,
        storageProvider: d.storageProvider || undefined,
        storageKey: d.storageKey || undefined,
        fileSize: d.fileSize || undefined,
        mimeType: d.mimeType || undefined,
        expiryDate: d.expiryDate || undefined
      }))
    const { data, error } = await mutate('POST', '/api/fleet/vehicles', payload)
    if (!error && data) router.push(`/fleet/vehicles/${(data as any).id}`)
  }

  return (
    <div className='animate-fade-in max-w-2xl'>
      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <button
        onClick={() => router.push('/fleet/vehicles')}
        className='inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors'
      >
        <ChevronLeft size={14} /> Back to Vehicles
      </button>
      <div className='flex items-center gap-3 mb-6'>
        <div className='h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center'>
          <Truck size={20} className='text-brand-navy dark:text-brand-gold' />
        </div>
        <div>
          <h2 className='text-[20px] font-bold text-foreground'>
            Add New Vehicle
          </h2>
          <p className='text-[12px] text-muted-foreground'>
            Register a vehicle to the fleet
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className='space-y-5'>
        <div className='bg-card border border-border rounded-xl p-5'>
          <p className='text-[13px] font-semibold text-foreground mb-1 pb-2 border-b border-border'>
            Vehicle Photos
            <span className='text-muted-foreground text-[11px] font-normal ml-1.5'>
              — optional · first = primary · click to magnify
            </span>
          </p>
          <p className='text-[11.5px] text-muted-foreground mb-3 mt-2'>
            Photos can also be added or updated later from the vehicle detail
            page.
          </p>
          <div className='flex flex-wrap gap-3'>
            {photos.map((p, i) => (
              <div
                key={i}
                className={`relative rounded-xl overflow-hidden border-2 w-24 h-24 group cursor-zoom-in ${
                  i === 0
                    ? 'border-brand-navy/60 dark:border-brand-gold/60'
                    : 'border-border'
                }`}
              >
                <img
                  src={p.preview}
                  alt=''
                  className='w-full h-full object-cover'
                  onClick={() => setLightboxIndex(i)}
                />
                <div className='absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none'>
                  <ZoomIn size={22} className='text-white drop-shadow' />
                </div>
                {i === 0 && (
                  <span className='absolute bottom-0 left-0 right-0 bg-brand-navy/85 text-brand-gold text-[8.5px] font-bold text-center py-0.5'>
                    PRIMARY
                  </span>
                )}
                <button
                  type='button'
                  onClick={() =>
                    setPhotos(prev => prev.filter((_, idx) => idx !== i))
                  }
                  className='absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 z-10'
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button
              type='button'
              onClick={() => photoRef.current?.click()}
              disabled={uploading}
              className='h-24 w-24 rounded-xl border-2 border-dashed border-border hover:border-brand-navy/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-brand-navy dark:hover:text-brand-gold transition-colors disabled:opacity-60'
            >
              {uploading ? (
                <Loader2 size={20} className='animate-spin' />
              ) : (
                <>
                  <Camera size={20} />
                  <span className='text-[10px] font-medium'>Add Photo</span>
                </>
              )}
            </button>
          </div>
          <input
            ref={photoRef}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            multiple
            className='hidden'
            onChange={handlePhotoSelect}
          />
          {uploadErr && (
            <p className='text-[11px] text-red-500 mt-2'>{uploadErr}</p>
          )}
        </div>

        <div className='bg-card border border-border rounded-xl p-5'>
          <p className='text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border'>
            Vehicle Identification
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {[
              {
                label: 'Plate Number',
                val: plateNumber,
                set: (v: string) => setPlate(v.replace(/\s+/g, '').toUpperCase()),
                ph: 'e.g. LG-001-AA',
                key: 'plateNumber',
                mono: true,
                req: true
              },
              {
                label: 'Chassis / VIN',
                val: chassisNumber,
                set: (v: string) => setChassis(v.toUpperCase()),
                ph: '17-char VIN',
                key: 'chassisNumber',
                mono: true,
                req: true
              },
              {
                label: 'Make',
                val: make,
                set: setMake,
                ph: 'e.g. Toyota',
                key: 'make',
                req: true
              },
              {
                label: 'Model',
                val: model,
                set: setModel,
                ph: 'e.g. Camry',
                key: 'model',
                req: true
              },
              {
                label: 'Engine Number',
                val: engineNumber,
                set: (v: string) => setEngine(v.toUpperCase()),
                ph: 'Optional',
                key: 'engineNumber',
                mono: true
              },
              {
                label: 'Colour',
                val: colour,
                set: setColour,
                ph: 'e.g. Silver',
                key: 'colour'
              }
            ].map(f => (
              <div key={f.key} className='flex flex-col gap-1.5'>
                <label className='text-[12px] font-medium text-foreground'>
                  {f.label}
                  {f.req ? REQ : ''}
                </label>
                <input
                  className={`${INP}${f.mono ? ' uppercase font-mono' : ''}`}
                  placeholder={f.ph}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                />
                {f.req && errors[f.key] && (
                  <p className='text-[11px] text-red-500'>{errors[f.key]}</p>
                )}
              </div>
            ))}
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Year{REQ}
              </label>
              <input
                type='number'
                min={1990}
                max={2030}
                className={INP}
                placeholder='e.g. 2022'
                value={year}
                onChange={e => setYear(e.target.value)}
              />
              {errors.year && (
                <p className='text-[11px] text-red-500'>{errors.year}</p>
              )}
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Category{REQ}
              </label>
              <SearchableSelect
                options={CATEGORY_OPTS}
                value={category}
                onChange={setCategory}
                placeholder='Select'
                error={errors.category}
              />
            </div>
          </div>
        </div>

        <div className='bg-card border border-border rounded-xl p-5'>
          <p className='text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border'>
            Usage &amp; Assignment
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Vehicle Use
              </label>
              <SearchableSelect
                options={USE_OPTS}
                value={vehicleUse}
                onChange={setUse}
                placeholder='Select'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Initial Status
              </label>
              <SearchableSelect
                options={STATUS_OPTS}
                value={status}
                onChange={setStatus}
                placeholder='Status'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Current Mileage (km){REQ}
              </label>
              <input
                type='number'
                min={0}
                className={INP}
                value={mileage}
                onChange={e => setMileage(e.target.value)}
              />
              {errors.mileage && (
                <p className='text-[11px] text-red-500'>{errors.mileage}</p>
              )}
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Entity{REQ}
              </label>
              <SearchableSelect
                options={entityOptions}
                value={entityId}
                onChange={setEntityId}
                placeholder='Select entity'
                error={errors.entityId}
              />
            </div>
            {!isStatus && (
              <div className='flex flex-col gap-1.5'>
                <label className='text-[12px] font-medium text-foreground'>
                  Assign Driver
                </label>
                <SearchableSelect
                  options={driverOptions}
                  value={driverId}
                  onChange={setDriverId}
                  placeholder='Unassigned'
                />
              </div>
            )}
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Purchase Vendor{REQ}
              </label>
              <SearchableSelect
                options={vendorOptions}
                value={vendorId}
                onChange={setVendorId}
                placeholder={venRes ? 'Select vendor…' : 'Loading vendors…'}
                error={errors.vendorId}
              />
            </div>
          </div>
        </div>

        {isStatus && (
          <div className='bg-card border border-border rounded-xl p-5'>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-border'>
              <p className='text-[13px] font-semibold text-foreground'>
                Assigned Staff Details
              </p>
              <span className='rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-semibold px-2 py-0.5'>
                Status Vehicle
              </span>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {[
                {
                  label: 'Staff Full Name',
                  val: staffName,
                  set: setStaffName,
                  ph: 'e.g. Adaeze Okafor',
                  req: true,
                  key: 'staffName'
                },
                {
                  label: 'Department',
                  val: staffDept,
                  set: setStaffDept,
                  ph: 'e.g. Executive Office'
                },
                {
                  label: 'Job Title',
                  val: staffRole,
                  set: setStaffRole,
                  ph: 'e.g. Managing Director'
                },
                {
                  label: 'Staff ID',
                  val: staffId,
                  set: setStaffId,
                  ph: 'e.g. AMB-001'
                },
                {
                  label: 'Phone',
                  val: staffPhone,
                  set: setStaffPhone,
                  ph: '08012000001'
                },
                {
                  label: 'Email',
                  val: staffEmail,
                  set: setStaffEmail,
                  ph: 'staff@addosser.ng'
                }
              ].map((f: any) => (
                <div key={f.label} className='flex flex-col gap-1.5'>
                  <label className='text-[12px] font-medium text-foreground'>
                    {f.label}
                    {f.req ? REQ : ''}
                  </label>
                  <input
                    className={INP}
                    placeholder={f.ph}
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                  />
                  {f.req && errors[f.key] && (
                    <p className='text-[11px] text-red-500'>{errors[f.key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='bg-card border border-border rounded-xl p-5'>
          <p className='text-[13px] font-semibold text-foreground mb-4 pb-2 border-b border-border'>
            Financial Details &amp; Depreciation
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Purchase Date{REQ}
              </label>
              <input
                type='date'
                className={INP}
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
              {errors.purchaseDate && (
                <p className='text-[11px] text-red-500'>{errors.purchaseDate}</p>
              )}
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Acquisition Value (₦){REQ}
              </label>
              <input
                type='number'
                min={0}
                className={INP}
                placeholder='e.g. 25000000'
                value={acqValue}
                onChange={e => setAcqValue(e.target.value)}
              />
              {errors.acqValue && (
                <p className='text-[11px] text-red-500'>{errors.acqValue}</p>
              )}
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-[12px] font-medium text-foreground'>
                Useful Life (years){REQ}
              </label>
              <input
                type='number'
                min={1}
                max={30}
                className={INP}
                value={usefulLife}
                onChange={e => setUsefulLife(e.target.value)}
              />
              {errors.usefulLife && (
                <p className='text-[11px] text-red-500'>{errors.usefulLife}</p>
              )}
            </div>
          </div>
          <DepreciationPreview
            cost={acqVal}
            years={lifeYrs}
            purchaseDate={purchaseDate}
          />
        </div>

        <div className='bg-card border border-border rounded-xl p-5'>
          <div className='flex items-center gap-2 mb-1 pb-2 border-b border-border'>
            <FileText
              size={14}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Vehicle Documents
            </p>
            <span className='text-muted-foreground text-[11px] font-normal ml-1'>
              — optional · can also be added later
            </span>
          </div>
          <p className='text-[11.5px] text-muted-foreground mb-4 mt-2'>
            Attach insurance certificates, roadworthiness, registration, and
            other official documents.
          </p>
          <div className='rounded-xl border border-border bg-muted/20 p-4 mb-4'>
            <p className='text-[12px] font-semibold text-foreground mb-3'>
              Add New Document
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3'>
              <div className='flex flex-col gap-1'>
                <label className='text-[11px] font-medium text-muted-foreground'>
                  Document Type{REQ}
                </label>
                <SearchableSelect
                  options={availableDocTypeOptions}
                  value={docTypeId}
                  onChange={v => {
                    setDocTypeId(v)
                    setErrors(p => {
                      const n = { ...p }
                      delete n.docType
                      return n
                    })
                  }}
                  placeholder={
                    !docTypeOptions.length
                      ? 'Loading types…'
                      : !availableDocTypeOptions.length
                      ? 'All document types already added'
                      : 'Select type…'
                  }
                  disabled={docTypeOptions.length > 0 && availableDocTypeOptions.length === 0}
                />
                {errors.docType && (
                  <p className='text-[10px] text-red-500'>{errors.docType}</p>
                )}
              </div>
              <div className='flex flex-col gap-1'>
                <label className='text-[11px] font-medium text-muted-foreground'>
                  Expiry Date
                </label>
                <input
                  type='date'
                  className={INP}
                  value={docExpiry}
                  onChange={e => setDocExpiry(e.target.value)}
                />
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                onClick={addDocWithoutFile}
                disabled={docUploading}
                className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors disabled:opacity-60'
              >
                <FileText size={13} />
                Add Document
              </button>
              <button
                type='button'
                onClick={() => docRef.current?.click()}
                disabled={docUploading}
                className='inline-flex items-center gap-2 rounded-lg border border-brand-navy/30 dark:border-brand-gold/30 bg-brand-navy/[0.05] dark:bg-brand-gold/[0.05] px-4 py-2 text-[12.5px] font-medium text-brand-navy dark:text-brand-gold hover:bg-brand-navy/[0.1] transition-colors disabled:opacity-60'
              >
                {docUploading ? (
                  <Loader2 size={13} className='animate-spin' />
                ) : (
                  <Paperclip size={13} />
                )}
                {docUploading ? 'Uploading…' : 'Add with File Attached'}
              </button>
              <span className='text-[10.5px] text-muted-foreground'>
                — a physical file is optional
              </span>
            </div>
            <input
              ref={docRef}
              type='file'
              accept='.pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.csv,.doc'
              className='hidden'
              onChange={handleDocSelect}
            />
            {errors.docUpload && (
              <p className='text-[11px] text-red-500 mt-2'>
                {errors.docUpload}
              </p>
            )}
          </div>
          {docs.length === 0 ? (
            <div className='text-center py-6 text-[12.5px] text-muted-foreground'>
              <FileText size={28} className='mx-auto mb-2 opacity-30' />
              No documents attached yet
            </div>
          ) : (
            <div className='space-y-2'>
              {docs.map(doc => (
                <div
                  key={doc.tempId}
                  className='flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3'
                >
                  <FileText
                    size={16}
                    className='text-brand-navy dark:text-brand-gold flex-shrink-0'
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='text-[12.5px] font-semibold text-foreground truncate'>
                      {doc.name}
                    </p>
                    <div className='flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5'>
                      {doc.expiryDate && (
                        <span>
                          Expires:{' '}
                          {new Date(doc.expiryDate).toLocaleDateString('en-NG')}
                        </span>
                      )}
                      {doc.url ? (
                        <span>
                          {(doc.fileSize / 1024).toFixed(0)} KB ·{' '}
                          {extFromMime(doc.mimeType).toUpperCase()}
                        </span>
                      ) : (
                        <span className='italic'>No file attached</span>
                      )}
                    </div>
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      download={safeFilename(doc.name, doc.mimeType)}
                      className='inline-flex items-center gap-1 text-[11px] text-brand-navy dark:text-brand-gold hover:underline flex-shrink-0'
                    >
                      <Download size={11} /> Download
                    </a>
                  )}
                  <button
                    type='button'
                    onClick={() => removeDoc(doc.tempId)}
                    className='h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 flex-shrink-0'
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div className='p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300'>
            {saveError}
          </div>
        )}

        <div className='flex gap-3'>
          <button
            type='submit'
            disabled={saving || uploading || docUploading}
            className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors'
          >
            {saving ? (
              <Loader2 size={14} className='animate-spin' />
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Saving…' : 'Create Vehicle'}
          </button>
          <button
            type='button'
            onClick={() => router.push('/fleet/vehicles')}
            className='rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors'
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
