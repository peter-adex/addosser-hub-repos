'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Download,
  RefreshCw,
  UserCog,
  Loader2,
  X
} from 'lucide-react'

function naira (v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '₦0.00'
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(n)) return '₦0.00'
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function fmtDate (d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

interface Tranche {
  id: string
  status: string
  plannedAmount: string
  label: string | null
}

interface Batch {
  id: string
  status: string
  totalAmount: string
  assignedAt: string
  instructions: string | null
  invoice: {
    invoiceNo: string
    vendorName: string
    vendor: { name: string } | null
    entity: { name: string; code: string }
  }
  teller: { id: string; name: string; email: string } | null
  tranches: Tranche[]
}

interface Teller {
  id: string
  name: string
  email: string
  entityId: string
}

export default function AssignedTasksPage () {
  const [batches, setBatches] = useState<Batch[]>([])
  const [tellers, setTellers] = useState<Teller[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [reassignTarget, setReassignTarget] = useState<Batch | null>(null)
  const [newTellerId, setNewTellerId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [reassignError, setReassignError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/assigned')
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(`Server error (status ${res.status})`)
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setBatches(data.batches ?? [])
      setTellers(data.tellers ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const canReassign = (b: Batch) =>
    !b.tranches.some(t => ['SUBMITTED', 'PAID'].includes(t.status))

  function openReassign (b: Batch) {
    setReassignTarget(b)
    setNewTellerId('')
    setReason('')
    setReassignError('')
  }

  async function submitReassign () {
    if (!reassignTarget || !newTellerId) {
      setReassignError('Please select a Teller.')
      return
    }
    setSaving(true)
    setReassignError('')
    try {
      const res = await fetch(
        `/api/payment/assigned/${reassignTarget.id}/reassign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newTellerId,
            reason: reason.trim() || undefined
          })
        }
      )
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(`Server error (${res.status})`)
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reassignment failed')
      setReassignTarget(null)
      load()
    } catch (e: any) {
      setReassignError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleExport (batchId: string) {
    window.location.href = `/api/payment/assigned/${batchId}/export`
  }

  const availableTellers = reassignTarget
    ? tellers.filter(t => t.id !== reassignTarget.teller?.id)
    : tellers

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Assigned Tasks
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Payments currently assigned to Tellers — reassign or export details
          </p>
        </div>
        <button
          onClick={load}
          className='p-2.5 rounded-xl border border-border hover:bg-accent transition-colors text-muted-foreground'
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!loading && !error && batches.length > 0 && (
        <div className='grid grid-cols-3 gap-4'>
          {[
            { label: 'Total Assigned', value: batches.length, icon: '📌' },
            {
              label: 'Pending Teller Action',
              value: batches.filter(b =>
                b.tranches.every(t => t.status === 'PENDING')
              ).length,
              icon: '⏳'
            },
            {
              label: 'Partially Processed',
              value: batches.filter(b =>
                b.tranches.some(t => ['SUBMITTED', 'PAID'].includes(t.status))
              ).length,
              icon: '⚙️'
            }
          ].map(tile => (
            <div
              key={tile.label}
              className='bg-card border border-border rounded-2xl p-4'
            >
              <div className='text-xl mb-1'>{tile.icon}</div>
              <div className='text-2xl font-extrabold text-foreground'>
                {tile.value}
              </div>
              <div className='text-xs text-muted-foreground mt-1'>
                {tile.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className='flex items-center justify-center py-24 text-muted-foreground gap-2'>
          <Loader2 size={18} className='animate-spin' /> Loading assigned tasks…
        </div>
      )}

      {!loading && error && (
        <div className='flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
          <AlertCircle size={16} />
          {error}
          <button onClick={load} className='ml-auto text-xs underline'>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && batches.length === 0 && (
        <div className='bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground'>
          <span className='text-5xl'>📭</span>
          <span className='font-bold text-foreground'>
            No active assigned payments
          </span>
          <p className='text-sm'>
            Assignments appear here once you assign a Teller in the Payment
            Queue.
          </p>
          <Link
            href='/payment'
            className='text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline'
          >
            Go to Payment Queue →
          </Link>
        </div>
      )}

      {!loading && !error && batches.length > 0 && (
        <div className='space-y-4'>
          {batches.map(b => {
            const submittedCount = b.tranches.filter(
              t => t.status === 'SUBMITTED'
            ).length
            const paidCount = b.tranches.filter(t => t.status === 'PAID').length
            const pendingCount = b.tranches.filter(
              t => t.status === 'PENDING'
            ).length
            const reassignable = canReassign(b)

            return (
              <div
                key={b.id}
                className='bg-card border border-border rounded-2xl overflow-hidden'
              >
                <div className='px-6 py-4 flex items-start justify-between gap-4 flex-wrap'>
                  <div>
                    <div className='flex items-center gap-2 mb-1 flex-wrap'>
                      <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                        {b.invoice.invoiceNo}
                      </code>
                      <span className='px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className='font-bold text-foreground'>
                      {b.invoice.vendor?.name ?? b.invoice.vendorName}
                    </h3>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      {b.invoice.entity.name} · Assigned {fmtDate(b.assignedAt)}{' '}
                      · Teller: <strong>{b.teller?.name ?? '—'}</strong>
                    </p>
                  </div>

                  <div className='text-right'>
                    <div className='text-xl font-extrabold font-mono text-[#FFB800]'>
                      {naira(b.totalAmount)}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      {paidCount} paid · {submittedCount} awaiting approval ·{' '}
                      {pendingCount} pending
                    </div>
                  </div>
                </div>

                {b.instructions && (
                  <div className='px-6 py-2 bg-amber-50/50 dark:bg-amber-950/10 border-t border-border text-xs text-amber-700 dark:text-amber-400'>
                    📋 Instructions: {b.instructions}
                  </div>
                )}

                {b.tranches.length > 1 && (
                  <div className='px-6 py-3 bg-muted/20 border-t border-border grid gap-1.5'>
                    {b.tranches.map(t => (
                      <div
                        key={t.id}
                        className='flex items-center justify-between text-xs text-muted-foreground'
                      >
                        <span>{t.label ?? `Tranche ${t.id}`}</span>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono font-semibold text-foreground'>
                            {naira(t.plannedAmount)}
                          </span>
                          <span className='px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold'>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className='px-6 py-3 border-t border-border flex items-center gap-3 flex-wrap'>
                  <Link
                    href={`/payment/${b.id}`}
                    className='text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'
                  >
                    View Details →
                  </Link>

                  <button
                    onClick={() => handleExport(b.id)}
                    className='flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors'
                  >
                    <Download size={12} /> Export Vendor Details
                  </button>

                  {reassignable ? (
                    <button
                      onClick={() => openReassign(b)}
                      className='flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1B2A8A] text-white hover:bg-[#121E6B] transition-colors'
                    >
                      <UserCog size={12} /> Reassign Teller
                    </button>
                  ) : (
                    <span className='text-xs text-muted-foreground italic'>
                      Cannot reassign — Teller has already submitted
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reassignTarget && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl'>
            <div className='flex items-center justify-between'>
              <h2 className='font-bold text-foreground text-lg'>
                Reassign Teller
              </h2>
              <button
                onClick={() => setReassignTarget(null)}
                className='text-muted-foreground hover:text-foreground'
              >
                <X size={18} />
              </button>
            </div>

            <p className='text-sm text-muted-foreground'>
              Invoice <strong>{reassignTarget.invoice.invoiceNo}</strong> ·
              Currently assigned to:{' '}
              <strong>{reassignTarget.teller?.name ?? '—'}</strong>
            </p>

            <div>
              <label className='block text-sm font-bold text-foreground mb-1.5'>
                New Teller <span className='text-red-500'>*</span>
              </label>
              {availableTellers.length === 0 ? (
                <div className='text-sm text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                  No other Tellers available. Ensure at least one other user has
                  Teller role access.
                </div>
              ) : (
                <select
                  value={newTellerId}
                  onChange={e => setNewTellerId(e.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition'
                >
                  <option value=''>Select a Teller…</option>
                  {availableTellers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className='block text-sm font-bold text-foreground mb-1.5'>
                Reason{' '}
                <span className='text-muted-foreground font-normal'>
                  (optional)
                </span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder='e.g. Original Teller unavailable'
                className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] resize-none transition'
              />
            </div>

            {reassignError && (
              <div className='px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400'>
                {reassignError}
              </div>
            )}

            <div className='flex gap-3'>
              <button
                onClick={submitReassign}
                disabled={
                  !newTellerId || saving || availableTellers.length === 0
                }
                className='flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] font-extrabold text-sm disabled:opacity-50 transition-colors'
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className='animate-spin' /> Reassigning…
                  </>
                ) : (
                  'Confirm Reassign'
                )}
              </button>
              <button
                onClick={() => setReassignTarget(null)}
                className='px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors'
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
