'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

function naira (v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

interface TrancheRow {
  id: string
  label: string | null
  plannedAmount: string
  transactionRef: string | null
  paymentMethod: string | null
  submittedAt: string
  paymentBatch: {
    id: string
    invoice: {
      invoiceNo: string
      invoiceType: string
      vendor: { name: string } | null
      vendorName: string
      entity: { name: string; code: string }
    }
    teller: { name: string; email: string } | null
  }
}

export default function ApprovalsPage () {
  const [tranches, setTranches] = useState<TrancheRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [invoiceNo, setInvoiceNo] = useState('')
  const [tellerName, setTellerName] = useState('')
  const [transactionRef, setTransactionRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (invoiceNo.trim()) params.set('invoiceNo', invoiceNo.trim())
      if (tellerName.trim()) params.set('tellerName', tellerName.trim())
      if (transactionRef.trim())
        params.set('transactionRef', transactionRef.trim())

      const res = await fetch(`/api/payment/approvals?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setTranches(data.tranches ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [invoiceNo, tellerName, transactionRef])

  useEffect(() => {
    load()
  }, [])

  function handleSearch (e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  function clearFilters () {
    setInvoiceNo('')
    setTellerName('')
    setTransactionRef('')
    setTimeout(load, 0)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Payment Approvals
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Payments submitted by Tellers awaiting your verification
          </p>
        </div>
        <button
          onClick={load}
          className='p-2.5 rounded-xl border border-border hover:bg-accent transition-colors text-muted-foreground'
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        className='bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3'
      >
        <input
          value={invoiceNo}
          onChange={e => setInvoiceNo(e.target.value)}
          placeholder='Invoice No.'
          className='rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
        />
        <input
          value={tellerName}
          onChange={e => setTellerName(e.target.value)}
          placeholder='Teller name'
          className='rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
        />
        <input
          value={transactionRef}
          onChange={e => setTransactionRef(e.target.value)}
          placeholder='Payment reference'
          className='rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
        />
        <div className='flex gap-2'>
          <button
            type='submit'
            className='flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold'
          >
            <Search size={14} /> Search
          </button>
          <button
            type='button'
            onClick={clearFilters}
            className='px-3 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent'
          >
            Clear
          </button>
        </div>
      </form>

      {loading && (
        <div className='flex items-center justify-center py-24 text-muted-foreground gap-2'>
          <Loader2 size={18} className='animate-spin' /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className='flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && tranches.length === 0 && (
        <div className='bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground'>
          <span className='text-5xl'>✅</span>
          <span className='font-bold text-foreground'>
            No payments match your search
          </span>
        </div>
      )}

      {!loading && !error && tranches.length > 0 && (
        <div className='space-y-3'>
          {tranches.map(t => (
            <div
              key={t.id}
              className='bg-card border border-border rounded-2xl px-6 py-4 flex items-center justify-between gap-4 flex-wrap'
            >
              <div>
                <div className='flex items-center gap-2 mb-1 flex-wrap'>
                  <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                    {t.paymentBatch.invoice.invoiceNo}
                  </code>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${INVOICE_TYPE_BADGE_CLASS[t.paymentBatch.invoice.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
                    {invoiceTypeLabel(t.paymentBatch.invoice.invoiceType)}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    Ref: {t.transactionRef ?? '—'}
                  </span>
                </div>
                <h3 className='font-bold text-foreground'>
                  {t.paymentBatch.invoice.vendor?.name ??
                    t.paymentBatch.invoice.vendorName}
                </h3>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  {t.paymentBatch.invoice.entity.name} · Teller:{' '}
                  <strong>{t.paymentBatch.teller?.name ?? '—'}</strong>
                </p>
              </div>
              <div className='text-right flex items-center gap-4'>
                <div>
                  <div className='text-lg font-extrabold font-mono text-[#FFB800]'>
                    {naira(t.plannedAmount)}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {t.label ?? 'Full Payment'}
                  </div>
                </div>
                <Link
                  href={`/payment/${t.paymentBatch.id}`}
                  className='bg-[#1B2A8A] hover:bg-[#121E6B] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors'
                >
                  Review →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
