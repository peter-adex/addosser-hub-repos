'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  Banknote,
  FileText,
  Eye,
  Search,
  Trash2,
  Loader2,
  ShieldAlert,
  BadgeCheck,
  ArrowUpCircle,
  Wallet,
  ListOrdered
} from 'lucide-react'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitCost: number
  totalCost: number
}

interface Invoice {
  id: string
  invoiceNo: string
  vendorName: string
  status: string
  approvalStatus: string | null
  subtotal: number | string
  vatAmount: number | string
  whtAmount: number | string
  totalAmount: number | string
  amountPayable: number | string
  glAccountCode: string | null
  glAccount?: {
    id: string
    code: string
    name: string
  } | null
  isBudgetExceeded: boolean
  isExceptionalApproval: boolean
  recalledAt: string | null
  description: string | null
  dueDate: string | null
  createdAt: string
  entity: { name: string; code: string }
  submittedBy: { name: string; email: string }
  vendor: { name: string } | null
  lineItems: LineItem[]
  submittedById?: string
  noStepActioned?: boolean
}

interface Props {
  initialInvoices: Invoice[]
  currentUserId: string
  canApprove: boolean
}

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: 'Draft',
    color: '#6b7280',
    bg: '#f3f4f6',
    icon: <FileText size={12} />
  },

  PENDING: {
    label: 'Pending Approval',
    color: '#d97706',
    bg: '#fef9c3',
    icon: <Clock size={12} />
  },

  UNDER_REVIEW: {
    label: 'Under Review',
    color: '#0891b2',
    bg: '#cffafe',
    icon: <Search size={12} />
  },

  IN_PROGRESS: {
    label: 'In Progress',
    color: '#0284c7',
    bg: '#e0f2fe',
    icon: <Clock size={12} />
  },

  APPROVED: {
    label: 'Approved',
    color: '#16a34a',
    bg: '#dcfce7',
    icon: <CheckCircle2 size={12} />
  },

  PAYMENT_QUEUED: {
    label: 'Payment Queued',
    color: '#0f766e',
    bg: '#ccfbf1',
    icon: <ListOrdered size={12} />
  },

  PAYMENT_PROCESSING: {
    label: 'Payment Processing',
    color: '#2563eb',
    bg: '#dbeafe',
    icon: <Banknote size={12} />
  },

  PARTIALLY_PAID: {
    label: 'Partially Paid',
    color: '#7c3aed',
    bg: '#ede9fe',
    icon: <Wallet size={12} />
  },

  PAID: {
    label: 'Paid',
    color: '#15803d',
    bg: '#bbf7d0',
    icon: <BadgeCheck size={12} />
  },

  PAYMENT_ESCALATED: {
    label: 'Payment Escalated',
    color: '#ea580c',
    bg: '#ffedd5',
    icon: <ArrowUpCircle size={12} />
  },

  REJECTED: {
    label: 'Rejected',
    color: '#dc2626',
    bg: '#fee2e2',
    icon: <XCircle size={12} />
  },

  RECALLED: {
    label: 'Recalled',
    color: '#9ca3af',
    bg: '#f9fafb',
    icon: <RotateCcw size={12} />
  },

  OVERDUE: {
    label: 'Overdue',
    color: '#b91c1c',
    bg: '#fecaca',
    icon: <AlertTriangle size={12} />
  },

  EXCEPTIONAL: {
    label: 'Exceptional Approval',
    color: '#c2410c',
    bg: '#fed7aa',
    icon: <ShieldAlert size={12} />
  }
}
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PAYMENT_QUEUED', label: 'Payment Queued' },
  { key: 'PAYMENT_PROCESSING', label: 'Payment Processing' },
  { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PAYMENT_ESCALATED', label: 'Payment Escalated' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'RECALLED', label: 'Recalled' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'EXCEPTIONAL', label: 'Exceptional' }
]
const fmtNGN = (n: number | string) =>
  '₦' +
  Number(n).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function InvoiceListClient ({
  initialInvoices,
  currentUserId
}: Props) {
  const router = useRouter()

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [activeStatus, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<{ id: string; op: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [recallModal, setRecallModal] = useState<{
    id: string
    invoiceNo: string
  } | null>(null)
  const [recallReason, setRecallReason] = useState('')

  useEffect(() => {
    setInvoices(initialInvoices)
  }, [initialInvoices])

  useEffect(() => {
    const es = new EventSource('/api/sse/invoices')

    es.onmessage = async event => {
      try {
        if (!event.data || event.data.startsWith(':')) return

        console.log(
          '🔄 Live Invoice Update Signal Received! Fetching current dataset live...'
        )

        const res = await fetch('/api/invoices/query?t=' + Date.now())
        if (res.ok) {
          const payload = await res.json()
          if (payload.success && payload.data) {
            setInvoices(payload.data)
          }
        }
      } catch (err) {
        console.error('SSE data parsing challenge encountered:', err)
      }
    }

    es.onerror = err => {
      console.warn(
        '⚠️ Invoice SSE lost link alignment. Retrying natively...',
        err
      )
    }

    return () => {
      es.close()
    }
  }, [router])

  const canRecall = (inv: Invoice): boolean => {
    if (inv.status !== 'PENDING') return false
    if (['APPROVED', 'PAID', 'REJECTED'].includes(inv.status)) return false
    if (inv.submittedById !== currentUserId) return false
    return inv.noStepActioned !== false
  }

  const handleRecall = useCallback(async () => {
    if (!recallModal) return
    if (!recallReason.trim()) {
      setErrors(p => ({ ...p, [recallModal.id]: 'Please provide a reason.' }))
      return
    }
    const { id, invoiceNo } = recallModal
    setBusy({ id, op: 'Recalling invoice…' })
    setErrors(p => ({ ...p, [id]: '' }))

    try {
      const res = await fetch(`/api/invoices/${id}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: recallReason.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Recall failed')

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === id
            ? { ...inv, status: 'RECALLED', noStepActioned: true }
            : inv
        )
      )
      setRecallModal(null)
      setRecallReason('')
      router.refresh()
    } catch (err: any) {
      setErrors(p => ({ ...p, [id]: err.message }))
    } finally {
      setBusy(null)
    }
  }, [recallModal, recallReason, router])

  const handleDelete = useCallback(
    async (invoiceId: string, invoiceNo: string) => {
      if (
        !confirm(
          `Delete invoice "${invoiceNo}" permanently? This cannot be undone.`
        )
      )
        return
      setBusy({ id: invoiceId, op: 'Deleting invoice…' })

      try {
        const res = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'DELETE'
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Delete failed')
        setInvoices(prev => prev.filter(i => i.id !== invoiceId))
      } catch (err: any) {
        setErrors(p => ({ ...p, [invoiceId]: err.message }))
      } finally {
        setBusy(null)
      }
    },
    []
  )

  const filtered = invoices.filter(inv => {
    const matchStatus = !activeStatus || inv.status === activeStatus
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.vendorName.toLowerCase().includes(q) ||
      (inv.description ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <>
      {busy && (
        <div className='fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm'>
          <div className='bg-card border border-border rounded-2xl px-10 py-8 flex flex-col items-center gap-4 shadow-2xl'>
            <Loader2 size={40} className='text-[#FFB800] animate-spin' />
            <p className='font-semibold text-foreground text-sm'>{busy.op}</p>
            <p className='text-xs text-muted-foreground'>Please wait…</p>
          </div>
        </div>
      )}

      <div className='space-y-4'>
        <div className='flex flex-col sm:flex-row gap-3'>
          <div className='relative'>
            <Search
              size={14}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
            />
            <input
              type='text'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Search by ID, vendor, description…'
              className='pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] w-72'
            />
          </div>
          <div className='flex gap-1 p-1 bg-card border border-border rounded-xl overflow-x-auto'>
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeStatus === t.key
                    ? 'bg-[#1B2A8A] text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-6 py-4 border-b border-border flex items-center justify-between'>
            <span className='font-bold text-foreground'>Invoices</span>
            <span className='text-xs text-muted-foreground'>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className='py-16 text-center text-muted-foreground'>
              <div className='text-4xl mb-3'>🧾</div>
              <div className='font-semibold'>No invoices found</div>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full border-collapse'>
                <thead>
                  <tr className='bg-muted/40'>
                    {[
                      'Invoice ID',
                      'Type',
                      'Vendor',
                      'Entity',
                      'Description',
                      'Subtotal',
                      'Payable',
                      'Status',
                      'Date',
                      'Submitted By',
                      'Actions'
                    ].map(h => (
                      <th
                        key={h}
                        className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const meta = STATUS_META[inv.status] ?? STATUS_META['DRAFT']
                    const showRecall = canRecall(inv)
                    const showDelete =
                      ['DRAFT', 'RECALLED'].includes(inv.status) &&
                      inv.submittedById === currentUserId

                    return (
                      <tr
                        key={inv.id}
                        className='border-t border-border hover:bg-accent/30 transition-colors'
                      >
                        <td className='px-4 py-3.5'>
                          <div className='flex items-center gap-1.5 flex-wrap'>
                            <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                              {inv.invoiceNo}
                            </code>
                            {inv.isBudgetExceeded && (
                              <span title='Budget Exceeded'>
                                <AlertTriangle
                                  size={12}
                                  className='text-amber-500'
                                />
                              </span>
                            )}
                            {inv.isExceptionalApproval && (
                              <span className='text-[9px] font-extrabold px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'>
                                EXCEPTIONAL
                              </span>
                            )}
                          </div>
                        </td>

                        <td className='px-4 py-3.5 text-xs whitespace-nowrap'>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${INVOICE_TYPE_BADGE_CLASS[(inv as any).invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
                            {(inv as any).invoiceType ? invoiceTypeLabel((inv as any).invoiceType) : '—'}
                          </span>
                        </td>

                        <td className='px-4 py-3.5 text-sm font-medium text-foreground max-w-[140px] truncate'>
                          {inv.vendor?.name ?? inv.vendorName}
                        </td>

                        <td className='px-4 py-3.5 text-xs text-muted-foreground'>
                          {inv.entity.code}
                        </td>

                        <td className='px-4 py-3.5 text-sm font-medium text-foreground max-w-[140px] truncate'>
                          {inv.description}
                        </td>

                        <td className='px-4 py-3.5 text-sm text-foreground font-medium tabular-nums'>
                          {fmtNGN(inv.subtotal)}
                        </td>
                        <td
                          className='px-4 py-3.5 text-sm font-bold tabular-nums'
                          style={{ color: '#FFB800' }}
                        >
                          {fmtNGN(inv.amountPayable)}
                        </td>

                        <td className='px-4 py-3.5'>
                          <span
                            className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap'
                            style={{
                              color: meta.color,
                              background: meta.bg,
                              borderColor: meta.color + '40'
                            }}
                          >
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className='px-4 py-3.5 text-xs font-medium text-muted-foreground whitespace-nowrap'>
                          {inv.createdAt
                            ? new Date(inv.createdAt).toLocaleDateString(
                                'en-NG',
                                {
                                  dateStyle: 'medium'
                                }
                              )
                            : '—'}
                        </td>
                        <td className='px-4 py-3.5 text-xs text-muted-foreground'>
                          {inv.submittedBy.name}
                        </td>

                        <td className='px-4 py-3.5'>
                          <div className='flex items-center gap-1.5'>
                            <Link
                              href={`/invoice/${inv.id}`}
                              className='p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground'
                              title='View details'
                            >
                              <Eye size={14} />
                            </Link>

                            {showRecall && (
                              <button
                                onClick={() => {
                                  setRecallModal({
                                    id: inv.id,
                                    invoiceNo: inv.invoiceNo
                                  })
                                  setRecallReason('')
                                }}
                                className='flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 transition-all'
                                title='Recall invoice back to Draft'
                              >
                                <RotateCcw size={12} /> Recall
                              </button>
                            )}

                            {showDelete && (
                              <button
                                onClick={() =>
                                  handleDelete(inv.id, inv.invoiceNo)
                                }
                                className='p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600 transition-colors'
                                title='Delete invoice permanently'
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {errors[inv.id] && (
                            <p className='text-xs text-red-600 dark:text-red-400 mt-1 font-medium'>
                              {errors[inv.id]}
                            </p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {recallModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div className='bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0'>
                <RotateCcw
                  size={20}
                  className='text-amber-600 dark:text-amber-400'
                />
              </div>
              <div>
                <h3 className='font-bold text-foreground'>Recall Invoice</h3>
                <p className='text-xs text-muted-foreground'>
                  {recallModal.invoiceNo} → returns to Draft
                </p>
              </div>
            </div>

            <p className='text-sm text-muted-foreground mb-5'>
              Once recalled, the invoice returns to{' '}
              <strong className='text-foreground'>Draft</strong> status. You can
              edit and resubmit it. This action is only available while no
              approver has acted.
            </p>

            <div className='mb-5'>
              <label className='block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'>
                Reason for Recall <span className='text-red-500'>*</span>
              </label>
              <textarea
                className='w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
                rows={3}
                value={recallReason}
                onChange={e => setRecallReason(e.target.value)}
                placeholder='e.g. Wrong vendor selected, need to correct the amount…'
                autoFocus
              />
            </div>

            {errors[recallModal.id] && (
              <p className='text-xs text-red-600 dark:text-red-400 font-medium mb-3'>
                ⚠️ {errors[recallModal.id]}
              </p>
            )}

            <div className='flex gap-3'>
              <button
                onClick={handleRecall}
                className='flex-1 py-2.5 rounded-xl font-bold text-sm transition-all'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                Confirm Recall
              </button>
              <button
                onClick={() => setRecallModal(null)}
                className='flex-1 py-2.5 rounded-xl font-bold text-sm border border-border text-muted-foreground hover:bg-accent transition-all'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
