import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { checkOpexBudget } from '@/lib/budget-validation'
import { formatNGN } from '@/lib/utils'
import { Badge } from '@/components/shared/Badge'
import InvoiceSubmitButton from '@/components/invoice/InvoiceSubmitButton'

export const metadata: Metadata = {
  title: 'Review Invoice Before Submission'
}

const INVOICE_TYPE_META: Record<
  string,
  { label: string; icon: string; desc: string }
> = {
  GENERAL_EXPENSE: {
    label: 'General Expense',
    icon: '🧾',
    desc: 'Standard vendor invoice not linked to any asset.'
  },
  ASSET_RELATED: {
    label: 'Asset-Related',
    icon: '🔧',
    desc: 'Maintenance, repair or upgrade linked to an existing asset.'
  },
  ASSET_PURCHASE: {
    label: 'Asset Purchase',
    icon: '🏗️',
    desc: 'New asset acquisition — a new asset record will be created on full approval.'
  }
}

export default async function InvoicePreviewPage ({
  params
}: {
  params: { id: string }
}) {
  await requireGranularPermission('invoice', 'invoices', 'create')
  const user = await requireAuth()

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { name: true, code: true } },
      vendor: true,
      lineItems: { orderBy: { sortOrder: 'asc' } },
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true } }
        }
      },
      approvalSelections: {
        orderBy: { stepNumber: 'asc' },
        include: { user: { select: { id: true, name: true, email: true, entityId: true, isActive: true, entityAccess: { select: { entityId: true } } } } }
      }
    }
  })

  if (!invoice) notFound()

  const branchName = invoice.branchId
    ? await prisma.branch
        .findUnique({ where: { id: invoice.branchId }, select: { name: true } })
        .then(b => b?.name ?? null)
    : null

  const glAccount = invoice.glAccountId
    ? await prisma.gLAccount.findUnique({
        where: { id: invoice.glAccountId },
        select: { code: true, name: true }
      })
    : null

  if (!['DRAFT', 'RECALLED'].includes(invoice.status)) {
    return (
      <div className='max-w-2xl mx-auto py-16 text-center'>
        <div className='text-5xl mb-4'>ℹ️</div>
        <h2 className='text-xl font-bold text-foreground mb-2'>
          Invoice Already Submitted
        </h2>
        <p className='text-muted-foreground text-sm mb-6'>
          This invoice is <strong>{invoice.status.replace(/_/g, ' ')}</strong>{' '}
          and has already been submitted.
        </p>
        <Link
          href={`/invoice/${params.id}`}
          className='inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm'
          style={{ background: '#FFB800', color: '#1B2A8A' }}
        >
          View Invoice →
        </Link>
      </div>
    )
  }

  const approvalSelections = invoice.approvalSelections

  const totalAmount = Number(invoice.totalAmount)

  const limitWarnings = approvalSelections.filter(sel => {
    const limit = sel.approvalLimitAmount ? Number(sel.approvalLimitAmount) : null
    return limit !== null && totalAmount > limit
  })

  const deadlockedSteps = approvalSelections.filter(sel => {
    const u = sel.user
    if (!u.isActive) return true
    const hasAccess =
      u.entityId === invoice.entityId ||
      u.entityAccess.some(ea => ea.entityId === invoice.entityId)
    return !hasAccess
  })
  const hasDeadlockedSteps = deadlockedSteps.length > 0

  let budgetWarning: {
    glName: string
    annualBudget: number
    monthlyBudget: number
    monthlyCommitted: number
    monthlyAvailable: number
    financialYear: number
    currentMonth: number
  } | null = null

  if (invoice.glAccountId && invoice.entityId) {
    const glAccountForBudget = await prisma.gLAccount.findUnique({
      where: { id: invoice.glAccountId },
      select: { name: true, code: true }
    })

    if (glAccountForBudget) {
      const result = await checkOpexBudget({
        entityId: invoice.budgetEntityId ?? invoice.entityId,
        glAccountCode: glAccountForBudget.code,
        amountPayable: totalAmount
      })

      if (result.hasBudget && result.exceeded) {
        budgetWarning = {
          glName: glAccountForBudget.name,
          annualBudget: result.annualBudget,
          monthlyBudget: result.monthlyBudget,
          monthlyCommitted: result.monthlyCommitted,
          monthlyAvailable: result.monthlyAvailable,
          financialYear: result.financialYear,
          currentMonth: result.currentMonth
        }
      }
    }
  }

  const typeMeta =
    INVOICE_TYPE_META[invoice.invoiceType ?? 'GENERAL_EXPENSE'] ??
    INVOICE_TYPE_META.GENERAL_EXPENSE

  const lineTotal = invoice.lineItems.reduce(
    (s, l) => s + Number(l.totalCost),
    0
  )

  return (
    <div className='max-w-3xl mx-auto space-y-6 pb-10'>
      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          Review Before Submission
        </h1>
        <p className='text-muted-foreground text-sm mt-1'>
          Check all details carefully. You can still edit if anything is
          incorrect.
        </p>
      </div>

      <div className='flex items-center gap-4 p-5 bg-card border border-border rounded-2xl'>
        <span className='text-3xl'>{typeMeta.icon}</span>
        <div>
          <div className='font-bold text-foreground flex items-center gap-2'>
            {typeMeta.label}
            <Badge variant='blue'>Invoice Type</Badge>
          </div>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {typeMeta.desc}
          </p>
        </div>
      </div>

      {budgetWarning && (
        <div className='p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700'>
          <div className='flex items-start gap-3'>
            <span className='text-2xl flex-shrink-0'>⚠️</span>
            <div className='space-y-3'>
              <div>
                <h3 className='font-bold text-amber-800 dark:text-amber-400'>
                  Exceptional Expenditure — Monthly Budget Exceeded
                </h3>
                <p className='text-sm text-amber-700 dark:text-amber-500 mt-1'>
                  This invoice of <strong>{formatNGN(totalAmount)}</strong>{' '}
                  exceeds the available budget for{' '}
                  <strong>{budgetWarning.glName}</strong> for{' '}
                  {new Date(budgetWarning.financialYear, budgetWarning.currentMonth - 1).toLocaleString('en-NG', { month: 'long', year: 'numeric' })}
                  . It will be flagged as a{' '}
                  <strong>Negative Variance</strong> and require approval
                  from an approver configured with Exceptional Approval
                  Workflow permission.
                </p>
              </div>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm'>
                {[
                  ['Annual Budget', formatNGN(budgetWarning.annualBudget)],
                  ['Current Month Budget', formatNGN(budgetWarning.monthlyBudget)],
                  ['Already Expensed', formatNGN(budgetWarning.monthlyCommitted)],
                  ['Available Balance', formatNGN(budgetWarning.monthlyAvailable)]
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className='bg-white/60 dark:bg-black/20 rounded-xl p-3'
                  >
                    <div className='text-xs font-bold text-amber-700 dark:text-amber-500 uppercase'>
                      {label}
                    </div>
                    <div className='font-bold text-amber-900 dark:text-amber-300 text-sm'>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {limitWarnings.length > 0 && (
        <div className='p-5 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'>
          <div className='flex items-start gap-3'>
            <span className='text-2xl flex-shrink-0'>🚫</span>
            <div>
              <h3 className='font-bold text-red-800 dark:text-red-400'>
                Invoice Exceeds Approval Limit
              </h3>
              <p className='text-sm text-red-700 dark:text-red-500 mt-1'>
                This invoice of <strong>{formatNGN(totalAmount)}</strong>{' '}
                exceeds the configured approval limit for the following
                approver{limitWarnings.length > 1 ? 's' : ''}:
              </p>
              <ul className='mt-2 space-y-1'>
                {limitWarnings.map(sel => (
                  <li
                    key={sel.id}
                    className='text-sm text-red-700 dark:text-red-400'
                  >
                    • <strong>{sel.user.name}</strong> (Step {sel.stepNumber}) — limit:{' '}
                    {formatNGN(Number(sel.approvalLimitAmount))}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {hasDeadlockedSteps && (
        <div className='p-5 rounded-2xl bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-900 shadow-sm'>
          <div className='flex items-start gap-3'>
            <span className='text-2xl flex-shrink-0'>🚨</span>
            <div>
              <h3 className='font-bold text-red-800 dark:text-red-400'>
                Critical Error: Selected Approver No Longer Eligible
              </h3>
              <p className='text-sm text-red-700 dark:text-red-400/80 mt-1 leading-relaxed'>
                This invoice cannot be submitted. The following selected
                approver{deadlockedSteps.length > 1 ? 's no longer have' : ' no longer has'}{' '}
                active access to <strong>{invoice.entity.name}</strong>:
              </p>
              <ul className='mt-2 space-y-1.5 pl-4 list-disc text-sm text-red-800 dark:text-red-300 font-semibold'>
                {deadlockedSteps.map(sel => (
                  <li key={sel.id}>
                    {sel.user.name} (Step {sel.stepNumber})
                  </li>
                ))}
              </ul>
              <p className='text-xs text-red-600 dark:text-red-500 mt-3 font-medium italic'>
                Please recall this invoice (if already submitted) and
                re-select approvers, or ask your System Administrator to
                restore this user's access before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        <div className='px-6 py-4 border-b border-border'>
          <h2 className='font-bold text-foreground'>Invoice Summary</h2>
        </div>
        <div className='grid grid-cols-2 gap-x-6 gap-y-3 p-6 text-sm'>
          {[
            ['Invoice ID', invoice.invoiceNo],
            ['Entity', `${invoice.entity.name} (${invoice.entity.code})`],
            ['Branch', branchName ?? invoice.branchId ?? '—'],
            ['Vendor', invoice.vendorName || '—'],
            [
              'GL Account',
              glAccount
                ? `${glAccount.code} — ${glAccount.name}`
                : invoice.glAccountCode ?? '—'
            ],
            ['Invoice Type', typeMeta.label],
            ['Description', invoice.description ?? '—'],
            [
              'Due Date',
              invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString('en-NG', {
                    dateStyle: 'long'
                  })
                : '—'
            ],
            ['VAT Rate', `${(Number(invoice.vatRate) * 100).toFixed(1)}%`],
            ['WHT Rate', `${(Number(invoice.whtRate) * 100).toFixed(0)}%`]
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className='text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5'>
                {label}
              </div>
              <div className='text-foreground font-medium break-words'>
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        <div className='border-t border-border'>
          <div className='px-6 py-3 bg-muted/30'>
            <h3 className='font-bold text-sm text-foreground'>Line Items</h3>
          </div>
          <table className='w-full border-collapse text-sm'>
            <thead className='bg-muted/20'>
              <tr>
                {['Description', 'QTY', 'Unit Cost (₦)', 'Total (₦)'].map(h => (
                  <th
                    key={h}
                    className='px-5 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider'
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map(line => (
                <tr key={line.id} className='border-t border-border'>
                  <td className='px-5 py-3 text-foreground'>
                    {line.description || '—'}
                  </td>
                  <td className='px-5 py-3 text-foreground tabular-nums'>
                    {Number(line.quantity)}
                  </td>
                  <td className='px-5 py-3 text-foreground tabular-nums'>
                    {formatNGN(Number(line.unitCost))}
                  </td>
                  <td className='px-5 py-3 font-semibold text-foreground tabular-nums'>
                    {formatNGN(Number(line.totalCost))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className='border-t border-border px-6 py-4 space-y-2'>
            {[
              ['Subtotal', formatNGN(lineTotal), false],
              [
                `VAT @ ${(Number(invoice.vatRate) * 100).toFixed(1)}%`,
                formatNGN(Number(invoice.vatAmount)),
                false
              ],
              [
                'Total + VAT',
                formatNGN(Number(invoice.totalAmount)),
                true
              ],
              [
                `WHT @ ${(Number(invoice.whtRate) * 100).toFixed(0)}%`,
                `−${formatNGN(Number(invoice.whtAmount))}`,
                false
              ]
            ].map(([label, value, bold]) => (
              <div
                key={String(label)}
                className='flex items-center justify-between py-1 border-b border-border/50 last:border-0 text-sm'
              >
                <span
                  className={
                    bold ? 'font-bold text-foreground' : 'text-muted-foreground'
                  }
                >
                  {String(label)}
                </span>
                <span
                  className={
                    bold
                      ? 'font-bold text-foreground'
                      : 'text-foreground tabular-nums'
                  }
                >
                  {String(value)}
                </span>
              </div>
            ))}

            <div className='flex items-center justify-between pt-2'>
              <div>
                <div className='font-extrabold text-[#FFB800] text-base'>
                  Amount Payable to Vendor
                </div>
                <div className='text-xs text-muted-foreground'>
                  Subtotal + VAT − WHT
                </div>
              </div>
              <span className='font-extrabold text-[#FFB800] text-xl tabular-nums'>
                {formatNGN(Number(invoice.amountPayable))}
              </span>
            </div>
          </div>
        </div>
      </div>
      {approvalSelections.length > 0 && (
        <div className='bg-card border border-border rounded-2xl p-6'>
          <h2 className='font-bold text-foreground mb-4'>
            Approval Chain — Selected Approvers
          </h2>
          <div className='space-y-4'>
            {approvalSelections.map((sel, idx) => {
              const limit = sel.approvalLimitAmount
                ? Number(sel.approvalLimitAmount)
                : null
              const exceedsLimit = limit !== null && totalAmount > limit
              const u = sel.user
              const lostAccess =
                !u.isActive ||
                (u.entityId !== invoice.entityId &&
                  !u.entityAccess.some(ea => ea.entityId === invoice.entityId))
              return (
                <div key={sel.id} className='flex items-start gap-4'>
                  <div
                    className='w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-extrabold text-white'
                    style={{ background: exceedsLimit || lostAccess ? '#dc2626' : '#1B2A8A' }}
                  >
                    {sel.stepNumber}
                  </div>
                  <div
                    className={`flex-1 pb-4 ${
                      idx < approvalSelections.length - 1
                        ? 'border-l-2 border-border pl-4'
                        : 'pl-4'
                    }`}
                  >
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-semibold text-foreground text-sm'>
                        {u.name}
                      </span>
                      {sel.isExceptionalApprover && (
                        <span className='text-[10px] bg-[#FFB800]/20 text-[#8a6400] dark:text-[#FFB800] px-2 py-0.5 rounded font-extrabold tracking-wide uppercase'>
                          Exceptional Approver
                        </span>
                      )}
                      {lostAccess && (
                        <span className='text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-extrabold tracking-wide uppercase animate-pulse'>
                          ⚠️ No Longer Eligible
                        </span>
                      )}
                      {exceedsLimit && (
                        <span className='text-xs bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold'>
                          ⚠️ Exceeds limit ({formatNGN(limit!)})
                        </span>
                      )}
                    </div>
                    <div className='mt-1 space-y-0.5'>
                      <div className='text-xs text-muted-foreground'>
                        {u.name} · {u.email} ·{' '}
                        {limit ? formatNGN(limit) : 'No Limit'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className='flex items-center gap-3'>
        {!hasDeadlockedSteps ? (
          <InvoiceSubmitButton invoiceId={params.id} />
        ) : (
          <button
            type='button'
            disabled
            className='px-6 py-3 rounded-xl font-bold text-sm bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
          >
            🔒 Submission Locked
          </button>
        )}

        <Link
          href={`/invoice/${params.id}/edit`}
          className='px-6 py-3 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent transition-colors'
        >
          ✏️ Edit Invoice
        </Link>
      </div>
    </div>
  )
}
