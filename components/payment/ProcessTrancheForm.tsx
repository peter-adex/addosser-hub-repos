'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud, CheckCircle2 } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' }
]

export default function ProcessTrancheForm ({
  trancheId,
  defaultBankName,
  defaultBankAccountNo,
  defaultBankAccountName
}: {
  trancheId: string
  defaultBankName: string
  defaultBankAccountNo: string
  defaultBankAccountName: string
}) {
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [bankName, setBankName] = useState(defaultBankName)
  const [bankAccountNo, setBankAccountNo] = useState(defaultBankAccountNo)
  const [bankAccountName, setBankAccountName] = useState(defaultBankAccountName)
  const [transactionRef, setTransactionRef] = useState('')
  const [tellerNotes, setTellerNotes] = useState('')
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange (e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('trancheId', trancheId)
      const res = await fetch('/api/payment/proof-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.fileUrl) throw new Error(data.error ?? 'Upload failed')
      setProofUrl(data.fileUrl)
    } catch (err: any) {
      setError(err.message ?? 'Failed to upload proof of payment')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!transactionRef.trim())
      return setError('Enter the transaction/transfer reference.')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/payment/tranches/${trancheId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          bankName: bankName || undefined,
          bankAccountNo: bankAccountNo || undefined,
          bankAccountName: bankAccountName || undefined,
          transactionRef: transactionRef.trim(),
          proofOfPaymentUrl: proofUrl ?? undefined,
          tellerNotes: tellerNotes.trim() || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit payment')
      router.push('/payment/my-tasks')
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className='bg-card border border-border rounded-2xl p-6 space-y-5'
    >
      <div>
        <label className='text-sm font-semibold text-foreground mb-2 block'>
          Payment Method
        </label>
        <div className='grid grid-cols-3 sm:grid-cols-5 gap-2'>
          {PAYMENT_METHODS.map(m => (
            <button
              type='button'
              key={m.value}
              onClick={() => setPaymentMethod(m.value)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                paymentMethod === m.value
                  ? 'border-[#FFB800] bg-[#FFB800]/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-[#1B2A8A]/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className='grid sm:grid-cols-2 gap-4'>
        <div>
          <label className='text-xs font-semibold text-muted-foreground mb-1.5 block'>
            Bank Name
          </label>
          <input
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            className='w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
        </div>
        <div>
          <label className='text-xs font-semibold text-muted-foreground mb-1.5 block'>
            Account Number
          </label>
          <input
            value={bankAccountNo}
            onChange={e => setBankAccountNo(e.target.value)}
            className='w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
        </div>
        <div className='sm:col-span-2'>
          <label className='text-xs font-semibold text-muted-foreground mb-1.5 block'>
            Account Name
          </label>
          <input
            value={bankAccountName}
            onChange={e => setBankAccountName(e.target.value)}
            className='w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
        </div>
      </div>

      <div>
        <label className='text-sm font-semibold text-foreground mb-2 block'>
          Transaction Reference
        </label>
        <input
          value={transactionRef}
          onChange={e => setTransactionRef(e.target.value)}
          placeholder='Bank transfer / RTGS reference number'
          className='w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#FFB800]'
        />
      </div>

      <div>
        <label className='text-sm font-semibold text-foreground mb-2 block'>
          Proof of Payment
        </label>
        <label className='flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:border-[#FFB800] transition-colors'>
          <input
            type='file'
            accept='image/*,.pdf'
            className='hidden'
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <span className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 size={16} className='animate-spin' /> Uploading…
            </span>
          ) : proofUrl ? (
            <span className='flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-semibold'>
              <CheckCircle2 size={16} /> Proof uploaded
            </span>
          ) : (
            <span className='flex items-center gap-2 text-sm text-muted-foreground'>
              <UploadCloud size={16} /> Click to upload transfer receipt
            </span>
          )}
        </label>
      </div>

      <div>
        <label className='text-sm font-semibold text-foreground mb-2 block'>
          Notes (optional)
        </label>
        <textarea
          value={tellerNotes}
          onChange={e => setTellerNotes(e.target.value)}
          rows={2}
          className='w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#FFB800]'
        />
      </div>

      {error && (
        <div className='text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3'>
          {error}
        </div>
      )}

      <button
        type='submit'
        disabled={submitting || uploading}
        className='w-full bg-[#1B2A8A] hover:bg-[#121E6B] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2'
      >
        {submitting && <Loader2 size={16} className='animate-spin' />}
        Submit for Approval
      </button>
    </form>
  )
}
