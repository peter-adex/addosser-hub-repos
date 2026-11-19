'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  Flag,
  Loader2,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportModal, type ExportField } from '@/components/shared/ExportModal'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import { useTrips } from '@/lib/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import type { AnyStatus } from '@/components/shared/StatusBadge'

const fmtDT = (d?: string | null) =>
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

const EXPORT_FIELDS: ExportField[] = [
  {
    key: 'vehicle',
    label: 'Plate Number',
    selected: true,
    format: (_, r) => r.vehicle?.plateNumber ?? ''
  },
  {
    key: 'driver',
    label: 'Driver',
    selected: true,
    format: (_, r) => r.driver?.user?.name ?? ''
  },
  { key: 'startLocation', label: 'From', selected: true },
  { key: 'endLocation', label: 'To', selected: true },
  {
    key: 'startTime',
    label: 'Departure',
    selected: true,
    format: v => fmtDT(v)
  },
  { key: 'endTime', label: 'Arrival', selected: true, format: v => fmtDT(v) },
  {
    key: 'startOdometer',
    label: 'Start Odo(km)',
    selected: true,
    format: v => Number(v).toLocaleString()
  },
  {
    key: 'endOdometer',
    label: 'End Odo(km)',
    selected: true,
    format: v => (v ? Number(v).toLocaleString() : '')
  },
  {
    key: 'distanceKm',
    label: 'Distance(km)',
    selected: true,
    format: v => (v ? Number(v).toFixed(1) : '')
  },
  { key: 'purpose', label: 'Purpose', selected: false },
  { key: 'passengerCount', label: 'Passengers', selected: false },
  { key: 'status', label: 'Status', selected: true }
]

const STATUS_OPTS = [
  { value: '', label: 'All Status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]

function EndTripInline ({
  tripId,
  startOdo,
  onDone
}: {
  tripId: string
  startOdo: number
  onDone(): void
}) {
  const [odo, setOdo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit () {
    const val = parseFloat(odo)
    if (isNaN(val) || val < startOdo) {
      setErr(`Must be ≥ ${startOdo} km`)
      return
    }
    setBusy(true)
    const res = await fetch(`/api/fleet/trips/${tripId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endOdometer: val,
        endTime: new Date().toISOString()
      })
    })
    setBusy(false)
    if (res.ok) onDone()
    else {
      const j = await res.json()
      setErr(j.error ?? 'Failed')
    }
  }

  return (
    <div className='flex items-center gap-2 mt-1'>
      <input
        type='number'
        min={startOdo}
        placeholder={`≥${startOdo}`}
        className='w-28 rounded-lg border border-border bg-background px-2 py-1 text-[11.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand-navy/30'
        value={odo}
        onChange={e => {
          setOdo(e.target.value)
          setErr('')
        }}
      />
      <button
        onClick={submit}
        disabled={busy}
        className='inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors'
      >
        {busy ? (
          <Loader2 size={11} className='animate-spin' />
        ) : (
          <Flag size={11} />
        )}{' '}
        End
      </button>
      {err && <p className='text-[10px] text-red-500'>{err}</p>}
    </div>
  )
}

export default function TripsPage () {
  return (
    <PermissionGuard module='trips' action='canView'>
      <TripsContent />
    </PermissionGuard>
  )
}

function TripsContent () {
  const router = useRouter()
  const { user } = useAuth()
  const perms = usePagePermissions('trips')

  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showExp, setShowExp] = useState(false)
  const [endingId, setEndingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, loading, error, refetch } = useTrips({
    search: perms.canExport ? search : undefined,
    status: statusF,
    dateFrom,
    dateTo,
    page: String(page),
    limit: '20'
  })
  const trips = data?.items ?? []
  const pagInfo = data?.pagination

  async function handleDelete (id: string) {
    if (!confirm('Delete this trip? This cannot be undone.')) return
    setDeleting(id)
    await fetch(`/api/fleet/trips/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    setDeleting(null)
    refetch()
  }

  return (
    <div className='animate-fade-in'>
      {showExp && (
        <ExportModal
          open
          title='Export Trips'
          fields={EXPORT_FIELDS}
          data={trips}
          filename='trips'
          onClose={() => setShowExp(false)}
        />
      )}

      <PageHeader
        title='Trips'
        subtitle={`${pagInfo?.total ?? 0} trip record${
          (pagInfo?.total ?? 0) !== 1 ? 's' : ''
        }`}
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
                onClick={() => router.push('/fleet/trips/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors'
              >
                <Plus size={14} /> Log Trip
              </button>
            )}
          </div>
        }
      />

      <div className='flex flex-wrap gap-3 mb-5'>
        {perms.canExport && (
          <div className='relative flex-1 min-w-[180px] max-w-xs'>
            <Search
              size={13}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
            />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder='Location, purpose…'
              className='w-full pl-8 pr-3 py-2 text-[12.5px] rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-foreground placeholder:text-muted-foreground'
            />
          </div>
        )}
        <select
          value={statusF}
          onChange={e => {
            setStatusF(e.target.value)
            setPage(1)
          }}
          className='rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none'
        >
          {STATUS_OPTS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type='date'
          value={dateFrom}
          onChange={e => {
            setDateFrom(e.target.value)
            setPage(1)
          }}
          className='rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none'
        />
        <input
          type='date'
          value={dateTo}
          onChange={e => {
            setDateTo(e.target.value)
            setPage(1)
          }}
          className='rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none'
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
            className='rounded-lg border border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted transition-colors'
          >
            Clear dates
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
              className='h-14 border-b border-border/50 bg-muted/20 animate-pulse'
            />
          ))}
        </div>
      )}

      {!loading && trips.length === 0 && (
        <EmptyState
          title='No trips found'
          description={
            statusF || dateFrom || dateTo
              ? 'Adjust your filters.'
              : 'Log your first trip.'
          }
          action={
            perms.canCreate ? (
              <button
                onClick={() => router.push('/fleet/trips/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-brand-gold'
              >
                <Plus size={14} /> Log Trip
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && trips.length > 0 && (
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-[12px]'>
              <thead>
                <tr className='border-b border-border bg-muted/30'>
                  {[
                    'Vehicle',
                    'Driver',
                    'Route',
                    'Departure',
                    'Distance',
                    'Status',
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
                {trips.map(t => {
                  const isOngoing = t.status === 'ongoing'
                  const dist =
                    t.distanceKm != null
                      ? `${Number(t.distanceKm).toFixed(1)} km`
                      : t.endOdometer && t.startOdometer
                      ? `${(t.endOdometer - t.startOdometer).toFixed(1)} km`
                      : '—'

                  return (
                    <tr
                      key={t.id}
                      className='border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors'
                    >
                      <td className='px-4 py-3'>
                        <p className='font-mono font-bold text-foreground'>
                          {t.vehicle?.plateNumber}
                        </p>
                        <p className='text-[10.5px] text-muted-foreground'>
                          {t.vehicle?.make} {t.vehicle?.model}
                        </p>
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {t.driver?.user?.name}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-1 text-foreground'>
                          <MapPin
                            size={10}
                            className='text-muted-foreground flex-shrink-0'
                          />
                          <span className='truncate max-w-[160px]'>
                            {t.startLocation}
                          </span>
                        </div>
                        <p className='text-[10.5px] text-muted-foreground truncate max-w-[160px] pl-3.5'>
                          → {t.endLocation}
                        </p>
                      </td>
                      <td className='px-4 py-3 text-muted-foreground whitespace-nowrap text-[11px]'>
                        {fmtDT(t.startTime)}
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {dist}
                      </td>
                      <td className='px-4 py-3'>
                        <StatusBadge status={t.status as AnyStatus} />
                      </td>
                      <td className='px-4 py-3 min-w-[160px]'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <button
                            onClick={() => router.push(`/fleet/trips/${t.id}`)}
                            className='text-[11px] text-brand-navy dark:text-brand-gold hover:underline'
                          >
                            View
                          </button>

                          {perms.canEdit && isOngoing && (
                            <>
                              <span className='text-border'>|</span>
                              <button
                                onClick={() => router.push(`/fleet/trips/${t.id}`)}
                                className='text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5'
                              >
                                <Pencil size={10} /> Edit
                              </button>
                            </>
                          )}

                          {perms.canDelete && (
                            <>
                              <span className='text-border'>|</span>
                              <button
                                onClick={() => handleDelete(t.id)}
                                disabled={deleting === t.id}
                                className='text-[11px] text-muted-foreground hover:text-red-500 disabled:opacity-50 flex items-center gap-0.5'
                              >
                                {deleting === t.id ? (
                                  <Loader2 size={10} className='animate-spin' />
                                ) : (
                                  <Trash2 size={10} />
                                )}
                                Delete
                              </button>
                            </>
                          )}
                        </div>

                        {isOngoing &&
                          (perms.canEdit ||
                            t.driver?.user?.name === user?.name) &&
                          endingId !== t.id && (
                            <button
                              onClick={() => setEndingId(t.id)}
                              className='mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline'
                            >
                              <Flag size={10} /> End Trip
                            </button>
                          )}
                        {endingId === t.id && (
                          <EndTripInline
                            tripId={t.id}
                            startOdo={t.startOdometer}
                            onDone={() => {
                              setEndingId(null)
                              refetch()
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className='px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between'>
            <p className='text-[11px] text-muted-foreground'>
              {pagInfo
                ? `${(page - 1) * 20 + 1}–${Math.min(
                    page * 20,
                    pagInfo.total
                  )} of ${pagInfo.total}`
                : `${trips.length} trips`}
            </p>
            {pagInfo && pagInfo.totalPages > 1 && (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-[12px] hover:bg-muted disabled:opacity-40 transition-colors'
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <span className='text-[12px] text-muted-foreground'>
                  {page}/{pagInfo.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage(p => Math.min(pagInfo.totalPages, p + 1))
                  }
                  disabled={page === pagInfo.totalPages}
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
