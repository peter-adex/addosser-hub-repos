'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Truck
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import { useDrivers } from '@/lib/hooks/useApi'

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(d))

function licenseStatus (expiryDate: string) {
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / 86400000
  )
  if (days < 0)
    return {
      badge: 'Expired',
      cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      icon: <AlertTriangle size={10} />,
      days
    }
  if (days < 30)
    return {
      badge: `${days}d left`,
      cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      icon: <AlertTriangle size={10} />,
      days
    }
  if (days < 90)
    return {
      badge: `${days}d left`,
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      icon: <Clock size={10} />,
      days
    }
  return {
    badge: 'Valid',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    icon: <CheckCircle size={10} />,
    days
  }
}

const STATUS_OPTS = [
  { value: '', label: 'All Drivers' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
]

export default function DriversPage () {
  return (
    <PermissionGuard module='drivers' action='canView'>
      <DriversContent />
    </PermissionGuard>
  )
}

function DriversContent () {
  const router = useRouter()
  const perms = usePagePermissions('drivers')

  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data, loading, error, refetch } = useDrivers({
    search,
    status: statusF,
    limit: '50'
  })
  const drivers = data?.items ?? []

  async function handleDelete (id: string, name: string) {
    if (
      !confirm(`Deactivate driver "${name}"? Trip history will be preserved.`)
    )
      return
    setDeleting(id)
    await fetch(`/api/fleet/drivers/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    setDeleting(null)
    refetch()
  }

  return (
    <div className='animate-fade-in'>
      <PageHeader
        title='Drivers'
        subtitle={`${data?.pagination?.total ?? 0} driver${
          (data?.pagination?.total ?? 0) !== 1 ? 's' : ''
        } registered`}
        action={
          perms.canCreate ? (
            <button
              onClick={() => router.push('/fleet/drivers/new')}
              className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors'
            >
              <Plus size={14} /> Add Driver
            </button>
          ) : null
        }
      />

      <div className='flex flex-wrap gap-3 mb-5'>
        <div className='relative flex-1 min-w-[180px] max-w-xs'>
          <Search
            size={13}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Name, email, license…'
            className='w-full pl-8 pr-3 py-2 text-[12.5px] rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand-navy/30 text-foreground placeholder:text-muted-foreground'
          />
        </div>
        <div className='w-44'>
          <SearchableSelect
            options={STATUS_OPTS}
            value={statusF}
            onChange={setStatusF}
            placeholder='Status'
          />
        </div>
      </div>

      {error && (
        <div className='mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 text-[12.5px] text-red-700 dark:text-red-300'>
          {error}
        </div>
      )}

      {loading && (
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className='h-16 border-b border-border/50 bg-muted/20 animate-pulse'
            />
          ))}
        </div>
      )}

      {!loading && drivers.length === 0 && (
        <EmptyState
          title='No drivers found'
          description={
            search || statusF
              ? 'Adjust your filters.'
              : 'Register your first driver.'
          }
          action={
            perms.canCreate && !search && !statusF ? (
              <button
                onClick={() => router.push('/fleet/drivers/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-brand-gold'
              >
                <Plus size={14} /> Add Driver
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && drivers.length > 0 && (
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-[12px]'>
              <thead>
                <tr className='border-b border-border bg-muted/30'>
                  {[
                    'Driver',
                    'Contact',
                    'Primary License',
                    'Expiry',
                    'Assigned Vehicle',
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
                {drivers.map(d => {
                  const primary =
                    d.licenses?.find((l: any) => l.isPrimary) ?? d.licenses?.[0]
                  const licSt = primary
                    ? licenseStatus(primary.expiryDate)
                    : null
                  const initials = d.user.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <tr
                      key={d.id}
                      className='border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors'
                    >
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2.5'>
                          {d.photoUrl ? (
                            <img
                              src={d.photoUrl}
                              alt=''
                              className='h-8 w-8 rounded-full object-cover flex-shrink-0 border border-border'
                            />
                          ) : (
                            <div className='h-8 w-8 rounded-full bg-brand-navy/10 dark:bg-brand-gold/10 flex items-center justify-center text-[10px] font-bold text-brand-navy dark:text-brand-gold flex-shrink-0'>
                              {initials}
                            </div>
                          )}
                          <div>
                            <p className='font-semibold text-foreground'>
                              {d.user.name}
                            </p>
                            <p className='text-[10.5px] text-muted-foreground'>
                              {d.entity?.code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        <p>{d.user.email}</p>
                        {d.user.phone && (
                          <p className='text-[10.5px]'>{d.user.phone}</p>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        {primary ? (
                          <div>
                            <p className='font-mono text-[11px] text-foreground'>
                              {primary.licenseNumber}
                            </p>
                            <p className='text-[10px] text-muted-foreground capitalize'>
                              {primary.type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        ) : (
                          <span className='text-muted-foreground/50 italic'>
                            None
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        {licSt ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${licSt.cls}`}
                            >
                              {licSt.icon} {licSt.badge}
                            </span>
                            <p className='text-[10px] text-muted-foreground mt-0.5'>
                              {fmtDate(primary!.expiryDate)}
                            </p>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        {(d as any).assignedVehicle ? (
                          <div className='flex items-center gap-1.5'>
                            <Truck
                              size={11}
                              className='text-brand-navy dark:text-brand-gold'
                            />
                            <div>
                              <p className='font-mono font-bold text-foreground text-[11.5px]'>
                                {(d as any).assignedVehicle.plateNumber}
                              </p>
                              <p className='text-[10px] text-muted-foreground'>
                                {(d as any).assignedVehicle.make}{' '}
                                {(d as any).assignedVehicle.model}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className='text-muted-foreground/50 italic text-[11px]'>
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className='px-4 py-3'>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                            d.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <button
                            onClick={() => router.push(`/fleet/drivers/${d.id}`)}
                            className='inline-flex items-center gap-1 text-[11px] text-brand-navy dark:text-brand-gold hover:underline'
                          >
                            <Eye size={11} /> View
                          </button>

                          {perms.canEdit && (
                            <>
                              <span className='text-border'>|</span>
                              <button
                                onClick={() =>
                                  router.push(`/fleet/drivers/${d.id}/edit`)
                                }
                                className='inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground'
                              >
                                <Pencil size={11} /> Edit
                              </button>
                            </>
                          )}

                          {perms.canDelete && (
                            <>
                              <span className='text-border'>|</span>
                              <button
                                onClick={() => handleDelete(d.id, d.user.name)}
                                disabled={deleting === d.id}
                                className='inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 disabled:opacity-50'
                              >
                                {deleting === d.id ? (
                                  <Loader2 size={11} className='animate-spin' />
                                ) : (
                                  <Trash2 size={11} />
                                )}{' '}
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className='px-4 py-2.5 border-t border-border bg-muted/20 flex justify-between items-center text-[11px] text-muted-foreground'>
            <span>
              {drivers.length} driver{drivers.length !== 1 ? 's' : ''} shown
            </span>
          </div>
        </div>
      )}

      <div className='mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground'>
        <span className='font-medium'>License status:</span>
        {[
          {
            badge: 'Expired',
            cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          },
          {
            badge: '< 30 days',
            cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          },
          {
            badge: '< 90 days',
            cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          },
          {
            badge: 'Valid',
            cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }
        ].map(s => (
          <span
            key={s.badge}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${s.cls}`}
          >
            {s.badge}
          </span>
        ))}
      </div>
    </div>
  )
}
