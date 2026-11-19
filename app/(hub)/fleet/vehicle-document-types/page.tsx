'use client'
import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  X
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/shared/Badge'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import {
  useVehicleDocumentTypes,
  useMutation,
  type ApiVehicleDocumentType
} from '@/lib/hooks/useApi'

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition'
const REQ = <span className='text-red-500 ml-0.5'>*</span>

const BLANK = { name: '', description: '', sortOrder: undefined as number | undefined }

function VehicleDocumentTypesContent () {
  const { data, loading, refetch } = useVehicleDocumentTypes({ includeInactive: true })
  const { mutate, loading: saving } = useMutation()
  const perms = usePagePermissions('vehicle-document-types')

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    id?: string
    data: typeof BLANK
  }>({ open: false, mode: 'create', data: BLANK })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const items = data?.items ?? []
  const filtered = useMemo(
    () =>
      items.filter(
        t =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? '').toLowerCase().includes(search.toLowerCase())
      ),
    [items, search]
  )

  function openCreate () {
    setError('')
    setModal({ open: true, mode: 'create', data: BLANK })
  }
  function openEdit (t: ApiVehicleDocumentType) {
    setError('')
    setModal({
      open: true,
      mode: 'edit',
      id: t.id,
      data: { name: t.name, description: t.description ?? '', sortOrder: t.sortOrder }
    })
  }

  async function save () {
    setError('')
    const payload = {
      name: modal.data.name.trim(),
      description: modal.data.description.trim() || undefined
    }
    const { error: err } =
      modal.mode === 'create'
        ? await mutate('POST', '/api/fleet/vehicle-document-types', payload)
        : await mutate('PATCH', `/api/fleet/vehicle-document-types/${modal.id}`, payload)
    if (err) {
      setError(err)
      return
    }
    setMsg(
      modal.mode === 'create'
        ? `"${payload.name}" created`
        : `"${payload.name}" updated`
    )
    setModal({ open: false, mode: 'create', data: BLANK })
    refetch()
  }

  async function toggleActive (t: ApiVehicleDocumentType) {
    const { error: err } = await mutate('PATCH', `/api/fleet/vehicle-document-types/${t.id}`, {
      isActive: !t.isActive
    })
    if (err) setError(err)
    else refetch()
  }

  async function remove (t: ApiVehicleDocumentType) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone if unused.`)) return
    const { data: res, error: err } = await mutate(
      'DELETE',
      `/api/fleet/vehicle-document-types/${t.id}`
    )
    if (err) {
      setError(err)
      return
    }
    setMsg((res as any)?.message ?? `"${t.name}" deleted`)
    refetch()
  }

  return (
    <div className='animate-fade-in'>
      <PageHeader
        title='Vehicle Document Types'
        subtitle='Manage the document types selectable on the vehicle form and shown on the Vehicle Document Register'
        action={
          perms.canCreate && (
            <button
              onClick={openCreate}
              className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid transition-colors'
            >
              <Plus size={14} /> New Document Type
            </button>
          )
        }
      />

      {msg && (
        <div className='mb-4 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-[12.5px]'>
          {msg}
        </div>
      )}
      {error && !modal.open && (
        <div className='mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[12.5px]'>
          {error}
        </div>
      )}

      <div className='flex items-center gap-3 mb-4'>
        <div className='relative w-72'>
          <Search
            size={14}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
          />
          <input
            className={`${INP} pl-8`}
            placeholder='Search document types…'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        {loading ? (
          <div className='flex items-center justify-center py-16'>
            <Loader2 size={22} className='animate-spin text-muted-foreground' />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title='No document types found'
            description={
              search
                ? 'Try a different search term.'
                : 'Create your first Vehicle Document Type — e.g. Insurance Certificate, Roadworthiness Certificate, Hackney Permit.'
            }
          />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted/40'>
                  {['Name', 'Description', 'In Use', 'Show in Register', 'Actions'].map(h => (
                    <th
                      key={h}
                      className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr
                    key={t.id}
                    className='border-t border-border hover:bg-accent/30 transition-colors'
                  >
                    <td className='px-4 py-3.5 text-[13px] font-semibold text-foreground'>
                      {t.name}
                    </td>
                    <td className='px-4 py-3.5 text-[12.5px] text-muted-foreground max-w-sm truncate'>
                      {t.description || '—'}
                    </td>
                    <td className='px-4 py-3.5 text-[12.5px] text-foreground'>
                      {t._count?.documents ?? 0}
                    </td>
                    <td className='px-4 py-3.5'>
                      <label className='inline-flex items-center gap-2 cursor-pointer select-none'>
                        <input
                          type='checkbox'
                          checked={t.isActive}
                          onChange={() => toggleActive(t)}
                          disabled={!(perms.canEdit || perms.canDelete)}
                          className='h-4 w-4 rounded border-border text-brand-navy focus:ring-brand-navy/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                        />
                        <Badge variant={t.isActive ? 'green' : 'gray'}>
                          {t.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </label>
                    </td>
                    <td className='px-4 py-3.5'>
                      <div className='flex items-center gap-2'>
                        {perms.canEdit && (
                          <button
                            onClick={() => openEdit(t)}
                            className='h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                            title='Edit'
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {perms.canDelete && (
                          <button
                            onClick={() => remove(t)}
                            className='h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors'
                            title='Delete'
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'>
          <div className='bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md'>
            <div className='flex items-center justify-between px-6 py-4 border-b border-border'>
              <h2 className='font-bold text-foreground text-[15px]'>
                {modal.mode === 'create' ? 'New Document Type' : `Edit — ${modal.data.name}`}
              </h2>
              <button
                onClick={() => setModal({ open: false, mode: 'create', data: BLANK })}
                className='h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted'
              >
                <X size={15} />
              </button>
            </div>
            <div className='p-6 space-y-4'>
              {error && (
                <div className='p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[12.5px]'>
                  {error}
                </div>
              )}
              <div className='flex flex-col gap-1.5'>
                <label className='text-[12px] font-medium text-foreground'>
                  Document Type Name{REQ}
                </label>
                <input
                  className={INP}
                  placeholder='e.g. Hackney Permit'
                  value={modal.data.name}
                  onChange={e =>
                    setModal(m => ({ ...m, data: { ...m.data, name: e.target.value } }))
                  }
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <label className='text-[12px] font-medium text-foreground'>
                  Description
                </label>
                <textarea
                  className={INP}
                  rows={2}
                  placeholder='Optional description'
                  value={modal.data.description}
                  onChange={e =>
                    setModal(m => ({ ...m, data: { ...m.data, description: e.target.value } }))
                  }
                />
              </div>
            </div>
            <div className='px-6 py-4 border-t border-border flex gap-3'>
              <button
                onClick={save}
                disabled={saving || !modal.data.name.trim()}
                className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors'
              >
                {saving && <Loader2 size={13} className='animate-spin' />}
                {modal.mode === 'create' ? 'Create' : 'Save Changes'}
              </button>
              <button
                onClick={() => setModal({ open: false, mode: 'create', data: BLANK })}
                className='rounded-lg border border-border px-5 py-2.5 text-[13px] text-muted-foreground hover:bg-muted transition-colors'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VehicleDocumentTypesPage () {
  return (
    <PermissionGuard module='vehicle-document-types' action='canView'>
      <VehicleDocumentTypesContent />
    </PermissionGuard>
  )
}
