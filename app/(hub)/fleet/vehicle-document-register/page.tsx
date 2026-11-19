'use client'
import { Fragment, useMemo, useRef, useState } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionGuard, usePagePermissions } from '@/components/shared/PermissionGuard'
import { VehicleDocumentDialog } from '@/components/fleet/VehicleDocumentDialog'
import {
  useVehicles,
  useVehicleDocumentTypes,
  useEntities,
  type ApiVehicle,
  type ApiVehicleDocument
} from '@/lib/hooks/useApi'
import { formatCountdown, expiryStatus, daysUntil } from '@/lib/utils'
import { getAssignedUser } from '@/lib/fleet-document-notification-rules'

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition'

function fmtDate (d?: string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(d))
}

function groupDocsByType (documents: ApiVehicleDocument[] | undefined) {
  const byType = new Map<string, ApiVehicleDocument[]>()
  for (const doc of documents ?? []) {
    const key = doc.documentTypeId ?? doc.type
    if (!key) continue
    const arr = byType.get(key) ?? []
    arr.push(doc)
    byType.set(key, arr)
  }
  for (const arr of byType.values()) {
    arr.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
  }
  return byType
}

const DOC_STATUS_BADGE: Record<
  'none' | 'expired' | 'due-today' | 'expiring-soon' | 'valid',
  { label: string; className: string }
> = {
  none: { label: '—', className: 'text-muted-foreground' },
  expired: {
    label: 'Expired',
    className:
      'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900'
  },
  'due-today': {
    label: 'Expiring Soon',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
  },
  'expiring-soon': {
    label: 'Expiring Soon',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
  },
  valid: {
    label: 'Valid',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
  }
}

const EXPIRING_SOON_DAYS = 30

function docStatusBadgeKey (
  status: 'none' | 'expired' | 'due-today' | 'upcoming',
  daysRemaining: number | null
): keyof typeof DOC_STATUS_BADGE {
  if (status === 'none') return 'none'
  if (status === 'expired') return 'expired'
  if (status === 'due-today') return 'due-today'
  if (daysRemaining !== null && daysRemaining <= EXPIRING_SOON_DAYS) return 'expiring-soon'
  return 'valid'
}

function VehicleDocumentRegisterContent () {
  const perms = usePagePermissions('vehicle-document-register')
  const [search, setSearch] = useState('')
  const [entityId, setEntityId] = useState('')
  const [page, setPage] = useState(1)
  const [openVehicle, setOpenVehicle] = useState<{ id: string; plateNumber: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: entRes } = useEntities()
  const { data: typeRes, loading: typesLoading } = useVehicleDocumentTypes()
  const {
    data: vehRes,
    loading: vehiclesLoading,
    isRefreshing,
    refetch: refetchVehicles
  } = useVehicles({
    includeDocuments: true,
    page: String(page),
    limit: '100',
    entityId: entityId || undefined,
    pollMs: 20_000
  })

  const docTypes = (typeRes?.items ?? []).filter(t => t.isActive)
  const vehicles = vehRes?.items ?? []
  const pagination = (vehRes as any)?.pagination as
    | { page: number; limit: number; total: number; totalPages: number }
    | undefined

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter(
      (v: ApiVehicle) =>
        v.plateNumber.toLowerCase().includes(q) ||
        `${v.make} ${v.model}`.toLowerCase().includes(q) ||
        (v.entity?.name ?? '').toLowerCase().includes(q) ||
        (getAssignedUser(v)?.name ?? '').toLowerCase().includes(q)
    )
  }, [vehicles, search])

  function scroll (dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  const loading = typesLoading || vehiclesLoading

  const FIXED_COL_WIDTHS = [130, 160, 150, 160, 190]
  const FIXED_COL_OFFSETS = [0, 130, 290, 450, 610]

  return (
    <div className='animate-fade-in'>
      <PageHeader
        title='Vehicle Document Register'
        subtitle='Cross-vehicle view of every document type and its expiry / countdown — columns are generated from Fleet → Vehicle Document Types'
      />

      <div className='flex flex-wrap items-center gap-3 mb-4'>
        <div className='relative w-64'>
          <Search
            size={14}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
          />
          <input
            className={`${INP} pl-8`}
            placeholder='Search plate, vehicle, entity, driver…'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`${INP} w-56`}
          value={entityId}
          onChange={e => {
            setEntityId(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All Entities</option>
          {(entRes?.items ?? []).map(e => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <div className='flex-1' />
        {isRefreshing && (
          <span className='inline-flex items-center gap-1.5 text-[11px] text-muted-foreground'>
            <Loader2 size={11} className='animate-spin' /> Updating…
          </span>
        )}
        <div className='flex items-center gap-1.5'>
          <button
            onClick={() => scroll('left')}
            className='h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted transition-colors'
            title='Scroll left'
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => scroll('right')}
            className='h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted transition-colors'
            title='Scroll right'
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        {loading ? (
          <div className='flex items-center justify-center py-16'>
            <Loader2 size={22} className='animate-spin text-muted-foreground' />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={22} />}
            title='No vehicles found'
            description={
              search || entityId
                ? 'Try a different search term or entity filter.'
                : 'Add vehicles under Fleet → Vehicles to see them here.'
            }
          />
        ) : docTypes.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet size={22} />}
            title='No Vehicle Document Types configured yet'
            description='Create at least one Document Type under Fleet → Vehicle Document Types to start tracking expiries here.'
          />
        ) : (
          <div ref={scrollRef} className='overflow-x-auto'>
            <table className='table-fixed w-full border-collapse text-[12.5px]'>
              <colgroup>
                {FIXED_COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
                {docTypes.map(t => (
                  <Fragment key={t.id}>
                    <col style={{ width: 110 }} />
                    <col style={{ width: 140 }} />
                  </Fragment>
                ))}
              </colgroup>
              <thead className='sticky top-0 z-20'>
                <tr>
                  <th
                    rowSpan={2}
                    className='sticky left-0 z-30 bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-b border-border overflow-hidden text-ellipsis whitespace-nowrap'
                  >
                    Plate Number
                  </th>
                  <th
                    rowSpan={2}
                    className='sticky z-30 bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-b border-border overflow-hidden text-ellipsis whitespace-nowrap'
                    style={{ left: FIXED_COL_OFFSETS[1] }}
                  >
                    Vehicle Name
                  </th>
                  <th
                    rowSpan={2}
                    className='sticky z-30 bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-b border-border overflow-hidden text-ellipsis whitespace-nowrap'
                    style={{ left: FIXED_COL_OFFSETS[2] }}
                  >
                    Entity
                  </th>
                  <th
                    rowSpan={2}
                    className='sticky z-30 bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-b border-border overflow-hidden text-ellipsis whitespace-nowrap'
                    style={{ left: FIXED_COL_OFFSETS[3] }}
                  >
                    Driver / Staff
                  </th>
                  <th
                    rowSpan={2}
                    className='sticky z-30 bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r-2 border-b border-border overflow-hidden text-ellipsis whitespace-nowrap'
                    style={{ left: FIXED_COL_OFFSETS[4] }}
                  >
                    User Email
                  </th>
                  {docTypes.map(t => (
                    <th
                      key={t.id}
                      colSpan={2}
                      className='bg-muted px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-b border-border whitespace-nowrap overflow-hidden text-ellipsis'
                      title={t.name}
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  {docTypes.map(t => (
                    <Fragment key={t.id}>
                      <th className='bg-muted/95 px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-b border-border'>
                        Expiry Date
                      </th>
                      <th className='bg-muted/95 px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-b border-border'>
                        Count Down
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v: ApiVehicle) => {
                  const byType = groupDocsByType(v.documents)
                  const assignee = getAssignedUser(v)
                  return (
                    <tr key={v.id} className='border-t border-border hover:bg-accent/20 transition-colors'>
                      <td
                        className={`sticky left-0 z-10 bg-card px-4 py-2.5 font-mono font-semibold text-foreground border-r border-border overflow-hidden text-ellipsis whitespace-nowrap ${
                          perms.canView ? 'cursor-pointer hover:text-brand-navy dark:hover:text-brand-gold hover:underline decoration-dotted' : ''
                        }`}
                        title={perms.canView ? 'Double-click to manage vehicle documents' : undefined}
                        onDoubleClick={() => {
                          if (perms.canView) setOpenVehicle({ id: v.id, plateNumber: v.plateNumber })
                        }}
                      >
                        {v.plateNumber}
                      </td>
                      <td
                        className='sticky z-10 bg-card px-4 py-2.5 text-foreground border-r border-border overflow-hidden text-ellipsis whitespace-nowrap'
                        style={{ left: FIXED_COL_OFFSETS[1] }}
                      >
                        {v.make} {v.model}
                      </td>
                      <td
                        className='sticky z-10 bg-card px-4 py-2.5 text-muted-foreground border-r border-border overflow-hidden text-ellipsis whitespace-nowrap'
                        style={{ left: FIXED_COL_OFFSETS[2] }}
                        title={v.entity?.name}
                      >
                        {v.entity?.name ?? '—'}
                      </td>
                      <td
                        className='sticky z-10 bg-card px-4 py-2.5 text-muted-foreground border-r border-border overflow-hidden text-ellipsis whitespace-nowrap'
                        style={{ left: FIXED_COL_OFFSETS[3] }}
                        title={assignee?.name ?? undefined}
                      >
                        {assignee ? (
                          assignee.name
                        ) : (
                          <span className='italic text-muted-foreground/70'>Not Assigned</span>
                        )}
                      </td>
                      <td
                        className='sticky z-10 bg-card px-4 py-2.5 text-muted-foreground border-r-2 border-border overflow-hidden text-ellipsis whitespace-nowrap'
                        style={{ left: FIXED_COL_OFFSETS[4] }}
                        title={assignee?.email ?? undefined}
                      >
                        {assignee ? (
                          assignee.email || (
                            <span className='italic text-muted-foreground/70'>No email on file</span>
                          )
                        ) : (
                          <span className='italic text-muted-foreground/70'>Not Assigned</span>
                        )}
                      </td>
                      {docTypes.map(t => {
                        const docs = byType.get(t.id)
                        const doc = docs?.[0]
                        const extra = docs && docs.length > 1 ? docs.length - 1 : 0
                        const status = expiryStatus(doc?.expiryDate)
                        const badgeKey = docStatusBadgeKey(status, daysUntil(doc?.expiryDate))
                        const badge = DOC_STATUS_BADGE[badgeKey]
                        const tooltip = docs
                          ?.map(d => fmtDate(d.expiryDate) ?? 'No expiry set')
                          .join(' · ')
                        return (
                          <Fragment key={`${v.id}-${t.id}`}>
                            <td
                              className='px-3 py-2.5 text-foreground border-r border-border whitespace-nowrap overflow-hidden text-ellipsis'
                              title={tooltip}
                            >
                              {doc ? fmtDate(doc.expiryDate) ?? '—' : '—'}
                              {extra > 0 && (
                                <span className='ml-1 text-[10px] text-muted-foreground'>
                                  +{extra}
                                </span>
                              )}
                            </td>
                            <td className='px-3 py-2.5 border-r border-border whitespace-nowrap overflow-hidden text-ellipsis'>
                              {doc ? (
                                <div className='flex flex-col gap-0.5'>
                                  <span
                                    className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                  <span className='text-[10.5px] text-muted-foreground'>
                                    {formatCountdown(doc.expiryDate)}
                                  </span>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.total > 0 && (
        <div className='flex items-center justify-between mt-3'>
          <p className='text-[11px] text-muted-foreground'>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} vehicle{pagination.total === 1 ? '' : 's'}
            {search ? ' (filtered on this page)' : ''}
          </p>
          {pagination.totalPages > 1 && (
            <div className='flex items-center gap-2'>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className='h-7 px-2.5 flex items-center justify-center rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              >
                Prev
              </button>
              <span className='text-[11px] text-muted-foreground'>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className='h-7 px-2.5 flex items-center justify-center rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {openVehicle && (
        <VehicleDocumentDialog
          vehicleId={openVehicle.id}
          plateNumberFallback={openVehicle.plateNumber}
          canEdit={perms.canEdit}
          canDelete={perms.canDelete}
          onClose={() => setOpenVehicle(null)}
          onChanged={refetchVehicles}
        />
      )}
    </div>
  )
}

export default function VehicleDocumentRegisterPage () {
  return (
    <PermissionGuard module='vehicle-document-register' action='canView'>
      <VehicleDocumentRegisterContent />
    </PermissionGuard>
  )
}
