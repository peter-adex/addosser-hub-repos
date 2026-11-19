'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Download,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { getAssignedUser } from '@/lib/fleet-document-notification-rules'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import { ExportModal, type ExportField } from '@/components/shared/ExportModal'

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(d))

const CATEGORY_LABELS: Record<string, string> = {
  saloon: 'Saloon',
  suv: 'SUV',
  jeep: 'Jeep',
  truck: 'Truck',
  motorcycle: 'Motorcycle'
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'plateNumber', label: 'Plate No.', selected: true },
  { key: 'make', label: 'Make', selected: true },
  { key: 'model', label: 'Model', selected: true },
  { key: 'year', label: 'Year', selected: true },
  {
    key: 'category',
    label: 'Category',
    selected: true,
    format: v => CATEGORY_LABELS[v] ?? v
  },
  {
    key: 'vehicleUse',
    label: 'Use',
    selected: true,
    format: v => String(v).replace(/_/g, ' ')
  },
  { key: 'status', label: 'Status', selected: true },
  { key: 'colour', label: 'Colour', selected: false },
  { key: 'chassisNumber', label: 'Chassis No.', selected: false },
  { key: 'mileage', label: 'Mileage (km)', selected: true },
  {
    key: 'allocationStatus',
    label: 'Allocation',
    selected: true,
    format: v => String(v).replace(/_/g, ' ')
  },
  { key: 'createdAt', label: 'Added', selected: true, format: v => fmtDate(v) }
]

interface Vehicle {
  id: string
  plateNumber: string
  make: string
  model: string
  year: number
  category: string
  vehicleUse: string
  status: string
  colour?: string
  chassisNumber: string
  mileage: number
  allocationStatus: string
  entityId?: string
  createdAt: string
  entity?: { name: string; code: string }
  assignedDriver?: { user: { name: string; email?: string } }
  statusStaffName?: string
  statusStaffEmail?: string
  images?: { url: string; isPrimary: boolean }[]
}

export default function VehiclesPage () {
  return (
    <PermissionGuard module='vehicles' action='canView'>
      <VehiclesContent />
    </PermissionGuard>
  )
}

function VehiclesContent () {
  const router = useRouter()

  const perms = usePagePermissions('vehicles')

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pagesTotal, setPagesTotal] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [allocF, setAllocF] = useState('')
  const [showExp, setShowExp] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const LIMIT = 20

  const [isRefreshing, setIsRefreshing] = useState(false)
  const inFlightRef = useRef(false)
  const hasLoadedRef = useRef(false)

  async function load (pg: number, opts: { background?: boolean } = {}) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (opts.background) setIsRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (search) p.set('search', search)
      if (statusF) p.set('status', statusF)
      if (allocF) p.set('allocationStatus', allocF)
      const res = await fetch(`/api/fleet/vehicles?${p}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load vehicles')
        return
      }
      setVehicles(json.data?.items ?? [])
      setTotal(json.data?.pagination?.total ?? 0)
      setPagesTotal(json.data?.pagination?.totalPages ?? 1)
      hasLoadedRef.current = true
    } catch {
      if (!opts.background) setError('Network error')
    } finally {
      inFlightRef.current = false
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    setPage(1)
    load(1)
  }, [search, statusF, allocF])
  useEffect(() => {
    load(page)
  }, [page])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return
      if (!hasLoadedRef.current) return
      load(page, { background: true })
    }, 20_000)
    return () => clearInterval(id)
  }, [page, search, statusF, allocF])

  async function handleDelete (id: string, plateNumber: string) {
    if (!confirm(`Delete vehicle ${plateNumber}? This cannot be undone.`))
      return
    setDeleting(id)
    const res = await fetch(`/api/fleet/vehicles/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    const json = await res.json()
    setDeleting(null)
    if (!res.ok) alert(json.error ?? 'Delete failed')
    else load(page)
  }

  const hasFilter = search || statusF || allocF

  return (
    <div className='animate-fade-in'>
      {showExp && (
        <ExportModal
          open
          title='Export Vehicles'
          fields={EXPORT_FIELDS}
          data={vehicles}
          filename='vehicles'
          onClose={() => setShowExp(false)}
        />
      )}

      <PageHeader
        title='Vehicles'
        subtitle={
          <span className='inline-flex items-center gap-2'>
            {total} vehicle{total !== 1 ? 's' : ''} in fleet
            {isRefreshing && (
              <span className='inline-flex items-center gap-1 text-[11px] text-muted-foreground'>
                <Loader2 size={10} className='animate-spin' /> Updating…
              </span>
            )}
          </span>
        }
        action={
          <div className='flex items-center gap-2'>
            {perms.canExport && (
              <button
                onClick={() => setShowExp(true)}
                className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors'
              >
                <Download size={13} /> Export
              </button>
            )}
            {perms.canCreate && (
              <button
                onClick={() => router.push('/fleet/vehicles/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors'
              >
                <Plus size={14} /> Add Vehicle
              </button>
            )}
          </div>
        }
      />

      <div className='flex flex-wrap gap-3 mb-5'>
        <div className='relative flex-1 min-w-[200px] max-w-sm'>
          <Search
            size={13}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Plate, make, model…'
            className='w-full pl-8 pr-3 py-2 text-[12.5px] rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-foreground placeholder:text-muted-foreground'
          />
        </div>
        <select
          value={statusF}
          onChange={e => setStatusF(e.target.value)}
          className='rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none'
        >
          <option value=''>All Statuses</option>
          <option value='active'>Active</option>
          <option value='idle'>Idle</option>
          <option value='maintenance'>In Maintenance</option>
          <option value='retired'>Retired</option>
        </select>
        <select
          value={allocF}
          onChange={e => setAllocF(e.target.value)}
          className='rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none'
        >
          <option value=''>All Allocation</option>
          <option value='available'>Available</option>
          <option value='allocated_driver'>Allocated — Driver</option>
          <option value='allocated_status'>Allocated — Status</option>
        </select>
        {hasFilter && (
          <button
            onClick={() => {
              setSearch('')
              setStatusF('')
              setAllocF('')
            }}
            className='inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted transition-colors'
          >
            <Filter size={12} /> Clear
          </button>
        )}
      </div>

      {error && (
        <div className='mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700'>
          {error}
        </div>
      )}

      {loading && (
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className='h-16 border-b border-border/50 bg-muted/20 animate-pulse'
            />
          ))}
        </div>
      )}

      {!loading && vehicles.length === 0 && (
        <EmptyState
          title='No vehicles found'
          description={
            hasFilter ? 'Adjust your filters.' : 'Add your first fleet vehicle.'
          }
          action={
            perms.canCreate ? (
              <button
                onClick={() => router.push('/fleet/vehicles/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-brand-gold'
              >
                <Plus size={14} /> Add Vehicle
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && vehicles.length > 0 && (
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-[12px]'>
              <thead>
                <tr className='border-b border-border bg-muted/30'>
                  {[
                    'Vehicle',
                    'Category',
                    'Status',
                    'Allocation',
                    'Driver / Staff',
                    'Mileage',
                    'Actions'
                  ].map(h => (
                    <th
                      key={h}
                      className='text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr
                    key={v.id}
                    className='border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors'
                  >
                    <td className='px-4 py-3'>
                      <p className='font-bold text-foreground'>
                        {v.plateNumber}
                      </p>
                      <p className='text-muted-foreground text-[11px]'>
                        {v.year} {v.make} {v.model}
                      </p>
                      {v.colour && (
                        <p className='text-[10px] text-muted-foreground/70'>
                          {v.colour}
                        </p>
                      )}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground capitalize'>
                      {CATEGORY_LABELS[v.category] ?? v.category}
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={v.status} />
                    </td>
                    <td className='px-4 py-3'>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${
                          v.allocationStatus === 'available'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {v.allocationStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-muted-foreground text-[11.5px]'>
                      {(() => {
                        const a = getAssignedUser(v)
                        return a ? (
                          <div>
                            <p className='text-foreground font-medium'>{a.name}</p>
                            {a.email && (
                              <p className='text-[10px] text-muted-foreground'>
                                {a.email}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className='italic text-muted-foreground/70'>
                            Not Assigned
                          </span>
                        )
                      })()}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {v.mileage.toLocaleString()} km
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2 whitespace-nowrap'>
                        <button
                          onClick={() => router.push(`/fleet/vehicles/${v.id}`)}
                          className='inline-flex items-center gap-1 text-[11px] text-brand-navy dark:text-brand-gold hover:underline'
                        >
                          <Eye size={10} /> View
                        </button>

                        {perms.canEdit && (
                          <>
                            <span className='text-border'>|</span>
                            <button
                              onClick={() =>
                                router.push(`/fleet/vehicles/${v.id}/edit`)
                              }
                              className='inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground'
                            >
                              <Pencil size={10} /> Edit
                            </button>
                          </>
                        )}

                        {perms.canDelete && (
                          <>
                            <span className='text-border'>|</span>
                            <button
                              onClick={() => handleDelete(v.id, v.plateNumber)}
                              disabled={deleting === v.id}
                              className='inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 disabled:opacity-50'
                            >
                              {deleting === v.id ? (
                                <Loader2 size={10} className='animate-spin' />
                              ) : (
                                <Trash2 size={10} />
                              )}{' '}
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between'>
            <p className='text-[11px] text-muted-foreground'>
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{' '}
              {total}
            </p>
            {pagesTotal > 1 && (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-[12px] hover:bg-muted disabled:opacity-40 transition-colors'
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <span className='text-[12px] text-muted-foreground'>
                  {page}/{pagesTotal}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagesTotal, p + 1))}
                  disabled={page === pagesTotal}
                  className='flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-[12px] hover:bg-muted disabled:opacity-40 transition-colors'
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
