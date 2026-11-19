'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Scan, Info, AlertCircle } from 'lucide-react'
import { MONTHS } from '@/lib/utils'
import VendorAutocomplete from '@/components/shared/VendorAutocomplete'

const DepreciationPreview = dynamic(() => import('./DepreciationPreview'), {
  ssr: false
})
const BarcodeScanner = dynamic(() => import('./BarcodeScanner'), { ssr: false })

interface Classification {
  id: string
  name: string
  code: string | null
  glAccountCode?: string | null
}
interface GLAccount {
  id: string
  code: string
  name: string
  category: string
}
interface Branch {
  id: string
  name: string
  code: string | null
}
interface EntityData {
  id: string
  name: string
  code: string
  branches: Branch[]
}
interface UserOpt {
  id: string
  name: string
  email: string
}

interface AssetFormProps {
  entities: EntityData[]
  glAccounts: GLAccount[]
  users: UserOpt[]
  classifications?: Classification[]
  asset?: Record<string, any>
}

const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const
const DEPR_METHODS = ['STRAIGHT_LINE', 'REDUCING_BALANCE', 'NONE'] as const
const DEPR_LABELS: Record<string, string> = {
  STRAIGHT_LINE: 'Straight-Line (SLM)',
  REDUCING_BALANCE: 'Reducing Balance (RBM)',
  NONE: 'No Depreciation'
}

function resolveGLLabel (
  glCode: string | undefined,
  glAccounts: GLAccount[]
): string {
  if (!glCode) return ''
  const found = glAccounts.find(g => g.code === glCode)
  return found ? `${found.code} — ${found.name}` : glCode
}

function resolveClassifLabel (
  classifId: string | undefined,
  classifications: Classification[] | undefined
): string {
  if (!classifId || !classifications) return ''
  const found = classifications.find(c => c.id === classifId)
  return found ? found.name : ''
}

interface SectionToggleProps {
  idx: number
  title: string
  icon: string
  active: number
  toggle: (n: number) => void
}

function SectionToggle (p: SectionToggleProps) {
  function handleClick () {
    p.toggle(p.active === p.idx ? -1 : p.idx)
  }
  return (
    <button
      type='button'
      onClick={handleClick}
      className='w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-accent/30 transition-colors'
    >
      <span className='text-xl'>{p.icon}</span>
      <span className='font-bold text-foreground text-sm flex-1'>
        {p.title}
      </span>
      <span className='text-muted-foreground text-sm'>
        {p.active === p.idx ? '▲' : '▼'}
      </span>
    </button>
  )
}

export default function AssetForm (props: AssetFormProps) {
  const { entities, glAccounts, users, asset } = props
  const classifications = props.classifications ?? []
  const router = useRouter()
  const isEdit = !!asset

  const [section, setSection] = useState<number>(0)
  const [showScan, setShowScan] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const [barcodeTag, setBarcode] = useState<string>(asset?.barcodeTag ?? '')
  const [assetNo, setAssetNo] = useState<string>(asset?.assetNo ?? '')
  const [serialNo, setSerial] = useState<string>(asset?.serialNo ?? '')
  const [name, setName] = useState<string>(asset?.name ?? '')
  const [description, setDesc] = useState<string>(asset?.description ?? '')
  const [make, setMake] = useState<string>(asset?.make ?? '')
  const [model, setModel] = useState<string>(asset?.model ?? '')
  const [tags, setTags] = useState<string>(asset?.tags ?? '')

  const [classifSearch, setClassifSearch] = useState<string>(
    resolveClassifLabel(asset?.classificationId, classifications)
  )
  const [classifId, setClassifId] = useState<string>(
    asset?.classificationId ?? ''
  )
  const [classifOpen, setClassifOpen] = useState<boolean>(false)
  const [isMovable, setMovable] = useState<boolean>(asset?.isMovable ?? true)
  const classifRef = useRef<HTMLDivElement>(null)

  const [entityId, setEntityId] = useState<string>(
    asset?.entityId ?? entities[0]?.id ?? ''
  )
  const [branchId, setBranchId] = useState<string>(asset?.branchId ?? '')
  const [location, setLocation] = useState<string>(asset?.location ?? '')

  const [branchSearch, setBranchSearch] = useState<string>('')
  const [branchOpen, setBranchOpen] = useState<boolean>(false)
  const branchRef = useRef<HTMLDivElement>(null)

  const [assignedToId, setAssigned] = useState<string>(
    asset?.assignedToId ?? ''
  )
  const [condition, setCondition] = useState<string>(asset?.condition ?? 'GOOD')

  const [purchaseDate, setPurchDate] = useState<string>(
    asset?.purchaseDate
      ? new Date(asset.purchaseDate).toISOString().split('T')[0]
      : ''
  )
  const [acquisitionValue, setAcqVal] = useState<string>(
    asset?.acquisitionValue ? String(Number(asset.acquisitionValue)) : ''
  )
  const [quantity, setQuantity] = useState<number>(asset?.quantity ?? 1)
  const [residualValue, setResidual] = useState<string>(
    asset?.residualValue ? String(Number(asset.residualValue)) : ''
  )
  const [usefulLifeYrs, setLifeYrs] = useState<number>(
    asset?.usefulLifeYrs ?? 4
  )
  const [deprMethod, setDeprMethod] = useState<string>(
    asset?.depreciationMethod ?? 'STRAIGHT_LINE'
  )

  const [supplier, setSupplier] = useState<string>(asset?.supplier ?? '')
  const [invoiceRef, setInvoiceRef] = useState<string>(asset?.invoiceRef ?? '')
  const [warrantyExpiry, setWarranty] = useState<string>(
    asset?.warrantyExpiry
      ? new Date(asset.warrantyExpiry).toISOString().split('T')[0]
      : ''
  )
  const [insuranceExpiry, setInsurance] = useState<string>(
    asset?.insuranceExpiry
      ? new Date(asset.insuranceExpiry).toISOString().split('T')[0]
      : ''
  )

  const [glSearch, setGlSearch] = useState<string>(
    resolveGLLabel(asset?.glAccountCode, glAccounts)
  )
  const [glCode, setGlCode] = useState<string>(asset?.glAccountCode ?? '')
  const [glOpen, setGlOpen] = useState<boolean>(false)
  const [budgetRef, setBudgetRef] = useState<string>(asset?.budgetRef ?? '')
  const glRef = useRef<HTMLDivElement>(null)

  const [photos, setPhotos] = useState<string[]>(
    asset?.photos
      ? (() => {
          try {
            return JSON.parse(asset.photos)
          } catch {
            return []
          }
        })()
      : []
  )
  const [uploading, setUploading] = useState<boolean>(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  interface StagedDocument { file: File; title: string; documentType: string }
  const [stagedDocuments, setStagedDocuments] = useState<StagedDocument[]>([])
  const docInputRef = useRef<HTMLInputElement>(null)
  const DOCUMENT_TYPES = [
    { value: 'PURCHASE_INVOICE', label: 'Purchase Invoice' },
    { value: 'WARRANTY',         label: 'Warranty Certificate' },
    { value: 'MANUAL',           label: 'User / Service Manual' },
    { value: 'CONTRACT',         label: 'Contract' },
    { value: 'INSURANCE',        label: 'Insurance Certificate' },
    { value: 'OTHER',            label: 'Other' },
  ]

  function handleDocumentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setStagedDocuments(prev => [
      ...prev,
      ...files.map(file => ({ file, title: file.name, documentType: 'OTHER' })),
    ].slice(0, 10))
    if (docInputRef.current) docInputRef.current.value = ''
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function uploadStagedDocuments(assetId: string) {
    for (const doc of stagedDocuments) {
      try {
        const fileBase64 = await readFileAsDataUrl(doc.file)
        await fetch(`/api/assets/${assetId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: doc.documentType,
            title: doc.title || doc.file.name,
            fileBase64,
            mimeType: doc.file.type,
          }),
        })
      } catch {
      }
    }
  }

  const currentEntity = entities.find(e => e.id === entityId)
  const entityBranches = currentEntity?.branches ?? []
  const filteredBranches = entityBranches.filter(
    b =>
      b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
      (b.code?.toLowerCase().includes(branchSearch.toLowerCase()) ?? false)
  )
  const selectedBranch = entityBranches.find(b => b.id === branchId)

  const capexGLAccounts =
    glAccounts.filter(
      gl =>
        gl.category.toLowerCase().includes('vehicle') ||
        gl.category.toLowerCase().includes('equipment') ||
        gl.category.toLowerCase().includes('technology') ||
        gl.category.toLowerCase().includes('property') ||
        gl.category.toLowerCase().includes('furniture') ||
        gl.category.toLowerCase().includes('capital')
    ).length > 0
      ? glAccounts
      : glAccounts

  const filteredGL = capexGLAccounts.filter(gl => {
    const q = glSearch.toLowerCase()
    return (
      gl.code.toLowerCase().includes(q) ||
      gl.name.toLowerCase().includes(q) ||
      gl.category.toLowerCase().includes(q)
    )
  })

  const filteredClassif = classifications.filter(
    c =>
      c.name.toLowerCase().includes(classifSearch.toLowerCase()) ||
      (c.code?.toLowerCase().includes(classifSearch.toLowerCase()) ?? false)
  )

  useEffect(() => {
    if (!isEdit) {
      setBranchId('')
      setBranchSearch('')
    }
  }, [entityId, isEdit])

  useEffect(() => {
    function handle (e: MouseEvent) {
      const t = e.target as Node
      if (classifRef.current && !classifRef.current.contains(t))
        setClassifOpen(false)
      if (branchRef.current && !branchRef.current.contains(t))
        setBranchOpen(false)
      if (glRef.current && !glRef.current.contains(t)) setGlOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length) return
      setUploading(true)
      const urls: string[] = []
      for (const file of files.slice(0, 5)) {
        const reader = new FileReader()
        const dataUrl = await new Promise<string>(resolve => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: dataUrl, folder: 'assets' })
          })
          const data = await res.json()
          if (data.success) urls.push(data.data.url)
        } catch {
        }
      }
      setPhotos(prev => [...prev, ...urls].slice(0, 5))
      setUploading(false)
    },
    []
  )

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!branchId) {
      setError('Branch is required — please select a branch.')
      setSection(1)
      return
    }
    if (!classifId) {
      setError('Asset Classification is required.')
      setSection(0)
      return
    }
    if (!name.trim()) {
      setError('Asset name is required.')
      setSection(0)
      return
    }
    if (purchaseDate && purchaseDate > todayStr) {
      setError('Purchase Date cannot be in the future.')
      setSection(2)
      return
    }
    if (!supplier.trim()) {
      setError('Supplier / Vendor is required.')
      setSection(3)
      return
    }

    setLoading(true)
    try {
      const payload = {
        entityId,
        branchId,
        name: name.trim(),
        description: description || undefined,
        classificationId: classifId,
        make: make || undefined,
        model: model || undefined,
        tags: tags || undefined,
        barcodeTag: barcodeTag || undefined,
        serialNo: serialNo || undefined,
        isMovable,
        location: location || undefined,
        assignedToId: assignedToId || undefined,
        condition,
        purchaseDate: purchaseDate || undefined,
        acquisitionValue: acquisitionValue
          ? Number(acquisitionValue)
          : undefined,
        ...(!isEdit ? { quantity } : {}),
        residualValue: residualValue ? Number(residualValue) : undefined,
        usefulLifeYrs,
        depreciationMethod: deprMethod,
        supplier: supplier || undefined,
        invoiceRef: invoiceRef || undefined,
        warrantyExpiry: warrantyExpiry || undefined,
        insuranceExpiry: insuranceExpiry || undefined,
        glAccountCode: glCode || undefined,
        budgetRef: budgetRef || undefined,
        photos: photos.length > 0 ? JSON.stringify(photos) : undefined
      }

      const url = isEdit ? `/api/assets/${asset.id}` : '/api/assets'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (!res.ok) {
        if (data?.details) {
          const msgs = Object.entries(data.details as Record<string, string[]>)
            .filter(([, v]) => (v as string[])?.length)
            .map(([k, v]) => `${k}: ${(v as string[])[0]}`)
            .slice(0, 3)
            .join(' | ')
          throw new Error(msgs || data.error || 'Validation failed')
        }
        throw new Error(data.error ?? 'Failed to save asset')
      }

      if (!isEdit && stagedDocuments.length > 0) {
        await uploadStagedDocuments(data.data.id)
      }

      router.push(`/assets/${data.data.id}/preview`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const ic =
    'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
  const lbl =
    'block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'
  const sc = 'bg-card border border-border rounded-2xl overflow-hidden'

  const todayStr = new Date(
    new Date().getTime() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .split('T')[0]

  return (
    <form onSubmit={handleSubmit} className='space-y-4 max-w-3xl'>
      {error && (
        <div className='flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'>
          <AlertCircle
            size={16}
            className='text-red-600 flex-shrink-0 mt-0.5'
          />
          <p className='text-sm font-medium text-red-700 dark:text-red-400'>
            {error}
          </p>
        </div>
      )}

      {isEdit && assetNo ? (
        <div className='flex items-center gap-3 px-4 py-3 bg-[#1B2A8A]/5 border border-[#1B2A8A]/20 rounded-xl'>
          <span className='text-xs text-muted-foreground font-medium'>
            Asset Tag
          </span>
          <code className='font-extrabold text-sm text-[#1B2A8A] dark:text-blue-300 tracking-wider'>
            {assetNo}
          </code>
          <span className='text-xs text-muted-foreground ml-auto'>
            Auto-generated · Read-only
          </span>
        </div>
      ) : !isEdit ? (
        <div className='flex items-center gap-2 px-4 py-3 bg-muted/40 border border-dashed border-border rounded-xl'>
          <Info size={14} className='text-muted-foreground flex-shrink-0' />
          <p className='text-xs text-muted-foreground'>
            Asset tag auto-generated as{' '}
            <strong>EntityCode/BranchCode/SequenceNo</strong> (e.g.
            AFL/HO/000005) on save.
          </p>
        </div>
      ) : null}

      <div className={sc}>
        <SectionToggle
          idx={0}
          title='Asset Identity'
          icon='🏷️'
          active={section}
          toggle={setSection}
        />
        {section === 0 && (
          <div className='p-6 space-y-4'>
            <div>
              <label className={lbl}>Barcode / QR Code</label>
              <div className='flex gap-2'>
                <input
                  className={ic}
                  value={barcodeTag}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder='Scan or type barcode…'
                />
                <button
                  type='button'
                  onClick={() => setShowScan(s => !s)}
                  className='flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-accent'
                >
                  <Scan size={15} /> Scan
                </button>
              </div>
              {showScan && (
                <div className='mt-2'>
                  <BarcodeScanner
                    currentValue={barcodeTag}
                    onScan={(code: string) => {
                      setBarcode(code)
                      setSerial(code)
                      setShowScan(false)
                    }}
                  />
                </div>
              )}
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>
                  Asset Name <span className='text-red-500'>*</span>
                </label>
                <input
                  className={ic}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='e.g. Toyota HiLux 2022'
                  required
                />
              </div>
              <div>
                <label className={lbl}>
                  Serial Number{' '}
                  <span className='text-muted-foreground font-normal normal-case'>
                    (optional)
                  </span>
                </label>
                <input
                  className={ic}
                  value={serialNo}
                  onChange={e => setSerial(e.target.value)}
                  placeholder='Manufacturer serial no.'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>Make / Brand</label>
                <input
                  className={ic}
                  value={make}
                  onChange={e => setMake(e.target.value)}
                  placeholder='e.g. Toyota'
                />
              </div>
              <div>
                <label className={lbl}>Model</label>
                <input
                  className={ic}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder='e.g. HiLux'
                />
              </div>
            </div>

            <div>
              <label className={lbl}>Description</label>
              <textarea
                className={ic}
                rows={2}
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder='Brief description of this asset…'
              />
            </div>

            <div>
              <label className={lbl}>
                Tags{' '}
                <span className='text-muted-foreground font-normal normal-case'>
                  (comma-separated)
                </span>
              </label>
              <input
                className={ic}
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder='e.g. vehicle, fleet, head-office'
              />
            </div>
          </div>
        )}
      </div>

      <div className={sc}>
        <SectionToggle
          idx={1}
          title='Classification & Location'
          icon='📍'
          active={section}
          toggle={setSection}
        />
        {section === 1 && (
          <div className='p-6 space-y-4'>
            <div>
              <label className={lbl}>
                Asset Classification <span className='text-red-500'>*</span>
              </label>
              <div className='relative' ref={classifRef}>
                <input
                  className={ic}
                  value={classifSearch}
                  onChange={e => {
                    setClassifSearch(e.target.value)
                    setClassifId('')
                    setClassifOpen(true)
                  }}
                  onFocus={() => setClassifOpen(true)}
                  placeholder='Search classifications (e.g. Vehicle, IT Equipment)…'
                  autoComplete='off'
                />
                {classifOpen && (
                  <div className='absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                    {filteredClassif.length === 0 ? (
                      <div className='px-4 py-3 text-sm text-muted-foreground'>
                        No classifications match. Ask admin to create one.
                      </div>
                    ) : (
                      filteredClassif.map(c => (
                        <button
                          key={c.id}
                          type='button'
                          onClick={() => {
                            setClassifId(c.id)
                            setClassifSearch(c.name)
                            setClassifOpen(false)
                          }}
                          className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center justify-between'
                        >
                          <span className='font-medium text-foreground'>
                            {c.name}
                          </span>
                          {c.code && (
                            <span className='text-xs text-muted-foreground'>
                              {c.code}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {classifId && (
                <p className='text-xs text-green-600 dark:text-green-400 mt-1 font-medium'>
                  ✓ {classifSearch}
                </p>
              )}
            </div>

            <div className='flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border'>
              <div>
                <div className='text-sm font-semibold text-foreground'>
                  Movable Asset
                </div>
                <div className='text-xs text-muted-foreground mt-0.5'>
                  Non-movable assets cannot be reallocated or have their
                  location changed
                </div>
              </div>
              <button
                type='button'
                onClick={() => setMovable(v => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  isMovable ? 'bg-[#FFB800]' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    isMovable ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>
                  Entity <span className='text-red-500'>*</span>
                </label>
                <select
                  className={ic}
                  value={entityId}
                  onChange={e => setEntityId(e.target.value)}
                  required
                >
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>
                  Branch <span className='text-red-500'>*</span>
                </label>
                <div className='relative' ref={branchRef}>
                  <input
                    className={ic}
                    value={
                      branchOpen ? branchSearch : selectedBranch?.name ?? ''
                    }
                    onChange={e => {
                      setBranchSearch(e.target.value)
                      setBranchOpen(true)
                    }}
                    onFocus={() => {
                      setBranchSearch('')
                      setBranchOpen(true)
                    }}
                    placeholder='Search branches…'
                    autoComplete='off'
                  />
                  {branchOpen && (
                    <div className='absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                      {filteredBranches.length === 0 ? (
                        <div className='px-4 py-3 text-sm text-muted-foreground'>
                          No branches found. Ask admin to create branches.
                        </div>
                      ) : (
                        filteredBranches.map(b => (
                          <button
                            key={b.id}
                            type='button'
                            onClick={() => {
                              setBranchId(b.id)
                              setBranchOpen(false)
                            }}
                            className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center justify-between'
                          >
                            <span className='text-foreground'>{b.name}</span>
                            {b.code && (
                              <span className='text-xs text-muted-foreground'>
                                {b.code}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {branchId && !branchOpen && (
                  <p className='text-xs text-green-600 dark:text-green-400 mt-1 font-medium'>
                    ✓ {selectedBranch?.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className={lbl}>
                Specific Location{' '}
                <span className='text-muted-foreground font-normal normal-case'>
                  (room / floor / bay)
                </span>
              </label>
              <input
                className={ic}
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder='e.g. Server Room — Level 2, Rack 3'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>Condition</label>
                <select
                  className={ic}
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                >
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Assigned To</label>
                <select
                  className={ic}
                  value={assignedToId}
                  onChange={e => setAssigned(e.target.value)}
                >
                  <option value=''>— Unassigned —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={sc}>
        <SectionToggle
          idx={2}
          title='Financial Details & Depreciation'
          icon='📊'
          active={section}
          toggle={setSection}
        />
        {section === 2 && (
          <div className='p-6 space-y-4'>
            <div className='grid grid-cols-3 gap-4'>
              <div>
                <label className={lbl}>Purchase Date</label>
                <input
                  type='date'
                  className={ic}
                  value={purchaseDate}
                  max={todayStr}
                  onChange={e => setPurchDate(e.target.value)}
                />
              </div>
              {!isEdit && (
                <div>
                  <label className={lbl}>Quantity <span className='normal-case font-normal'>(bulk registration)</span></label>
                  <input
                    type='number'
                    min={1}
                    step={1}
                    className={ic}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  <p className='text-xs text-muted-foreground mt-1'>
                    {quantity > 1
                      ? `Registers ${quantity} identical units as one entry — split into individually tagged assets later via "Split Asset".`
                      : 'Leave at 1 for a single asset. Set higher to register identical units in bulk.'}
                  </p>
                </div>
              )}
              <div>
                <label className={lbl}>{quantity > 1 ? 'Total Acquisition Value (₦)' : 'Acquisition Value (₦)'}</label>
                <input
                  type='number'
                  min='0'
                  step='0.01'
                  className={ic}
                  value={acquisitionValue}
                  onChange={e => setAcqVal(e.target.value)}
                  placeholder='0.00'
                />
                {quantity > 1 && acquisitionValue && Number(acquisitionValue) > 0 && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Unit cost: ₦{(Number(acquisitionValue) / quantity).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {quantity}
                  </p>
                )}
              </div>
              <div>
                <label className={lbl}>Useful Life (years)</label>
                <input
                  type='number'
                  min='1'
                  max='100'
                  step='1'
                  className={ic}
                  value={usefulLifeYrs}
                  onChange={e => setLifeYrs(parseInt(e.target.value, 10) || 4)}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>Residual / Salvage Value (₦)</label>
                <input
                  type='number'
                  min='0'
                  step='0.01'
                  className={ic}
                  value={residualValue}
                  onChange={e => setResidual(e.target.value)}
                  placeholder='0.00'
                />
              </div>
              <div>
                <label className={lbl}>Depreciation Method</label>
                <select
                  className={ic}
                  value={deprMethod}
                  onChange={e => setDeprMethod(e.target.value)}
                >
                  {DEPR_METHODS.map(m => (
                    <option key={m} value={m}>
                      {DEPR_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {purchaseDate && acquisitionValue && Number(acquisitionValue) > 0 && (
              <div className='mt-2'>
                <DepreciationPreview
                  purchaseDate={purchaseDate}
                  acquisitionValue={Number(acquisitionValue)}
                  residualValue={residualValue ? Number(residualValue) : 0}
                  usefulLifeYrs={usefulLifeYrs}
                  method={
                    deprMethod as 'STRAIGHT_LINE' | 'REDUCING_BALANCE' | 'NONE'
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={sc}>
        <SectionToggle
          idx={3}
          title='Procurement & Warranty'
          icon='🧾'
          active={section}
          toggle={setSection}
        />
        {section === 3 && (
          <div className='p-6 space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>Supplier / Vendor <span className='text-red-500'>*</span></label>
                <VendorAutocomplete
                  value={supplier}
                  onChange={setSupplier}
                  required
                  strict
                  inputClassName={ic}
                />
              </div>
              <div>
                <label className={lbl}>Invoice Reference No.</label>
                <input
                  className={ic}
                  value={invoiceRef}
                  onChange={e => setInvoiceRef(e.target.value)}
                  placeholder='e.g. INV-2024-001'
                />
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={lbl}>Warranty Expiry Date</label>
                <input
                  type='date'
                  className={ic}
                  value={warrantyExpiry}
                  onChange={e => setWarranty(e.target.value)}
                />
              </div>
              <div>
                <label className={lbl}>Insurance Expiry Date</label>
                <input
                  type='date'
                  className={ic}
                  value={insuranceExpiry}
                  onChange={e => setInsurance(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={sc}>
        <SectionToggle
          idx={4}
          title='GL Account & Budget'
          icon='📋'
          active={section}
          toggle={setSection}
        />
        {section === 4 && (
          <div className='p-6 space-y-4'>
            <p className='text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-2 border border-border'>
              ℹ️ Select the <strong>CAPEX GL account</strong> associated with
              this asset (for depreciation and maintenance postings).
            </p>
            <div>
              <label className={lbl}>GL Account (CAPEX)</label>
              <div className='relative' ref={glRef}>
                <input
                  className={ic}
                  value={glSearch}
                  onChange={e => {
                    setGlSearch(e.target.value)
                    setGlCode('')
                    setGlOpen(true)
                  }}
                  onFocus={() => setGlOpen(true)}
                  placeholder='Search by code, name or category…'
                  autoComplete='off'
                />
                {glOpen && (
                  <div className='absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                    {filteredGL.length === 0 ? (
                      <div className='px-4 py-3 text-sm text-muted-foreground'>
                        No GL accounts match
                      </div>
                    ) : (
                      filteredGL.map(gl => (
                        <button
                          key={gl.id}
                          type='button'
                          onClick={() => {
                            setGlCode(gl.code)
                            setGlSearch(`${gl.code} — ${gl.name}`)
                            setGlOpen(false)
                          }}
                          className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center justify-between'
                        >
                          <span>
                            <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-1.5 py-0.5 rounded mr-2'>
                              {gl.code}
                            </code>
                            {gl.name}
                          </span>
                          <span className='text-xs text-muted-foreground ml-4'>
                            {gl.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {glCode && (
                <p className='text-xs text-green-600 dark:text-green-400 mt-1 font-medium'>
                  ✓ {glSearch}
                </p>
              )}
            </div>

            <div>
              <label className={lbl}>
                Linked CAPEX Budget ID{' '}
                <span className='text-muted-foreground font-normal normal-case'>
                  (optional)
                </span>
              </label>
              <input
                className={ic}
                value={budgetRef}
                onChange={e => setBudgetRef(e.target.value)}
                placeholder='Budget record ID from Budgeting module'
              />
            </div>
          </div>
        )}
      </div>

      <div className={sc}>
        <SectionToggle
          idx={5}
          title='Photos & Images'
          icon='📷'
          active={section}
          toggle={setSection}
        />
        {section === 5 && (
          <div className='p-6 space-y-4'>
            <input
              ref={photoInputRef}
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={handlePhotoUpload}
            />
            <div className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading || photos.length >= 5}
                className='px-5 py-2.5 rounded-xl text-sm font-bold border border-border bg-card hover:bg-accent disabled:opacity-50'
              >
                {uploading
                  ? 'Uploading…'
                  : `📷 Add Photos (${photos.length}/5)`}
              </button>
              <span className='text-xs text-muted-foreground'>
                Max 5 photos, any image format
              </span>
            </div>

            {photos.length > 0 && (
              <div className='grid grid-cols-3 gap-3'>
                {photos.map((url, i) => (
                  <div
                    key={i}
                    className='relative group rounded-xl overflow-hidden border border-border aspect-video bg-muted'
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className='w-full h-full object-cover'
                    />
                    <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                      <a
                        href={url}
                        download
                        target='_blank'
                        rel='noopener noreferrer'
                        onClick={e => e.stopPropagation()}
                        className='w-8 h-8 bg-white/90 text-gray-800 rounded-full text-xs flex items-center justify-center hover:bg-white'
                        title='Download photo'
                      >
                        ⬇
                      </a>
                      <button
                        type='button'
                        onClick={() =>
                          setPhotos(p => p.filter((_, j) => j !== i))
                        }
                        className='w-8 h-8 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600'
                        title='Remove photo'
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isEdit && (
        <div className={sc}>
          <SectionToggle
            idx={6}
            title='Documents'
            icon='📄'
            active={section}
            toggle={setSection}
          />
          {section === 6 && (
            <div className='p-6 space-y-4'>
              <input
                ref={docInputRef}
                type='file'
                accept='.pdf,.doc,.docx,.htm,.html,.msg,.eml,image/*'
                multiple
                className='hidden'
                onChange={handleDocumentSelect}
              />
              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  onClick={() => docInputRef.current?.click()}
                  disabled={stagedDocuments.length >= 10}
                  className='px-5 py-2.5 rounded-xl text-sm font-bold border border-border bg-card hover:bg-accent disabled:opacity-50'
                >
                  📎 Attach Documents ({stagedDocuments.length}/10)
                </button>
                <span className='text-xs text-muted-foreground'>
                  PDF, Word, images, HTML, Outlook — uploaded once the asset is saved, downloadable afterward
                </span>
              </div>

              {stagedDocuments.length > 0 && (
                <div className='space-y-2'>
                  {stagedDocuments.map((doc, i) => (
                    <div key={i} className='flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30'>
                      <select
                        className={ic + ' w-48 flex-shrink-0'}
                        value={doc.documentType}
                        onChange={e =>
                          setStagedDocuments(p =>
                            p.map((d, j) => (j === i ? { ...d, documentType: e.target.value } : d))
                          )
                        }
                      >
                        {DOCUMENT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        className={ic + ' flex-1'}
                        value={doc.title}
                        onChange={e =>
                          setStagedDocuments(p =>
                            p.map((d, j) => (j === i ? { ...d, title: e.target.value } : d))
                          )
                        }
                        placeholder='Document title'
                      />
                      <button
                        type='button'
                        onClick={() => setStagedDocuments(p => p.filter((_, j) => j !== i))}
                        className='w-8 h-8 flex-shrink-0 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center justify-center hover:bg-red-100'
                        title='Remove'
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className='flex gap-3 pt-2'>
        <button
          type='submit'
          disabled={loading}
          className='px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-60'
          style={{ background: '#FFB800', color: '#1B2A8A' }}
        >
          {loading ? 'Saving…' : isEdit ? 'Update Asset' : 'Register Asset'}
        </button>
        <button
          type='button'
          onClick={() => router.back()}
          className='px-8 py-3 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent'
        >
          Cancel
        </button>
      </div>

      {!isEdit && (
        <p className='text-xs text-muted-foreground pb-4'>
          💡 After registering, this asset enters the approval workflow.
          Approvers will be notified by email and in-app notification.
        </p>
      )}
    </form>
  )
}
