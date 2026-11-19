'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Truck,
  Pencil,
  Trash2,
  Loader2,
  TrendingDown,
  MapPin,
  Camera,
  FileText,
  Download,
  X,
  Paperclip,
  ZoomIn,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { AnyStatus } from '@/components/shared/StatusBadge'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'

const fmtNgn = (n: number) =>
  '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })
const fmtDate = (d?: string) =>
  !d
    ? '—'
    : new Intl.DateTimeFormat('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(new Date(d))
const fmtDT = (d?: string) =>
  !d
    ? '—'
    : new Intl.DateTimeFormat('en-NG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(d))

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

function computeDep (v: any) {
  if (!v.acquisitionValueNgn || !v.purchaseDate) return null
  const life = v.usefulLifeYears ?? 5
  const lifeM = life * 12
  const depM = v.acquisitionValueNgn / lifeM
  const depY = v.acquisitionValueNgn / life
  const start = new Date(v.purchaseDate)
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  if (months < 0) months = 0
  const elap = Math.min(months, lifeM)
  const acc = depM * elap
  const nbv = Math.max(0, v.acquisitionValueNgn - acc)
  const pct = Math.min(100, (elap / lifeM) * 100)
  const rDt = new Date(start)
  rDt.setFullYear(rDt.getFullYear() + life)
  return {
    depM,
    depY,
    acc,
    nbv,
    pct,
    rDt,
    yrs: Math.floor(months / 12),
    mos: months % 12
  }
}

function InfoRow ({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex justify-between items-start py-2.5 border-b border-border/50 last:border-0'>
      <span className='text-[12px] text-muted-foreground w-44 flex-shrink-0'>
        {label}
      </span>
      <span className='text-[12.5px] font-medium text-foreground text-right'>
        {value ?? '—'}
      </span>
    </div>
  )
}

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

export default function VehicleDetailPage () {
  return (
    <PermissionGuard module='vehicles' action='canView'>
      <VehicleDetailContent />
    </PermissionGuard>
  )
}

function VehicleDetailContent () {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const perms = usePagePermissions('vehicles')

  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [delDocId, setDelDocId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  async function loadVehicle () {
    const res = await fetch(`/api/fleet/vehicles/${id}`, { credentials: 'include' })
    const d = await res.json()
    setVehicle(d.data)
    setLoading(false)
  }
  useEffect(() => {
    loadVehicle()
  }, [id])

  async function handleDelete () {
    if (!confirm(`Delete vehicle ${vehicle?.plateNumber}? Cannot be undone.`))
      return
    setDeleting(true)
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) router.push('/fleet/vehicles')
    else {
      const j = await res.json()
      alert(j.error ?? 'Delete failed')
      setDeleting(false)
    }
  }

  async function handleDeleteDoc (docId: string) {
    if (!confirm('Delete this document? It cannot be recovered.')) return
    setDelDocId(docId)
    await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteDocumentIds: [docId] })
    })
    setDelDocId(null)
    loadVehicle()
  }

  if (loading)
    return (
      <div className='max-w-2xl space-y-4'>
        {[120, 300, 200].map((h, i) => (
          <div
            key={i}
            className='bg-card border border-border rounded-xl animate-pulse'
            style={{ height: h }}
          />
        ))}
      </div>
    )

  if (!vehicle)
    return (
      <div className='text-center py-16'>
        <Truck size={40} className='mx-auto text-muted-foreground mb-3' />
        <p className='text-[14px] font-semibold text-foreground mb-1'>
          Vehicle not found
        </p>
        <button
          onClick={() => router.push('/fleet/vehicles')}
          className='text-[12.5px] text-brand-navy dark:text-brand-gold hover:underline'
        >
          ← Back
        </button>
      </div>
    )

  const dep = computeDep(vehicle)
  const images = vehicle.images ?? []
  const primary = images.find((im: any) => im.isPrimary) ?? images[0]
  const docs = vehicle.documents ?? []
  const lightboxImages = images.map((im: any) => ({
    url: im.url,
    isPrimary: im.isPrimary
  }))

  return (
    <div className='animate-fade-in max-w-2xl'>
      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <div className='flex items-center justify-between mb-5'>
        <button
          onClick={() => router.push('/fleet/vehicles')}
          className='inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors'
        >
          <ChevronLeft size={14} /> Back to Vehicles
        </button>
        <div className='flex items-center gap-2'>
          {perms.canEdit && (
            <button
              onClick={() => router.push(`/fleet/vehicles/${id}/edit`)}
              className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors'
            >
              <Pencil size={13} /> Edit
            </button>
          )}
          {perms.canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className='inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3.5 py-2 text-[12.5px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors'
            >
              {deleting ? (
                <Loader2 size={13} className='animate-spin' />
              ) : (
                <Trash2 size={13} />
              )}{' '}
              Delete
            </button>
          )}
        </div>
      </div>

      <div className='bg-card border border-border rounded-xl p-5 mb-4'>
        <div className='flex items-start gap-4 mb-4'>
          <div
            className={`h-20 w-24 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-muted flex items-center justify-center ${
              primary?.url ? 'cursor-zoom-in group relative' : ''
            }`}
            onClick={() => primary?.url && setLightboxIndex(0)}
          >
            {primary?.url ? (
              <>
                <img
                  src={primary.url}
                  alt={vehicle.plateNumber}
                  className='w-full h-full object-cover'
                  onError={e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className='absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center'>
                  <ZoomIn size={18} className='text-white drop-shadow' />
                </div>
              </>
            ) : (
              <Truck size={28} className='text-muted-foreground' />
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 flex-wrap mb-1'>
              <h1 className='text-[20px] font-bold font-mono text-foreground'>
                {vehicle.plateNumber}
              </h1>
              <StatusBadge status={vehicle.status as AnyStatus} />
            </div>
            <p className='text-[13.5px] text-muted-foreground'>
              {vehicle.make} {vehicle.model} · {vehicle.year}
            </p>
            <div className='flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground'>
              <span className='rounded-full bg-muted px-2 py-0.5 capitalize'>
                {vehicle.category}
              </span>
              <span className='rounded-full bg-muted px-2 py-0.5 capitalize'>
                {vehicle.vehicleUse}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${
                  vehicle.allocationStatus === 'available'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {vehicle.allocationStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>

        <InfoRow
          label='Chassis / VIN'
          value={
            <span className='font-mono text-[12px]'>
              {vehicle.chassisNumber}
            </span>
          }
        />
        {vehicle.engineNumber && (
          <InfoRow
            label='Engine Number'
            value={
              <span className='font-mono text-[12px]'>
                {vehicle.engineNumber}
              </span>
            }
          />
        )}
        <InfoRow label='Colour' value={vehicle.colour ?? '—'} />
        <InfoRow
          label='Current Mileage'
          value={`${Math.round(vehicle.mileage).toLocaleString()} km`}
        />
        <InfoRow label='Entity' value={vehicle.entity?.name ?? '—'} />
        {vehicle.assignedDriver && (
          <InfoRow
            label='Assigned Driver'
            value={vehicle.assignedDriver.user.name}
          />
        )}
      </div>

      {vehicle.vehicleUse === 'status' && vehicle.statusStaffName && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <div className='flex items-center gap-2 mb-3'>
            <span className='rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-semibold px-2 py-0.5'>
              Status Vehicle
            </span>
            <p className='text-[13px] font-semibold text-foreground'>
              Assigned Staff
            </p>
          </div>
          <InfoRow label='Name' value={vehicle.statusStaffName} />
          {vehicle.statusStaffDept && (
            <InfoRow label='Department' value={vehicle.statusStaffDept} />
          )}
          {vehicle.statusStaffRole && (
            <InfoRow label='Job Title' value={vehicle.statusStaffRole} />
          )}
          {vehicle.statusStaffId && (
            <InfoRow label='Staff ID' value={vehicle.statusStaffId} />
          )}
          {vehicle.statusStaffPhone && (
            <InfoRow label='Phone' value={vehicle.statusStaffPhone} />
          )}
          {vehicle.statusStaffEmail && (
            <InfoRow label='Email' value={vehicle.statusStaffEmail} />
          )}
        </div>
      )}

      {dep && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <div className='flex items-center gap-2 mb-3'>
            <TrendingDown
              size={14}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Financial &amp; Depreciation
            </p>
          </div>
          <div className='rounded-xl bg-[#0f1e3c] text-white overflow-hidden'>
            <div className='flex items-center gap-2 px-4 py-3 border-b border-white/[0.08]'>
              <TrendingDown size={13} className='text-brand-gold' />
              <p className='text-[12px] font-semibold'>Depreciation Preview</p>
              <span className='text-[10.5px] text-white/50'>
                Straight-line · {vehicle.usefulLifeYears ?? 5}-year useful life
              </span>
            </div>
            <div className='divide-y divide-white/[0.06]'>
              {[
                {
                  label: 'Age of Vehicle',
                  value: `${dep.yrs} yrs ${dep.mos} months`
                },
                {
                  label: 'Acquisition Value (AQUI)',
                  value: fmtNgn(vehicle.acquisitionValueNgn)
                },
                { label: 'Depreciation / Month', value: fmtNgn(dep.depM) },
                { label: 'Depreciation / Year', value: fmtNgn(dep.depY) },
                {
                  label: 'Accumulated Depreciation',
                  value: fmtNgn(dep.acc),
                  hl: 'amber'
                },
                {
                  label: 'Net Book Value (NBV)',
                  value: fmtNgn(dep.nbv),
                  hl: 'gold'
                }
              ].map(row => (
                <div
                  key={row.label}
                  className='flex items-center justify-between px-5 py-3'
                >
                  <span className='text-[12.5px] text-white/70'>
                    {row.label}
                  </span>
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
                <span>{dep.pct.toFixed(0)}% depreciated</span>
              </div>
              <div className='h-2 rounded-full bg-white/10 overflow-hidden mb-2'>
                <div
                  className='h-full bg-brand-gold rounded-full'
                  style={{ width: `${dep.pct}%` }}
                />
              </div>
              <div className='flex justify-between text-[10.5px] text-white/40'>
                <span>Purchase: {fmtDate(vehicle.purchaseDate)}</span>
                <span>Replacement due: {fmtDate(dep.rDt.toISOString())}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <div className='flex items-center gap-2 mb-3'>
            <Camera
              size={14}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Photos ({images.length})
            </p>
            <span className='text-[11px] text-muted-foreground'>
              — click to magnify
            </span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {images.map((img: any, i: number) => (
              <div
                key={img.id}
                className={`relative rounded-xl overflow-hidden border-2 w-20 h-20 flex-shrink-0 cursor-zoom-in group ${
                  img.isPrimary
                    ? 'border-brand-navy/60 dark:border-brand-gold/60'
                    : 'border-border'
                }`}
                onClick={() => setLightboxIndex(i)}
              >
                <img
                  src={img.url}
                  alt=''
                  className='w-full h-full object-cover'
                  onError={e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className='absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center'>
                  <ZoomIn size={18} className='text-white drop-shadow' />
                </div>
                {img.isPrimary && (
                  <span className='absolute bottom-0 left-0 right-0 bg-brand-navy/80 text-brand-gold text-[8px] text-center font-bold py-0.5'>
                    PRIMARY
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='bg-card border border-border rounded-xl p-5 mb-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <FileText
              size={14}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Documents
              {docs.length > 0 && (
                <span className='text-[11px] text-muted-foreground font-normal ml-1'>
                  ({docs.length})
                </span>
              )}
            </p>
          </div>
          {perms.canEdit && (
            <button
              onClick={() => router.push(`/fleet/vehicles/${id}/edit`)}
              className='inline-flex items-center gap-1 text-[11.5px] text-brand-navy dark:text-brand-gold hover:underline'
            >
              <Paperclip size={11} /> Add Document
            </button>
          )}
        </div>

        {docs.length === 0 ? (
          <div className='text-center py-6 text-[12.5px] text-muted-foreground'>
            <FileText size={28} className='mx-auto mb-2 opacity-30' />
            No documents attached.{' '}
            {perms.canEdit && 'Edit the vehicle to add documents.'}
          </div>
        ) : (
          <div className='space-y-2'>
            {docs.map((doc: any) => (
              <div
                key={doc.id}
                className='flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3'
              >
                <FileText
                  size={15}
                  className='text-brand-navy dark:text-brand-gold flex-shrink-0'
                />
                <div className='flex-1 min-w-0'>
                  <p className='text-[12.5px] font-semibold text-foreground truncate'>
                    {doc.name}
                  </p>
                  <div className='flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5'>
                    <span className='rounded-full bg-muted px-1.5 py-0.5 capitalize'>
                      {doc.type.replace(/_/g, ' ')}
                    </span>
                    {doc.expiryDate && (
                      <span>Expires: {fmtDate(doc.expiryDate)}</span>
                    )}
                    {doc.fileSize && (
                      <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                    )}
                    {doc.mimeType && (
                      <span className='uppercase'>
                        {extFromMime(doc.mimeType)}
                      </span>
                    )}
                  </div>
                </div>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    download={safeFilename(doc.name, doc.mimeType ?? '')}
                    className='inline-flex items-center gap-1 text-[11px] text-brand-navy dark:text-brand-gold hover:underline flex-shrink-0'
                  >
                    <Download size={11} /> Download
                  </a>
                ) : (
                  <span className='text-[11px] text-muted-foreground flex-shrink-0 italic'>
                    No file attached
                  </span>
                )}
                {perms.canDelete && (
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    disabled={delDocId === doc.id}
                    className='h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 disabled:opacity-50 flex-shrink-0 transition-colors'
                  >
                    {delDocId === doc.id ? (
                      <Loader2 size={12} className='animate-spin' />
                    ) : (
                      <X size={12} />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {vehicle.trips?.length > 0 && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <div className='flex items-center gap-2 mb-3'>
            <MapPin
              size={14}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Recent Trips
            </p>
          </div>
          <div className='space-y-2'>
            {vehicle.trips.slice(0, 5).map((t: any) => (
              <div
                key={t.id}
                className='flex items-center justify-between py-2 border-b border-border/50 last:border-0'
              >
                <div>
                  <p className='text-[12.5px] font-medium text-foreground'>
                    {t.startLocation} → {t.endLocation}
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    {fmtDT(t.startTime)} ·{' '}
                    {t.distanceKm ? `${t.distanceKm} km` : '—'}
                  </p>
                </div>
                <StatusBadge status={t.status as AnyStatus} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
