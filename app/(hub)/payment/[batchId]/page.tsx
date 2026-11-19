'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  ChevronDown
} from 'lucide-react'
import { usePaymentCaps } from '@/hooks/usePaymentCaps'
import { buildDownloadUrl } from '@/lib/download'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

function naira (v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '₦0.00'
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(n)) return '₦0.00'
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function fmtDate (d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchJSON (url: string, opts?: RequestInit) {
  const res = await fetch(url, opts)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    throw new Error(`Server error (${res.status})`)
  }
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`)
  return d
}

const BADGE: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  SUBMITTED:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ASSIGNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  COMPLETED:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

function Badge ({ status }: { status: string }) {
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
        BADGE[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

interface LineItem {
  id: string
  description: string
  quantity: string
  unitCost: string
  totalCost: string
}

interface Proof {
  id: string
  fileName: string
  fileUrl: string
  fileType: string
  uploadedAt: string
}

interface ApprovalRecord {
  id: string
  approvedBy: { name: string }
  roleName: string
  action: 'APPROVED' | 'REJECTED'
  comment: string | null
  isDecisive: boolean
  createdAt: string
}

interface Tranche {
  id: string
  trancheNumber: number
  label: string | null
  plannedAmount: string
  plannedPercentage: string | null
  status: string
  paymentMethod: string | null
  transactionRef: string | null
  tellerNotes: string | null
  submittedAt: string | null
  paidAt: string | null
  rejectionReason: string | null
  processedBy: { name: string } | null
  proofs: Proof[]
  approvals: ApprovalRecord[]
}

interface BatchDetail {
  id: string
  status: string
  totalAmount: string
  amountDisbursed: string
  isSplitPayment: boolean
  instructions: string | null
  assignedAt: string
  assignedBy: { name: string; email: string }
  teller: { name: string; email: string }
  invoice: {
    id: string
    invoiceNo: string
    status: string
    approvalStatus: string | null
    invoiceType: string
    vendorName: string
    vendorEmail: string | null
    description: string | null
    glAccountCode: string
    glAccount: { code: string; name: string } | null
    subtotal: string
    vatRate: string
    vatAmount: string
    whtRate: string
    whtAmount: string
    totalAmount: string
    amountPayable: string
    vendor: {
      name: string
      email: string | null
      bankName: string | null
      bankAccountNo: string | null
      bankAccountName: string | null
      taxId: string | null
    } | null
    entity: { name: string; code: string }
    lineItems: LineItem[]
  }
  tranches: Tranche[]
}

function ApprovalModal ({
  tranche,
  action,
  onClose,
  onDone
}: {
  tranche: Tranche
  action: 'APPROVED' | 'REJECTED'
  onClose: () => void
  onDone: () => void
}) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isReject = action === 'REJECTED'

  async function submit () {
    if (isReject && !comment.trim()) {
      setError('Please provide a reason for rejection.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await fetchJSON(`/api/payment/tranches/${tranche.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || undefined })
      })
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
      <div className='bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl'>
        <div className='flex items-center gap-3'>
          {isReject ? (
            <XCircle size={24} className='text-red-500 flex-shrink-0' />
          ) : (
            <CheckCircle2 size={24} className='text-green-500 flex-shrink-0' />
          )}
          <h2 className='font-bold text-foreground text-lg'>
            {isReject ? 'Reject Payment' : 'Approve Payment'}
          </h2>
        </div>

        <div className='px-4 py-3 bg-muted/30 rounded-xl text-sm'>
          <p className='font-semibold text-foreground'>
            {tranche.label ?? `Tranche ${tranche.trancheNumber}`}
          </p>
          <p className='text-muted-foreground mt-0.5'>
            Amount: <strong>{naira(tranche.plannedAmount)}</strong>
            {tranche.transactionRef && (
              <>
                {' '}
                · Ref: <strong>{tranche.transactionRef}</strong>
              </>
            )}
          </p>
        </div>

        <div>
          <label className='block text-sm font-bold text-foreground mb-1.5'>
            {isReject ? 'Rejection Reason' : 'Comment'}{' '}
            {isReject && <span className='text-red-500'>*</span>}
            {!isReject && (
              <span className='text-muted-foreground font-normal'>
                (optional)
              </span>
            )}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={
              isReject
                ? 'State the reason for rejection — Teller will see this…'
                : 'Any comment for the audit record…'
            }
            className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] resize-none'
          />
        </div>

        {error && (
          <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
        )}

        <div className='flex gap-3'>
          <button
            onClick={submit}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-sm disabled:opacity-50 transition-colors ${
              isReject
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#FFB800] hover:bg-yellow-500 text-[#1B2A8A]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className='animate-spin' /> Processing…
              </>
            ) : isReject ? (
              'Confirm Reject'
            ) : (
              'Confirm Approve'
            )}
          </button>
          <button
            onClick={onClose}
            className='px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent'
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BatchDetailPage () {
  const { batchId } = useParams<{ batchId: string }>()
  const router = useRouter()
  const caps = usePaymentCaps()
  const perms = { canApprove: caps.approve }

  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modal, setModal] = useState<{
    tranche: Tranche
    action: 'APPROVED' | 'REJECTED'
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await fetchJSON(`/api/payment/${batchId}`)
      setBatch(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64 text-muted-foreground gap-2'>
        <Loader2 size={18} className='animate-spin' /> Loading…
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className='flex flex-col items-center gap-3 py-20 text-center'>
        <AlertCircle size={40} className='text-red-500' />
        <p className='font-bold text-foreground'>Could not load payment</p>
        <p className='text-sm text-muted-foreground'>{error}</p>
        <button
          onClick={() => router.back()}
          className='text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline'
        >
          ← Go back
        </button>
      </div>
    )
  }

  const inv = batch.invoice
  const vatPct = (parseFloat(inv.vatRate) * 100).toFixed(1)
  const whtPct = (parseFloat(inv.whtRate) * 100).toFixed(1)
  const glDisplay = inv.glAccount
    ? `${inv.glAccount.code} — ${inv.glAccount.name}`
    : inv.glAccountCode

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <div className='flex items-center gap-2 mb-1'>
            <Link
              href='/payment/approvals'
              className='text-xs text-muted-foreground hover:underline'
            >
              ← Approvals
            </Link>
          </div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Payment Review
          </h1>
          <p className='text-sm text-muted-foreground mt-0.5'>
            <code className='font-bold text-[#1B2A8A] dark:text-blue-300'>
              {inv.invoiceNo}
            </code>{' '}
            · {inv.entity.name}
          </p>
          <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${INVOICE_TYPE_BADGE_CLASS[inv.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
            {invoiceTypeLabel(inv.invoiceType)}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Badge status={batch.status} />
          <button
            onClick={load}
            className='p-2 rounded-lg border border-border hover:bg-accent text-muted-foreground'
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className='grid md:grid-cols-2 gap-4'>
        <div className='bg-card border border-border rounded-2xl p-5 space-y-3 text-sm'>
          <h2 className='font-bold text-foreground'>Vendor Details</h2>
          {[
            { label: 'Vendor Name', value: inv.vendor?.name ?? inv.vendorName },
            { label: 'Bank Name', value: inv.vendor?.bankName ?? '—' },
            { label: 'Account No', value: inv.vendor?.bankAccountNo ?? '—' },
            {
              label: 'Account Name',
              value: inv.vendor?.bankAccountName ?? '—'
            },
            { label: 'TIN', value: inv.vendor?.taxId ?? '—' },
            {
              label: 'Email',
              value: inv.vendor?.email ?? inv.vendorEmail ?? '—'
            }
          ].map(({ label, value }) => (
            <div key={label} className='flex justify-between'>
              <span className='text-muted-foreground'>{label}</span>
              <span className='font-semibold text-foreground text-right max-w-[60%] truncate'>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className='bg-card border border-border rounded-2xl p-5 space-y-3 text-sm'>
          <h2 className='font-bold text-foreground'>Payment Assignment</h2>
          {[
            { label: 'Assigned By', value: batch.assignedBy.name },
            { label: 'Teller', value: batch.teller.name },
            { label: 'Assigned Date', value: fmtDate(batch.assignedAt) },
            { label: 'GL Account', value: glDisplay },
            { label: 'Total Amount', value: naira(batch.totalAmount) },
            { label: 'Amount Disbursed', value: naira(batch.amountDisbursed) }
          ].map(({ label, value }) => (
            <div key={label} className='flex justify-between'>
              <span className='text-muted-foreground'>{label}</span>
              <span className='font-semibold text-foreground text-right max-w-[60%]'>
                {value}
              </span>
            </div>
          ))}
          {batch.instructions && (
            <div className='pt-2 border-t border-border'>
              <p className='text-xs text-muted-foreground mb-1'>
                Payment Instructions
              </p>
              <p className='text-sm text-foreground'>{batch.instructions}</p>
            </div>
          )}
        </div>
      </div>

      {inv.description && (
        <div className='bg-card border border-border rounded-2xl px-6 py-4'>
          <h2 className='font-bold text-foreground text-sm mb-2'>
            Invoice Description
          </h2>
          <p className='text-sm text-muted-foreground leading-relaxed'>
            {inv.description}
          </p>
        </div>
      )}

      {inv.lineItems.length > 0 && (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-6 py-4 border-b border-border'>
            <h2 className='font-bold text-foreground text-sm'>
              Invoice Line Items
            </h2>
          </div>
          <table className='w-full text-sm'>
            <thead className='bg-muted/30 text-xs text-muted-foreground uppercase'>
              <tr>
                <th className='text-left px-6 py-3'>Description</th>
                <th className='text-right px-4 py-3'>Qty</th>
                <th className='text-right px-4 py-3'>Unit Cost</th>
                <th className='text-right px-6 py-3'>Total</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {inv.lineItems.map(item => (
                <tr key={item.id}>
                  <td className='px-6 py-3 text-foreground'>
                    {item.description}
                  </td>
                  <td className='px-4 py-3 text-right text-muted-foreground'>
                    {parseFloat(item.quantity).toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-right text-muted-foreground font-mono'>
                    {naira(item.unitCost)}
                  </td>
                  <td className='px-6 py-3 text-right font-semibold text-foreground font-mono'>
                    {naira(item.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className='px-6 py-5 bg-muted/20 border-t border-border space-y-2 text-sm'>
            {[
              {
                label: 'Sub-Total',
                value: naira(inv.subtotal),
                bold: false,
                red: false
              },
              {
                label: `VAT (${vatPct}%)`,
                value: `+ ${naira(inv.vatAmount)}`,
                bold: false,
                red: false
              },
              {
                label: `WHT (${whtPct}%)`,
                value: `− ${naira(inv.whtAmount)}`,
                bold: false,
                red: true
              }
            ].map(({ label, value, red }) => (
              <div key={label} className='flex justify-between items-center'>
                <span className='text-muted-foreground'>{label}</span>
                <span
                  className={`font-semibold font-mono ${
                    red ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
            <div className='flex justify-between items-center border-t border-border pt-3 mt-3'>
              <span className='font-bold text-foreground'>
                Amount Payable to Vendor
              </span>
              <span className='text-2xl font-extrabold text-[#FFB800] font-mono'>
                {naira(inv.amountPayable)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className='space-y-4'>
        <h2 className='font-bold text-foreground'>Payment Tranches</h2>

        {batch.tranches.map(tranche => {
          const canAction = tranche.status === 'SUBMITTED' && perms.canApprove

          return (
            <div
              key={tranche.id}
              className='bg-card border border-border rounded-2xl overflow-hidden'
            >
              <div className='px-6 py-4 flex items-start justify-between gap-4 flex-wrap border-b border-border'>
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <span className='font-bold text-foreground'>
                      {tranche.label ?? `Tranche ${tranche.trancheNumber}`}
                    </span>
                    <Badge status={tranche.status} />
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Processed by:{' '}
                    <strong>{tranche.processedBy?.name ?? '—'}</strong>
                    {tranche.submittedAt && (
                      <> · Submitted: {fmtDate(tranche.submittedAt)}</>
                    )}
                    {tranche.paidAt && <> · Paid: {fmtDate(tranche.paidAt)}</>}
                  </p>
                </div>
                <div className='text-right'>
                  <div className='text-xl font-extrabold font-mono text-[#FFB800]'>
                    {naira(tranche.plannedAmount)}
                  </div>
                  {tranche.plannedPercentage && (
                    <div className='text-xs text-muted-foreground'>
                      {parseFloat(tranche.plannedPercentage).toFixed(0)}% of
                      total
                    </div>
                  )}
                </div>
              </div>

              <div className='px-6 py-4 grid grid-cols-2 gap-4 text-sm bg-muted/20'>
                {[
                  {
                    label: 'Payment Method',
                    value: tranche.paymentMethod?.replace(/_/g, ' ') ?? '—'
                  },
                  {
                    label: 'Transaction Ref',
                    value: tranche.transactionRef ?? '—'
                  }
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className='text-xs text-muted-foreground mb-0.5'>
                      {label}
                    </div>
                    <div className='font-semibold text-foreground'>{value}</div>
                  </div>
                ))}
                {tranche.tellerNotes && (
                  <div className='col-span-2'>
                    <div className='text-xs text-muted-foreground mb-0.5'>
                      Teller Notes
                    </div>
                    <div className='text-sm text-foreground'>
                      {tranche.tellerNotes}
                    </div>
                  </div>
                )}
              </div>

              {tranche.status === 'REJECTED' && tranche.rejectionReason && (
                <div className='px-6 py-3 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800'>
                  <p className='text-xs text-red-700 dark:text-red-400'>
                    <strong>Rejection reason:</strong> {tranche.rejectionReason}
                  </p>
                </div>
              )}

              {tranche.proofs.length > 0 && (
                <div className='px-6 py-3 border-t border-border space-y-2'>
                  <p className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>
                    Proof of Payment
                  </p>
                  {tranche.proofs.map(p => (
                    <a
                      key={p.id}
                      href={buildDownloadUrl(p.fileUrl, p.fileName)}
                      download={p.fileName}
                      className='flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-sm group'
                    >
                      <FileText
                        size={14}
                        className='text-[#1B2A8A] dark:text-blue-400 flex-shrink-0'
                      />
                      <span className='font-semibold text-foreground group-hover:underline flex-1 truncate'>
                        {p.fileName}
                      </span>
                      <Download
                        size={13}
                        className='text-muted-foreground flex-shrink-0'
                      />
                    </a>
                  ))}
                </div>
              )}

              {tranche.approvals.length > 0 && (
                <div className='px-6 py-3 border-t border-border space-y-2'>
                  <p className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>
                    Approval History
                  </p>
                  {tranche.approvals.map(a => (
                    <div key={a.id} className='flex items-start gap-3 text-sm'>
                      {a.action === 'APPROVED' ? (
                        <CheckCircle2
                          size={15}
                          className='text-green-500 flex-shrink-0 mt-0.5'
                        />
                      ) : (
                        <XCircle
                          size={15}
                          className='text-red-500 flex-shrink-0 mt-0.5'
                        />
                      )}
                      <div>
                        <span className='font-semibold text-foreground'>
                          {a.approvedBy.name}
                        </span>
                        <span className='text-muted-foreground'>
                          {' '}
                          ({a.roleName})
                        </span>
                        <span
                          className={`ml-2 font-bold ${
                            a.action === 'APPROVED'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {a.action}
                        </span>
                        {a.isDecisive && (
                          <span className='ml-1 text-xs text-muted-foreground'>
                            (decisive)
                          </span>
                        )}
                        <span className='text-muted-foreground ml-2 text-xs'>
                          {fmtDate(a.createdAt)}
                        </span>
                        {a.comment && (
                          <p className='text-muted-foreground mt-0.5'>
                            "{a.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canAction && (
                <div className='px-6 py-4 border-t border-border bg-muted/10 flex items-center gap-3'>
                  <button
                    onClick={() => setModal({ tranche, action: 'APPROVED' })}
                    className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors'
                  >
                    <CheckCircle2 size={16} /> Approve Payment
                  </button>
                  <button
                    onClick={() => setModal({ tranche, action: 'REJECTED' })}
                    className='flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-sm transition-colors'
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <p className='text-xs text-muted-foreground ml-auto'>
                    First valid approval wins — you cannot approve a tranche you
                    processed yourself
                  </p>
                </div>
              )}

              {tranche.status === 'SUBMITTED' && !perms.canApprove && (
                <div className='px-6 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground'>
                  This tranche is awaiting approval by Payment Head or Payment
                  Supervisor.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <ApprovalModal
          tranche={modal.tranche}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
