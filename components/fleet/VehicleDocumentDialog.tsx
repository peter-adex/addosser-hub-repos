'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Upload, Trash2, FileText, ExternalLink, AlertTriangle } from 'lucide-react'
import { useVehicleDocumentTypes } from '@/lib/hooks/useApi'
import { formatCountdown, expiryStatus } from '@/lib/utils'

interface DialogDoc {
  id: string
  name: string
  type: string
  documentTypeId: string | null
  documentType: { id: string; name: string; isActive: boolean } | null
  url: string | null
  storageProvider: string | null
  storageKey: string | null
  fileSize: number | null
  mimeType: string | null
  expiryDate: string | null
}

interface DialogVehicle {
  id: string
  plateNumber: string
  documents: DialogDoc[]
}

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition disabled:opacity-60'

const STATUS_BADGE: Record<string, string> = {
  expired:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  'due-today':
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  upcoming:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  none: 'bg-muted text-muted-foreground border-border'
}

function fmtSize (bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentRow ({
  vehicleId,
  typeId,
  typeName,
  typeActive,
  doc,
  canEdit,
  canDelete,
  onChanged
}: {
  vehicleId: string
  typeId: string
  typeName: string
  typeActive: boolean
  doc: DialogDoc | undefined
  canEdit: boolean
  canDelete: boolean
  onChanged: (updated: DialogDoc | { deletedId: string }) => void
}) {
  const [expiry, setExpiry] = useState(doc?.expiryDate?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setExpiry(doc?.expiryDate?.slice(0, 10) ?? '')
  }, [doc?.id, doc?.expiryDate])

  const dirty = (doc?.expiryDate?.slice(0, 10) ?? '') !== expiry
  const status = expiryStatus(doc?.expiryDate)

  async function callApi (
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown>
  ) {
    const res = await fetch(`/api/fleet/vehicles/${vehicleId}/documents`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Request failed')
    return json.data
  }

  async function saveExpiry () {
    setError('')
    setSaving(true)
    try {
      if (doc) {
        const updated = await callApi('PATCH', {
          documentId: doc.id,
          expiryDate: expiry || null
        })
        onChanged(updated)
      } else {
        const created = await callApi('POST', {
          name: typeName,
          documentTypeId: typeId,
          expiryDate: expiry || undefined
        })
        onChanged(created)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleFile (file: File) {
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'vehicle-docs')
      const upRes = await fetch('/api/fleet/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd
      })
      const upJson = await upRes.json()
      if (!upRes.ok) throw new Error(upJson.error ?? 'Upload failed')

      const fileFields = {
        url: upJson.data.url,
        storageProvider: upJson.data.storageProvider,
        storageKey: upJson.data.storageKey,
        fileSize: upJson.data.fileSize,
        mimeType: upJson.data.fileType
      }

      if (doc) {
        const updated = await callApi('PATCH', { documentId: doc.id, ...fileFields })
        onChanged(updated)
      } else {
        const created = await callApi('POST', {
          name: typeName,
          documentTypeId: typeId,
          expiryDate: expiry || undefined,
          ...fileFields
        })
        onChanged(created)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeFile () {
    if (!doc) return
    setError('')
    setSaving(true)
    try {
      const updated = await callApi('PATCH', {
        documentId: doc.id,
        url: null,
        storageProvider: null,
        storageKey: null,
        fileSize: null,
        mimeType: null,
        publicId: null
      })
      onChanged(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove file')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDocument () {
    if (!doc) return
    if (!confirm(`Delete this ${typeName} document record? This cannot be undone.`)) return
    setError('')
    setSaving(true)
    try {
      await callApi('DELETE', { documentId: doc.id })
      onChanged({ deletedId: doc.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
      setSaving(false)
    }
  }

  const busy = saving || uploading

  return (
    <div className='border border-border rounded-xl p-4'>
      <div className='flex items-start justify-between gap-3 mb-3'>
        <div>
          <p className='text-[13px] font-semibold text-foreground'>{typeName}</p>
          {!typeActive && (
            <p className='text-[10.5px] text-muted-foreground italic mt-0.5'>
              This document type has been deactivated in Fleet Settings.
            </p>
          )}
        </div>
        {doc && (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold flex-shrink-0 ${STATUS_BADGE[status]}`}
          >
            {status === 'none' ? 'No expiry set' : formatCountdown(doc.expiryDate)}
          </span>
        )}
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex-1 min-w-[160px]'>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Expiry date
          </label>
          <input
            type='date'
            className={INP}
            value={expiry}
            disabled={!canEdit || busy}
            onChange={e => setExpiry(e.target.value)}
          />
        </div>

        <div className='flex-1 min-w-[200px]'>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Uploaded document
          </label>
          {doc?.url ? (
            <div className='flex items-center gap-2 h-[38px]'>
              <a
                href={doc.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1.5 text-[12px] text-brand-navy dark:text-brand-gold hover:underline truncate'
              >
                <FileText size={13} className='flex-shrink-0' />
                <span className='truncate'>{doc.name}</span>
                <ExternalLink size={11} className='flex-shrink-0' />
              </a>
              {doc.fileSize ? (
                <span className='text-[10.5px] text-muted-foreground flex-shrink-0'>
                  ({fmtSize(doc.fileSize)})
                </span>
              ) : null}
              {canEdit && (
                <button
                  type='button'
                  title='Remove file'
                  disabled={busy}
                  onClick={removeFile}
                  className='h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50'
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ) : (
            <p className='text-[12px] text-muted-foreground italic h-[38px] flex items-center'>
              No file uploaded — optional
            </p>
          )}
        </div>

        {canEdit && (
          <div className='flex items-center gap-2'>
            <input
              ref={fileRef}
              type='file'
              className='hidden'
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <button
              type='button'
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className='inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-[12px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50'
            >
              {uploading ? (
                <Loader2 size={13} className='animate-spin' />
              ) : (
                <Upload size={13} />
              )}
              {doc?.url ? 'Replace' : 'Upload'}
            </button>

            <button
              type='button'
              disabled={busy || !dirty}
              onClick={saveExpiry}
              className='inline-flex items-center gap-1.5 h-9 rounded-lg bg-brand-navy px-3.5 text-[12px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {saving && <Loader2 size={13} className='animate-spin' />}
              Save
            </button>

            {doc && canDelete && (
              <button
                type='button'
                title='Delete this document record'
                disabled={busy}
                onClick={deleteDocument}
                className='h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50'
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className='text-[11px] text-red-500 mt-2 flex items-center gap-1'>
          <AlertTriangle size={11} /> {error}
        </p>
      )}
    </div>
  )
}

export function VehicleDocumentDialog ({
  vehicleId,
  plateNumberFallback,
  canEdit,
  canDelete,
  onClose,
  onChanged
}: {
  vehicleId: string
  plateNumberFallback: string
  canEdit: boolean
  canDelete: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { data: typeRes } = useVehicleDocumentTypes()
  const [vehicle, setVehicle] = useState<DialogVehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/documents`, {
        credentials: 'include',
        cache: 'no-store'
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load documents')
        return
      }
      setVehicle(json.data)
    } catch {
      setError('Network error — could not load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [vehicleId])

  useEffect(() => {
    function onKey (e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleRowChanged (result: DialogDoc | { deletedId: string }) {
    setVehicle(v => {
      if (!v) return v
      if ('deletedId' in result) {
        return { ...v, documents: v.documents.filter(d => d.id !== result.deletedId) }
      }
      const exists = v.documents.some(d => d.id === result.id)
      return {
        ...v,
        documents: exists
          ? v.documents.map(d => (d.id === result.id ? result : d))
          : [result, ...v.documents]
      }
    })
    onChanged()
  }

  const types = (typeRes?.items ?? []).filter(t => t.isActive)

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label={`Manage documents for ${plateNumberFallback}`}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'
    >
      <div className='bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0'>
          <div>
            <p className='text-[11px] font-medium text-muted-foreground uppercase tracking-wide'>
              Vehicle Documents
            </p>
            <h2 className='text-[16px] font-bold text-foreground font-mono'>
              {vehicle?.plateNumber ?? plateNumberFallback}
            </h2>
          </div>
          <button
            onClick={onClose}
            className='h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors'
            aria-label='Close'
          >
            <X size={16} />
          </button>
        </div>

        <div className='px-5 py-4 overflow-y-auto space-y-3'>
          {!canEdit && (
            <div className='rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-[11.5px] text-muted-foreground'>
              You have view-only access to vehicle documents.
            </div>
          )}
          {loading ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 size={20} className='animate-spin text-muted-foreground' />
            </div>
          ) : error ? (
            <div className='rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-[13px] text-red-700 dark:text-red-400 flex items-center justify-between gap-3'>
              <span>{error}</span>
              <button
                onClick={load}
                className='rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-[12px] font-medium hover:bg-red-100 dark:hover:bg-red-950/50 flex-shrink-0'
              >
                Retry
              </button>
            </div>
          ) : types.length === 0 ? (
            <p className='text-[13px] text-muted-foreground text-center py-8'>
              No active Vehicle Document Types are configured yet.
            </p>
          ) : (
            types.map(t => (
              <DocumentRow
                key={t.id}
                vehicleId={vehicleId}
                typeId={t.id}
                typeName={t.name}
                typeActive={t.isActive}
                doc={vehicle?.documents.find(d => d.documentTypeId === t.id)}
                canEdit={canEdit}
                canDelete={canDelete}
                onChanged={handleRowChanged}
              />
            ))
          )}
        </div>

        <div className='px-5 py-3 border-t border-border flex-shrink-0 flex justify-end'>
          <button
            onClick={onClose}
            className='rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted transition-colors'
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
