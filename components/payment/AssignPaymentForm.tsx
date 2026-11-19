'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { genId } from '@/lib/utils'
import PaymentBreakdown from './PaymentBreakdown'
import {
  Plus,
  Trash2,
  User,
  Loader2,
  Percent,
  Hash,
  ChevronDown,
  AlertCircle
} from 'lucide-react'

function naira (v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '₦0.00'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return '₦0.00'
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n)}`
}

interface Teller {
  id: string
  name: string
  email: string
}

interface InvoiceFinancials {
  subtotal: string
  vatRate: string
  vatAmount: string
  whtRate: string
  whtAmount: string
  amountPayable: string
}

interface TrancheRow {
  id: string
  label: string
  mode: 'PERCENTAGE' | 'AMOUNT'
  inputValue: string
  computedAmount: number
}

interface Props {
  invoiceId: string
  invoiceNo: string
  vendorName: string
  financials: InvoiceFinancials
  tellers: Teller[]
  onSuccess?: () => void
}

export default function AssignPaymentForm ({
  invoiceId,
  invoiceNo,
  vendorName,
  financials,
  tellers,
  onSuccess
}: Props) {
  const router = useRouter()

  if (!financials || !financials.amountPayable) {
    return (
      <div
        className='flex items-center gap-3 px-5 py-6 bg-amber-50
                      dark:bg-amber-950/20 border border-amber-200
                      dark:border-amber-800 rounded-2xl text-sm'
      >
        <AlertCircle
          size={20}
          className='text-amber-600 dark:text-amber-400 flex-shrink-0'
        />
        <div>
          <p className='font-bold text-amber-800 dark:text-amber-300'>
            Invoice financial data unavailable
          </p>
          <p className='text-amber-700 dark:text-amber-400 mt-0.5'>
            Could not load the invoice amounts. Please refresh the page.
          </p>
        </div>
      </div>
    )
  }

  const totalPayable = Math.round(parseFloat(financials.amountPayable))

  if (totalPayable <= 0) {
    return (
      <div
        className='flex items-center gap-3 px-5 py-6 bg-red-50
                      dark:bg-red-950/20 border border-red-200
                      dark:border-red-800 rounded-2xl text-sm'
      >
        <AlertCircle size={20} className='text-red-500 flex-shrink-0' />
        <p className='text-red-700 dark:text-red-400'>
          Invoice amount payable is zero — cannot assign a payment.
        </p>
      </div>
    )
  }

  const [tellerId, setTellerId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [isSplit, setIsSplit] = useState(false)
  const [tranches, setTranches] = useState<TrancheRow[]>([
    {
      id: genId(),
      label: 'Full payment',
      mode: 'AMOUNT',
      inputValue: String(totalPayable),
      computedAmount: totalPayable
    }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deriveAmount = useCallback(
    (row: TrancheRow): number => {
      const raw = row.inputValue.replace(/[^\d]/g, '')
      const n = parseInt(raw, 10)
      if (isNaN(n) || n <= 0) return 0
      if (row.mode === 'PERCENTAGE') return Math.floor((n / 100) * totalPayable)
      return n
    },
    [totalPayable]
  )

  const trancheAmounts = tranches.map(t => ({
    ...t,
    computedAmount: deriveAmount(t)
  }))

  const totalAssigned = trancheAmounts.reduce((s, t) => s + t.computedAmount, 0)
  const balance = totalPayable - totalAssigned
  const isBalanced = balance === 0

  function handleSplitToggle (split: boolean) {
    setIsSplit(split)
    if (!split) {
      setTranches([
        {
          id: genId(),
          label: 'Full payment',
          mode: 'AMOUNT',
          inputValue: String(totalPayable),
          computedAmount: totalPayable
        }
      ])
    } else {
      const half = Math.floor(totalPayable / 2)
      const remainder = totalPayable - half
      setTranches([
        {
          id: genId(),
          label: 'First payment',
          mode: 'AMOUNT',
          inputValue: String(half),
          computedAmount: half
        },
        {
          id: genId(),
          label: 'Balance payment',
          mode: 'AMOUNT',
          inputValue: String(remainder),
          computedAmount: remainder
        }
      ])
    }
  }

  function addTranche () {
    if (tranches.length >= 6) return
    setTranches(p => [
      ...p,
      {
        id: genId(),
        label: `Tranche ${p.length + 1}`,
        mode: 'AMOUNT',
        inputValue: '0',
        computedAmount: 0
      }
    ])
  }

  function removeTranche (id: string) {
    if (tranches.length <= 2) return
    setTranches(p => p.filter(t => t.id !== id))
  }

  function updateTranche (id: string, patch: Partial<TrancheRow>) {
    setTranches(p => p.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  function handleAmountInput (id: string, raw: string) {
    updateTranche(id, { inputValue: raw.replace(/[^\d]/g, '') })
  }

  function validate (): string | null {
    if (!tellerId) return 'Please select a Teller.'
    if (trancheAmounts.some(t => t.computedAmount <= 0))
      return 'Each tranche must be greater than zero.'
    if (!isBalanced)
      return `Tranches total ${naira(totalAssigned)} — must equal ${naira(
        totalPayable
      )}. Remaining: ${naira(balance)}.`
    return null
  }

  async function handleSubmit () {
    const err = validate()
    if (err) {
      setError(err)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payment/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          tellerId,
          instructions: instructions.trim() || null,
          tranches: trancheAmounts.map((t, i) => ({
            label: t.label.trim() || `Tranche ${i + 1}`,
            amount: t.computedAmount,
            percentage:
              t.mode === 'PERCENTAGE' ? parseInt(t.inputValue, 10) : null
          }))
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Assignment failed')

      onSuccess?.()
      router.push('/payment')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <PaymentBreakdown
        subtotal={financials.subtotal}
        vatRate={financials.vatRate}
        vatAmount={financials.vatAmount}
        whtRate={financials.whtRate}
        whtAmount={financials.whtAmount}
        amountPayable={financials.amountPayable}
        isSplit={isSplit}
      />

      <div className='flex items-center gap-4 px-5 py-3 bg-muted/30 border border-border rounded-xl text-sm flex-wrap'>
        <span className='text-muted-foreground'>Invoice:</span>
        <code className='font-bold text-[#1B2A8A] dark:text-blue-300'>
          {invoiceNo}
        </code>
        <span className='text-muted-foreground hidden sm:block'>·</span>
        <span className='text-muted-foreground'>Vendor:</span>
        <span className='font-semibold text-foreground'>{vendorName}</span>
      </div>

      <div>
        <label className='block text-sm font-bold text-foreground mb-2'>
          Assign to Teller <span className='text-red-500'>*</span>
        </label>
        <div className='relative'>
          <User
            size={16}
            className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
          <select
            value={tellerId}
            onChange={e => setTellerId(e.target.value)}
            className='w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] appearance-none transition'
          >
            <option value=''>Select a Teller…</option>
            {tellers.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className='absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
        </div>
      </div>

      <div>
        <label className='block text-sm font-bold text-foreground mb-2'>
          Payment Type
        </label>
        <div className='flex gap-3'>
          {[
            { value: false, label: 'Full Payment', emoji: '💯' },
            { value: true, label: 'Split / Tranche', emoji: '🔀' }
          ].map(({ value, label, emoji }) => (
            <button
              key={String(value)}
              type='button'
              onClick={() => handleSplitToggle(value)}
              className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                isSplit === value
                  ? 'bg-[#1B2A8A] border-[#1B2A8A] text-white'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <span>{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className='flex items-center justify-between mb-3'>
          <label className='text-sm font-bold text-foreground'>
            {isSplit ? 'Payment Tranches' : 'Payment Amount'}
          </label>
          {isSplit && (
            <button
              type='button'
              onClick={addTranche}
              disabled={tranches.length >= 6}
              className='flex items-center gap-1.5 text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline disabled:opacity-40'
            >
              <Plus size={13} /> Add Tranche
            </button>
          )}
        </div>

        <div className='space-y-3'>
          {tranches.map((tranche, index) => {
            const computed = trancheAmounts[index]?.computedAmount ?? 0
            const hasError = tranche.inputValue !== '' && computed <= 0
            return (
              <div
                key={tranche.id}
                className='border border-border rounded-xl overflow-hidden'
              >
                <div className='flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border'>
                  <div className='w-6 h-6 rounded-full bg-[#1B2A8A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0'>
                    {index + 1}
                  </div>
                  <input
                    type='text'
                    value={tranche.label}
                    onChange={e =>
                      updateTranche(tranche.id, { label: e.target.value })
                    }
                    placeholder={`Tranche ${index + 1} label`}
                    className='flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none'
                  />
                  {isSplit && tranches.length > 2 && (
                    <button
                      type='button'
                      onClick={() => removeTranche(tranche.id)}
                      className='text-muted-foreground hover:text-red-500 transition-colors'
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className='px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center'>
                  <div className='flex gap-1 bg-muted rounded-lg p-0.5'>
                    {(['PERCENTAGE', 'AMOUNT'] as const).map(mode => (
                      <button
                        key={mode}
                        type='button'
                        onClick={() =>
                          updateTranche(tranche.id, { mode, inputValue: '' })
                        }
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                          tranche.mode === mode
                            ? 'bg-card shadow text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {mode === 'PERCENTAGE' ? (
                          <Percent size={11} />
                        ) : (
                          <Hash size={11} />
                        )}
                        {mode === 'PERCENTAGE' ? '%' : '₦'}
                      </button>
                    ))}
                  </div>

                  <div className='relative'>
                    {tranche.mode === 'AMOUNT' && (
                      <span className='absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none'>
                        ₦
                      </span>
                    )}
                    <input
                      type='text'
                      inputMode='numeric'
                      pattern='[0-9]*'
                      value={tranche.inputValue}
                      onChange={e =>
                        handleAmountInput(tranche.id, e.target.value)
                      }
                      placeholder={
                        tranche.mode === 'PERCENTAGE'
                          ? 'e.g. 50 (for 50%)'
                          : 'e.g. 500000'
                      }
                      className={`w-full ${
                        tranche.mode === 'AMOUNT' ? 'pl-6' : 'pl-3'
                      } pr-3 py-2.5 rounded-xl border text-sm font-mono bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition ${
                        hasError
                          ? 'border-red-400 focus:ring-red-400'
                          : 'border-border'
                      }`}
                    />
                    {tranche.mode === 'PERCENTAGE' && (
                      <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none'>
                        %
                      </span>
                    )}
                  </div>

                  <div className='text-right min-w-[120px]'>
                    <div
                      className={`text-sm font-bold font-mono ${
                        computed > 0
                          ? 'text-[#FFB800]'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {naira(computed)}
                    </div>
                    {tranche.mode === 'PERCENTAGE' &&
                      tranche.inputValue !== '' && (
                        <div className='text-xs text-muted-foreground'>
                          = {parseInt(tranche.inputValue, 10) || 0}% of total
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {isSplit && (
          <div
            className={`mt-3 px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-between ${
              isBalanced
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400'
                : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400'
            }`}
          >
            <span>
              {isBalanced
                ? '✅ Tranches balance — ready to assign'
                : `Remaining: ${naira(balance)}`}
            </span>
            <span className='font-mono'>
              {naira(totalAssigned)} / {naira(totalPayable)}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className='block text-sm font-bold text-foreground mb-2'>
          Instructions{' '}
          <span className='text-muted-foreground font-normal'>(optional)</span>
        </label>
        <textarea
          rows={3}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder='Any specific instructions for the Teller…'
          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] resize-none transition'
        />
      </div>

      <div className='px-4 py-3 bg-muted/30 rounded-xl border border-border'>
        <p className='text-xs text-muted-foreground leading-relaxed'>
          <strong>Note:</strong> Only whole number amounts are accepted (e.g.{' '}
          <code className='bg-muted px-1 rounded text-foreground'>500000</code>{' '}
          ✓ — no decimals). Percentages are floored to the nearest whole Naira.
        </p>
      </div>

      {error && (
        <div className='px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl'>
          <p className='text-sm text-red-700 dark:text-red-400'>{error}</p>
        </div>
      )}

      <button
        type='button'
        onClick={handleSubmit}
        disabled={loading || !isBalanced || !tellerId}
        className='w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#FFB800] hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#1B2A8A] font-extrabold text-sm transition-colors'
      >
        {loading ? (
          <>
            <Loader2 size={16} className='animate-spin' /> Assigning…
          </>
        ) : (
          <>Assign Payment to Teller →</>
        )}
      </button>
    </div>
  )
}
