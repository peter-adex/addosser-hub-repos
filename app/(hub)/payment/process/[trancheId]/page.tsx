'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePaymentCaps } from '@/hooks/usePaymentCaps'
import { Upload, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

function naira (v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '₦0.00'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return '₦0.00'
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

async function fetchJSON (url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    throw new Error(
      `Server error (${res.status}) — API route may be missing or throwing`
    )
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

interface TrancheDetail {
  id: string
  trancheNumber: number
  label: string | null
  plannedAmount: string
  plannedPercentage: string | null
  status: string
  paymentMethod: string | null
  transactionRef: string | null
  tellerNotes: string | null
  proofs: {
    id: string
    fileName: string
    fileUrl: string
    uploadedAt: string
  }[]
  paymentBatch: {
    id: string
    isSplitPayment: boolean
    totalAmount: string
    assignmentNote: string | null
    invoice: {
      invoiceNo: string
      invoiceType: string
      vendorName: string
      subtotal: string
      vatAmount: string
      vatRate: string
      whtAmount: string
      whtRate: string
      totalAmount: string
      amountPayable: string
      description: string | null
      glAccountCode: string
      vendor: {
        bankName: string | null
        bankAccountNo: string | null
        bankAccountName: string | null
      } | null
    }
  }
}

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' }
]

export default function ProcessTranchePage () {
  const { trancheId } = useParams<{ trancheId: string }>()
  const router = useRouter()
  const caps = usePaymentCaps()
  const perms = { canEdit: caps.process }

  const [tranche, setTranche] = useState<TrancheDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitOk, setSubmitOk] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [transactionRef, setTransactionRef] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16))
  const [tellerNotes, setTellerNotes] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const uploadedProofIdRef = useRef<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!perms.canEdit) {
      router.replace('/unauthorized')
      return
    }

    async function load () {
      try {
        const data = await fetchJSON(`/api/payment/tranches/${trancheId}`)
        setTranche(data)
      } catch (e: any) {
        setLoadError(e.message || 'Could not load payment details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [trancheId, perms.canEdit, router])

  async function handleUpload (file: File): Promise<boolean> {
    setUploading(true)
    setUploadError('')
    uploadedProofIdRef.current = null

    try {
      const fd = new FormData()
      fd.append('trancheId', trancheId)
      fd.append('file', file)

      const res = await fetch('/api/payment/proof-upload', {
        method: 'POST',
        body: fd
      })

      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(
          `Upload server error (${res.status}) — proof-upload API route may be missing`
        )
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      uploadedProofIdRef.current = data.proofId
      setUploadedFileName(data.fileName)
      return true
    } catch (e: any) {
      setUploadError(e.message)
      return false
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    if (!transactionRef.trim()) {
      setSubmitError('Transaction reference is required.')
      return
    }

    setSubmitting(true)
    try {
      if (proofFile && !uploadedProofIdRef.current) {
        const ok = await handleUpload(proofFile)
        if (!ok) {
          setSubmitting(false)
          return
        }
      }

      const data = await fetchJSON(
        `/api/payment/tranches/${trancheId}/process`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod,
            transactionRef: transactionRef.trim(),
            paidAt: new Date(paidAt).toISOString(),
            tellerNotes: tellerNotes.trim() || undefined
          })
        }
      )

      setSubmitOk(true)
      setTimeout(() => router.push('/payment/my-tasks'), 2000)
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64 text-muted-foreground gap-2'>
        <Loader2 size={18} className='animate-spin' /> Loading payment details…
      </div>
    )
  }

  if (loadError || !tranche) {
    return (
      <div className='flex flex-col items-center gap-3 py-20 text-center'>
        <AlertCircle size={40} className='text-red-500' />
        <p className='font-bold text-foreground'>Could not load this payment</p>
        <p className='text-sm text-muted-foreground max-w-sm'>
          {loadError || 'Tranche not found.'}
        </p>
        <button
          onClick={() => router.back()}
          className='text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline'
        >
          ← Go back
        </button>
      </div>
    )
  }

  const inv = tranche.paymentBatch.invoice
  const subtotal = parseFloat(inv.subtotal)
  const vatAmount = parseFloat(inv.vatAmount)
  const whtAmount = parseFloat(inv.whtAmount)
  const amountPayable = parseFloat(inv.amountPayable)
  const trancheAmt = parseFloat(tranche.plannedAmount)
  const vatPct = (parseFloat(inv.vatRate) * 100).toFixed(1)
  const whtPct = (parseFloat(inv.whtRate) * 100).toFixed(1)
  const isAlreadySubmitted = !['PENDING', 'REJECTED'].includes(tranche.status)

  if (submitOk) {
    return (
      <div className='flex flex-col items-center gap-4 py-24 text-center'>
        <CheckCircle size={56} className='text-green-500' />
        <h2 className='text-xl font-extrabold text-foreground'>
          Payment Submitted
        </h2>
        <p className='text-sm text-muted-foreground'>
          Your submission is awaiting verification. You'll be notified of the
          outcome.
        </p>
        <p className='text-xs text-muted-foreground'>
          Redirecting to My Tasks…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='max-w-3xl mx-auto space-y-6'>
      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          Process Payment
        </h1>
        <p className='text-muted-foreground text-sm mt-1'>
          {inv.invoiceNo} — {inv.vendorName}
          {tranche.paymentBatch.isSplitPayment && (
            <span className='ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold'>
              Split — Tranche {tranche.trancheNumber}
            </span>
          )}
        </p>
        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${INVOICE_TYPE_BADGE_CLASS[inv.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
          {invoiceTypeLabel(inv.invoiceType)}
        </span>
      </div>

      {tranche.status === 'REJECTED' && tranche.tellerNotes && (
        <div className='bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4'>
          <p className='text-sm text-red-700 dark:text-red-400'>
            <strong>Returned for correction:</strong> {tranche.tellerNotes}
          </p>
        </div>
      )}

      {isAlreadySubmitted && (
        <div className='bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4'>
          <p className='text-sm text-amber-700 dark:text-amber-400'>
            This tranche has already been submitted (status: {tranche.status}).
            No further action needed.
          </p>
        </div>
      )}

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        <div className='px-6 py-4 border-b border-border bg-muted/30'>
          <h2 className='font-bold text-foreground text-sm'>
            Invoice Financial Breakdown
          </h2>
          <p className='text-xs text-muted-foreground mt-0.5'>
            Exact values — confirm before processing
          </p>
        </div>
        <div className='px-6 py-5 space-y-3'>
          {[
            { label: `Sub-Total`, value: naira(subtotal), red: false },
            {
              label: `VAT (${vatPct}%)`,
              value: `+ ${naira(vatAmount)}`,
              red: false
            },
            {
              label: `WHT (${whtPct}%) — Deducted`,
              value: `− ${naira(whtAmount)}`,
              red: true
            }
          ].map(({ label, value, red }) => (
            <div
              key={label}
              className='flex justify-between items-center text-sm'
            >
              <span className='text-muted-foreground'>{label}</span>
              <span
                className={`font-semibold ${
                  red ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                }`}
              >
                {value}
              </span>
            </div>
          ))}
          <div className='border-t border-border pt-3 flex justify-between items-center'>
            <span className='font-bold text-foreground text-sm'>
              Total Payable to Vendor
            </span>
            <span className='font-extrabold text-[#FFB800] text-xl'>
              {naira(amountPayable)}
            </span>
          </div>
          {tranche.paymentBatch.isSplitPayment && (
            <div className='bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-2'>
              <div className='flex justify-between items-center'>
                <div>
                  <div className='text-sm font-bold text-blue-700 dark:text-blue-400'>
                    This Tranche:{' '}
                    {tranche.label ?? `Tranche ${tranche.trancheNumber}`}
                  </div>
                  {tranche.plannedPercentage && (
                    <div className='text-xs text-blue-600 dark:text-blue-500 mt-0.5'>
                      {parseFloat(tranche.plannedPercentage).toFixed(0)}% of
                      total payable
                    </div>
                  )}
                </div>
                <span className='font-extrabold text-blue-700 dark:text-blue-400 text-xl'>
                  {naira(trancheAmt)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {tranche.paymentBatch.assignmentNote && (
        <div className='bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-4'>
          <p className='text-xs font-bold text-amber-700 dark:text-amber-400 mb-1'>
            📋 Payment Head Instruction
          </p>
          <p className='text-sm text-amber-800 dark:text-amber-300'>
            {tranche.paymentBatch.assignmentNote}
          </p>
        </div>
      )}

      {inv.vendor && (
        <div className='bg-card border border-border rounded-2xl px-6 py-4'>
          <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3'>
            Vendor Bank Details
          </p>
          <div className='grid grid-cols-3 gap-4 text-sm'>
            {[
              { label: 'Bank Name', value: inv.vendor.bankName },
              { label: 'Account No', value: inv.vendor.bankAccountNo },
              { label: 'Account Name', value: inv.vendor.bankAccountName }
            ].map(({ label, value }) => (
              <div key={label}>
                <div className='text-xs text-muted-foreground'>{label}</div>
                <div className='font-semibold text-foreground'>
                  {value ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAlreadySubmitted && (
        <div className='bg-card border border-border rounded-2xl px-6 py-5 space-y-4'>
          <h2 className='font-bold text-foreground text-sm'>Payment Details</h2>

          <div>
            <label className='block text-sm font-bold text-foreground mb-1.5'>
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-bold text-foreground mb-1.5'>
              Transaction Reference <span className='text-red-500'>*</span>
            </label>
            <input
              value={transactionRef}
              onChange={e => setTransactionRef(e.target.value)}
              placeholder='Bank confirmation / cheque number / RTGS ref'
              className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
            />
          </div>

          <div>
            <label className='block text-sm font-bold text-foreground mb-1.5'>
              Payment Date & Time <span className='text-red-500'>*</span>
            </label>
            <input
              type='datetime-local'
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
              className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
            />
          </div>

          <div>
            <label className='block text-sm font-bold text-foreground mb-1.5'>
              Proof of Payment{' '}
              <span className='text-muted-foreground font-normal'>
                (optional — PDF, image, etc.)
              </span>
            </label>

            {uploadedFileName ? (
              <div className='flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-sm'>
                <CheckCircle
                  size={16}
                  className='text-green-600 dark:text-green-400 flex-shrink-0'
                />
                <span className='text-green-700 dark:text-green-400 font-semibold'>
                  {uploadedFileName}
                </span>
                <button
                  type='button'
                  onClick={() => {
                    setUploadedFileName('')
                    uploadedProofIdRef.current = null
                    setProofFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className='ml-auto text-muted-foreground hover:text-red-500'
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className='flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-[#FFB800] transition-colors'
              >
                {uploading ? (
                  <Loader2 size={24} className='animate-spin text-[#FFB800]' />
                ) : (
                  <Upload size={24} className='text-muted-foreground' />
                )}
                <p className='text-sm text-muted-foreground'>
                  {uploading
                    ? 'Uploading…'
                    : 'Click to upload (any file type accepted)'}
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type='file'
              className='hidden'
              accept='*/*'
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setProofFile(file)
                await handleUpload(file)
              }}
            />

            {uploadError && (
              <p className='text-xs text-red-600 dark:text-red-400 mt-1.5'>
                {uploadError}
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-bold text-foreground mb-1.5'>
              Notes{' '}
              <span className='text-muted-foreground font-normal'>
                (optional)
              </span>
            </label>
            <textarea
              rows={2}
              value={tellerNotes}
              onChange={e => setTellerNotes(e.target.value)}
              placeholder='Any notes for the approver…'
              className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] resize-none'
            />
          </div>

          {submitError && (
            <div className='px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
              {submitError}
            </div>
          )}

          <button
            type='submit'
            disabled={submitting || uploading || !transactionRef.trim()}
            className='w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#FFB800] hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#1B2A8A] font-extrabold text-sm transition-colors'
          >
            {submitting ? (
              <>
                <Loader2 size={16} className='animate-spin' /> Submitting…
              </>
            ) : (
              'Submit Payment for Approval →'
            )}
          </button>
        </div>
      )}
    </form>
  )
}
