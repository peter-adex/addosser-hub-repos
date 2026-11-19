'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePaymentCaps } from '@/hooks/usePaymentCaps'
import { buildDownloadUrl } from '@/lib/download'
import {
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  FileText,
  TrendingDown
} from 'lucide-react'

function naira (v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '₦0.00'
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (isNaN(n)) return '₦0.00'
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n)}`
}

function fmtDate (d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

interface ProofDoc {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
}

interface TrancheDetail {
  id: string
  trancheNumber: number
  label: string | null
  plannedAmount: string
  status: string
  transactionRef: string | null
  paymentMethod: string | null
  paidAt: string | null
  proofs: ProofDoc[]
}

interface InvoiceSummary {
  id: string
  invoiceNo: string
  description: string | null
  subtotal: string
  vatAmount: string
  whtAmount: string
  amountPayable: string
  status: string
  createdAt: string
  paidAt: string | null
  totalPaid: string
  outstandingBalance: string
  tranches: TrancheDetail[]
}

interface VendorAccount {
  id: string
  name: string
  code: string | null
  email: string | null
  phone: string | null
  address: string | null
  bankName: string | null
  bankAccountNo: string | null
  bankAccountName: string | null
  entity: { name: string; code: string } | null
  totalInvoiced: string
  totalPaid: string
  outstanding: string
  fullyApprovedCount: number
  partialCount: number
  paidCount: number
  invoices: InvoiceSummary[]
}

function StatusBadge ({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PARTIALLY_PAID:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PAYMENT_PROCESSING:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    PAYMENT_ASSIGNED:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PAYMENT_QUEUED:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    APPROVED:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    SUBMITTED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
        map[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function VendorAccountPage () {
  const params = useParams()
  const router = useRouter()
  const vendorId = params.vendorId as string
  const caps = usePaymentCaps()
  const perms = { canView: caps.canView() }

  const [data, setData] = useState<VendorAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<
    'outstanding' | 'history' | 'approved'
  >('outstanding')

  useEffect(() => {
    if (!perms.canView) return
    fetch(`/api/vendors/${vendorId}/account`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load vendor account'))
      .finally(() => setLoading(false))
  }, [vendorId, perms.canView])

  if (!perms.canView) {
    return (
      <div className='flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground'>
        <AlertCircle size={40} className='text-red-500' />
        <p className='font-bold text-foreground'>Access Denied</p>
        <p className='text-sm'>You need Payment Processing view access.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-32'>
        <div className='w-8 h-8 border-2 border-[#FFB800] border-t-transparent rounded-full animate-spin' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground'>
        <AlertCircle size={40} className='text-red-500' />
        <p className='font-bold text-foreground'>
          {error || 'Vendor not found'}
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

  const outstandingInvoices = data.invoices.filter(i =>
    [
      'PAYMENT_QUEUED',
      'PAYMENT_ASSIGNED',
      'PAYMENT_PROCESSING',
      'PARTIALLY_PAID'
    ].includes(i.status)
  )
  const approvedInvoices = data.invoices.filter(i => i.status === 'APPROVED')
  const paidInvoices = data.invoices.filter(i => i.status === 'PAID')

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div>
          <div className='flex items-center gap-2 mb-1'>
            <Link
              href='/invoice'
              className='text-xs text-muted-foreground hover:underline'
            >
              Invoices
            </Link>
            <span className='text-muted-foreground'>/</span>
            <span className='text-xs text-muted-foreground'>
              Vendor Account
            </span>
          </div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            {data.name}
          </h1>
          <p className='text-sm text-muted-foreground mt-0.5'>
            {data.code && <span className='font-mono mr-2'>{data.code}</span>}
            {data.entity ? `${data.entity.name} (${data.entity.code})` : 'Global — usable by any entity'}
          </p>
        </div>
        <Link
          href={`/invoice?vendorId=${vendorId}`}
          className='flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent transition-colors'
        >
          <FileText size={14} />
          View Invoices
        </Link>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[
          {
            label: 'Total Invoiced',
            value: naira(data.totalInvoiced),
            icon: '📋',
            colour: 'text-foreground'
          },
          {
            label: 'Total Paid',
            value: naira(data.totalPaid),
            icon: '✅',
            colour: 'text-green-600 dark:text-green-400'
          },
          {
            label: 'Outstanding Balance',
            value: naira(data.outstanding),
            icon: '⏳',
            colour: 'text-amber-600 dark:text-amber-400'
          },
          {
            label: 'Awaiting Payment',
            value: `${
              data.fullyApprovedCount + outstandingInvoices.length
            } invoice${
              data.fullyApprovedCount + outstandingInvoices.length !== 1
                ? 's'
                : ''
            }`,
            icon: '💳',
            colour: 'text-[#1B2A8A] dark:text-blue-300'
          }
        ].map(tile => (
          <div
            key={tile.label}
            className='bg-card border border-border rounded-2xl p-5'
          >
            <div className='text-2xl mb-2'>{tile.icon}</div>
            <div className={`text-lg font-extrabold font-mono ${tile.colour}`}>
              {tile.value}
            </div>
            <div className='text-xs text-muted-foreground mt-1'>
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      <div className='bg-card border border-border rounded-2xl p-5 grid md:grid-cols-2 gap-6'>
        <div className='space-y-3'>
          <h2 className='text-sm font-bold text-foreground mb-3'>
            Contact Details
          </h2>
          {[
            { icon: Mail, label: data.email ?? '—' },
            { icon: Phone, label: data.phone ?? '—' },
            { icon: Building2, label: data.address ?? '—' }
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className='flex items-start gap-2.5 text-sm text-muted-foreground'
            >
              <Icon size={14} className='mt-0.5 flex-shrink-0' />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className='space-y-3'>
          <h2 className='text-sm font-bold text-foreground mb-3'>
            Bank Details
          </h2>
          {[
            { label: 'Bank', value: data.bankName ?? '—' },
            {
              label: 'Account No',
              value: data.bankAccountNo
                ? `****${data.bankAccountNo.slice(-4)}`
                : '—'
            },
            { label: 'Account Name', value: data.bankAccountName ?? '—' }
          ].map(({ label, value }) => (
            <div key={label} className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>{label}</span>
              <span className='font-semibold text-foreground'>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='flex gap-1 p-1 bg-muted rounded-xl w-fit'>
        {(
          [
            {
              key: 'outstanding',
              label: `Outstanding (${outstandingInvoices.length})`
            },
            {
              key: 'approved',
              label: `Approved / Queued (${approvedInvoices.length})`
            },
            { key: 'history', label: `Paid (${paidInvoices.length})` }
          ] as const
        ).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-card shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'outstanding' && (
        <div className='space-y-4'>
          {outstandingInvoices.length === 0 ? (
            <div className='bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-muted-foreground'>
              <CheckCircle2 size={40} className='text-green-500' />
              <p className='font-bold text-foreground'>
                No outstanding balances
              </p>
            </div>
          ) : (
            outstandingInvoices.map(inv => (
              <div
                key={inv.id}
                className='bg-card border border-border rounded-2xl overflow-hidden'
              >
                <div className='px-5 py-4 flex items-start justify-between gap-4 flex-wrap border-b border-border'>
                  <div>
                    <div className='flex items-center gap-2 mb-1'>
                      <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                        {inv.invoiceNo}
                      </code>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {inv.description ?? 'No description'}
                    </p>
                  </div>
                  <div className='text-right'>
                    <div className='text-xs text-muted-foreground'>
                      Outstanding Balance
                    </div>
                    <div className='text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono'>
                      {naira(inv.outstandingBalance)}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      of {naira(inv.amountPayable)} payable
                    </div>
                  </div>
                </div>

                {inv.tranches.length > 0 && (
                  <div className='px-5 py-3 space-y-2 bg-muted/20'>
                    <p className='text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2'>
                      Payment Tranches
                    </p>
                    {inv.tranches.map(t => (
                      <div
                        key={t.id}
                        className='flex items-center justify-between text-sm'
                      >
                        <span className='text-muted-foreground'>
                          {t.label ?? `Tranche ${t.trancheNumber}`}
                        </span>
                        <div className='flex items-center gap-3'>
                          <span className='font-mono font-semibold text-foreground'>
                            {naira(t.plannedAmount)}
                          </span>
                          <StatusBadge status={t.status} />
                          {t.paidAt && (
                            <span className='text-xs text-muted-foreground'>
                              {fmtDate(t.paidAt)}
                            </span>
                          )}
                          {t.proofs.map(p => (
                            <a
                              key={p.id}
                              href={buildDownloadUrl(p.fileUrl, p.fileName)}
                              download={p.fileName}
                              className='flex items-center gap-1 text-xs text-[#1B2A8A] dark:text-blue-400 hover:underline'
                            >
                              <Download size={11} /> {p.fileName}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className='px-5 py-3 border-t border-border flex justify-between text-xs text-muted-foreground'>
                  <span>Invoice Date: {fmtDate(inv.createdAt)}</span>
                  <span>Paid to date: {naira(inv.totalPaid)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'approved' && (
        <div className='space-y-3'>
          {approvedInvoices.length === 0 ? (
            <div className='bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-muted-foreground'>
              <Clock size={40} />
              <p className='font-bold text-foreground'>
                No invoices awaiting payment
              </p>
            </div>
          ) : (
            approvedInvoices.map(inv => (
              <div
                key={inv.id}
                className='bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-4'
              >
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                      {inv.invoiceNo}
                    </code>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    {inv.description ?? 'No description'}
                  </p>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    Approved {fmtDate(inv.createdAt)}
                  </p>
                </div>
                <div className='text-right'>
                  <div className='text-lg font-extrabold text-[#FFB800] font-mono'>
                    {naira(inv.amountPayable)}
                  </div>
                  <Link
                    href={`/payment/queue/${inv.id}`}
                    className='text-xs text-[#1B2A8A] dark:text-blue-400 hover:underline flex items-center gap-1 justify-end mt-1'
                  >
                    <ExternalLink size={10} /> View in Queue
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className='space-y-4'>
          {paidInvoices.length === 0 ? (
            <div className='bg-card border border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-muted-foreground'>
              <CreditCard size={40} />
              <p className='font-bold text-foreground'>
                No completed payments yet
              </p>
            </div>
          ) : (
            paidInvoices.map(inv => (
              <div
                key={inv.id}
                className='bg-card border border-border rounded-2xl overflow-hidden'
              >
                <div className='px-5 py-4 flex items-start justify-between gap-4 border-b border-border flex-wrap'>
                  <div>
                    <div className='flex items-center gap-2 mb-1'>
                      <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                        {inv.invoiceNo}
                      </code>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {inv.description ?? '—'}
                    </p>
                  </div>
                  <div className='text-right'>
                    <div className='text-lg font-extrabold text-green-600 dark:text-green-400 font-mono'>
                      {naira(inv.totalPaid)}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Paid {fmtDate(inv.paidAt)}
                    </div>
                  </div>
                </div>
                <div className='px-5 py-3 grid grid-cols-3 gap-4 text-sm bg-muted/20'>
                  {[
                    { label: 'Sub-Total', value: naira(inv.subtotal) },
                    { label: 'VAT', value: naira(inv.vatAmount) },
                    { label: 'WHT', value: `−${naira(inv.whtAmount)}` }
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className='text-xs text-muted-foreground'>
                        {label}
                      </div>
                      <div className='font-semibold font-mono text-foreground'>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                {inv.tranches.filter(t => t.status === 'PAID').length > 0 && (
                  <div className='px-5 py-3 border-t border-border space-y-2'>
                    <p className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>
                      Payment Records
                    </p>
                    {inv.tranches
                      .filter(t => t.status === 'PAID')
                      .map(t => (
                        <div
                          key={t.id}
                          className='flex items-center justify-between text-sm flex-wrap gap-2'
                        >
                          <div>
                            <span className='font-semibold text-foreground'>
                              {t.label ?? `Tranche ${t.trancheNumber}`}
                            </span>
                            <span className='text-muted-foreground ml-2'>
                              · {t.paymentMethod ?? '—'} · Ref:{' '}
                              {t.transactionRef ?? '—'}
                            </span>
                          </div>
                          <div className='flex items-center gap-3'>
                            <span className='font-mono font-bold text-foreground'>
                              {naira(t.plannedAmount)}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                              {fmtDate(t.paidAt)}
                            </span>
                            {t.proofs.map(p => (
                              <a
                                key={p.id}
                                href={buildDownloadUrl(p.fileUrl, p.fileName)}
                                download={p.fileName}
                                title={`Download ${p.fileName}`}
                                className='flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B2A8A]/10 text-[#1B2A8A] dark:text-blue-400 text-xs font-semibold hover:bg-[#1B2A8A]/20 transition-colors'
                              >
                                <Download size={11} /> {p.fileName}
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
