import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireGranularPermission, requireAuth, hasGranularPermission } from '@/lib/permissions'
import { getAssetCostHistory, checkDuplicateAssetExpense } from '@/lib/asset-cost-history'
import AssetCostHistorySection from '@/components/invoice/AssetCostHistorySection'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/shared/Badge'
import { formatCompact } from '@/lib/utils'
import InvoiceApprovalSection from '@/components/invoice/InvoiceApprovalSection'
import InvoiceRecallButton from '@/components/invoice/InvoiceRecallButton'
import ApprovalGLEditor from '@/components/invoice/ApprovalGLEditor'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

export const metadata: Metadata = { title: 'Invoice Detail' }

const STATUS_VARIANT: Record<
  string,
  'gray' | 'yellow' | 'blue' | 'green' | 'red'
> = {
  DRAFT: 'gray',
  PENDING: 'yellow',
  UNDER_REVIEW: 'blue',
  APPROVED: 'green',
  PAID: 'green',
  REJECTED: 'red',
  OVERDUE: 'red',
  RECALLED: 'gray'
}

const fmtNGN = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(n)

export default async function InvoiceDetailPage ({
  params
}: {
  params: { id: string }
}) {
  await requireGranularPermission('invoice', 'invoices', 'view')
  const user = await requireAuth()

  const isSuperUser = user.isSystem === true || user.roleName === 'Super Admin'

  const hasApproveAccess = await hasGranularPermission('invoice', 'approvals', 'approve')

  const shouldHideCreateButton = hasApproveAccess && !isSuperUser

  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id: params.id }, { invoiceNo: params.id }]
    },
    include: {
      entity: {
        select: {
          name: true,
          code: true
        }
      },
      vendor: true,
      asset: { include: { classification: { select: { name: true } } } },

      glAccount: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },

      budgetEntity: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },

      submittedBy: {
        select: {
          name: true,
          email: true
        }
      },

      lineItems: {
        orderBy: {
          sortOrder: 'asc'
        }
      }
    }
  })

  if (!invoice) notFound()

  const assetHistory = invoice.assetId
    ? await getAssetCostHistory(invoice.assetId, { windows: [30, 120, 180, 365] })
    : null
  const duplicateCheck = invoice.assetId
    ? await checkDuplicateAssetExpense({
        assetId: invoice.assetId,
        glAccountCode: invoice.glAccountCode,
        transactionDate: invoice.createdAt,
        excludeInvoiceId: invoice.id,
      })
    : null

  const currentGLEntityCode = invoice.entity.code

  const currentGLDisplayName =
    invoice.glAccount && invoice.budgetEntity
      ? `${invoice.glAccount.name} (${invoice.budgetEntity.code})`
      : invoice.glAccount?.name ?? ''

  const canSubmitForApproval =
    !shouldHideCreateButton && ['DRAFT', 'RECALLED'].includes(invoice.status)

  const currentYear = new Date().getFullYear()

  const glAccounts = await prisma.gLAccount.findMany({
    where: {
      isActive: true,

      entityAccounts: {
        some: {
          budgets: {
            some: {
              financialYear: currentYear,

              status: 'APPROVED'
            }
          }
        }
      }
    },

    include: {
      entityAccounts: {
        where: {
          budgets: {
            some: {
              financialYear: currentYear,

              status: 'APPROVED'
            }
          }
        },

        include: {
          entity: true,

          budgets: {
            where: {
              financialYear: currentYear,

              status: 'APPROVED'
            }
          }
        }
      }
    },

    orderBy: {
      code: 'asc'
    }
  })

  const formattedGLOptions = glAccounts.flatMap(gl =>
    gl.entityAccounts.map(ea => ({
      id: `${gl.id}_${ea.entityId}`,

      glAccountId: gl.id,

      code: gl.code,

      name: gl.name,

      category: gl.category,

      entityId: ea.entityId,

      entityCode: ea.entity.code,

      entityName: ea.entity.name,

      displayName: `${gl.code} — ${gl.name} (${ea.entity.code})`
    }))
  )

  const branchName = invoice.branchId
    ? await prisma.branch
        .findUnique({ where: { id: invoice.branchId }, select: { name: true } })
        .then(b => b?.name ?? null)
    : null

  const hasValidEntityAccess =
    user.isSystem ||
    invoice.entityId === user.entityId ||
    (Array.isArray(user.allowedEntityIds) &&
      user.allowedEntityIds.includes(invoice.entityId))

  if (!hasValidEntityAccess) {
    notFound()
  }

  const approvalInstance = await prisma.approvalInstance.findFirst({
    where: {
      resourceId: params.id,
      resourceType: 'Invoice'
    },
    include: {
      steps: {
        include: { actionedBy: { select: { name: true, email: true } } },
        orderBy: { stepNumber: 'asc' }
      },
      workflow: { select: { name: true } }
    }
  })

  const myPendingStep = approvalInstance?.steps.find(
    s =>
      s.status === 'PENDING' &&
      (s.userId ? s.userId === user.id : s.roleId === user.roleId)
  )

  const noStepActioned = approvalInstance
    ? approvalInstance.steps.every(s => s.status === 'PENDING')
    : true
  const canRecall =
    invoice.submittedById === user.id &&
    invoice.status === 'PENDING' &&
    noStepActioned &&
    !['APPROVED', 'PAID', 'REJECTED'].includes(invoice.status)

  const subtotal = Number(invoice.subtotal)
  const vatAmount = Number(invoice.vatAmount)
  const whtAmount = Number(invoice.whtAmount)
  const totalAmount = Number(invoice.totalAmount)
  const amountPayable = Number(invoice.amountPayable)
  const vatRate = Math.round(Number(invoice.vatRate) * 100)
  const whtRate = Math.round(Number(invoice.whtRate) * 100)

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Link href='/invoice' className='hover:text-foreground'>
          Invoice Processing
        </Link>
        <span>/</span>
        <span className='text-foreground font-medium'>{invoice.invoiceNo}</span>
      </div>

      <div className='flex items-start justify-between flex-wrap gap-4'>
        <div>
          <div className='flex items-center gap-3 mb-2 flex-wrap'>
            <code className='bg-muted px-3 py-1 rounded-lg text-sm font-bold text-foreground'>
              {invoice.invoiceNo}
            </code>
            <Badge variant={STATUS_VARIANT[invoice.status] ?? 'gray'}>
              {invoice.status.replace('_', ' ')}
            </Badge>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${INVOICE_TYPE_BADGE_CLASS[invoice.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
              {invoiceTypeLabel(invoice.invoiceType)}
            </span>
            {invoice.isExceptionalApproval && (
              <span className='px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800'>
                ⚠️ Exceptional Approval
              </span>
            )}
            {invoice.vendorIsOneTime && (
              <span className='px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'>
                One-Time Vendor
              </span>
            )}
          </div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            {invoice.vendorName}
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            {invoice.entity.name} · GL: {invoice.glAccount?.name}
            {invoice.dueDate &&
              ` · Due: ${new Date(invoice.dueDate).toLocaleDateString(
                'en-NG'
              )}`}
          </p>
        </div>

        {canSubmitForApproval && (
          <div className='flex gap-2 flex-wrap'>
            {canRecall && <InvoiceRecallButton invoiceId={params.id} />}

            {(invoice.status === 'DRAFT' || invoice.status === 'RECALLED') && (
              <Link
                href={`/invoice/${params.id}/edit`}
                className='px-4 py-2.5 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-accent'
              >
                Edit Draft
              </Link>
            )}

            <Link
              href={`/invoice/${params.id}/preview`}
              className='px-4 py-2.5 rounded-xl text-sm font-bold'
              style={{ background: '#FFB800', color: '#1B2A8A' }}
            >
              Submit for Approval →
            </Link>
          </div>
        )}
      </div>

      {invoice.isExceptionalApproval && invoice.isBudgetExceeded && (
        <div className='bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-5'>
          <div className='flex items-start gap-3'>
            <span className='text-2xl'>⚠️</span>
            <div className='flex-1'>
              <div className='font-bold text-red-800 dark:text-red-300 mb-1'>
                Over-Budget Exception — Exceptional Approval Required
              </div>
              <p className='text-sm text-red-700 dark:text-red-400 mb-3'>
                Invoice amount exceeds the available budget for this GL
                account for the selected month by{' '}
                <strong>{fmtNGN(Number(invoice.exceedanceAmount ?? 0))}</strong>
                . This invoice requires approval from an approver configured
                with Exceptional Approval Workflow permission, and is
                recorded as a negative variance.
              </p>
              {invoice.budgetMonth && invoice.budgetYear && (
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-red-700 dark:text-red-400 p-3 bg-red-100/60 dark:bg-red-950/30 rounded-xl'>
                  <div>Entity: <strong>{invoice.entity?.code ?? '—'}</strong></div>
                  <div>GL Account: <strong>{invoice.glAccountCode}</strong></div>
                  <div>Budget Year: <strong>{invoice.budgetYear}</strong></div>
                  <div>Budget Month: <strong>{new Date(invoice.budgetYear, invoice.budgetMonth - 1).toLocaleString('en-NG', { month: 'long' })}</strong></div>
                  <div>Annual Budget: <strong>{fmtNGN(Number(invoice.annualBudgetAmount ?? 0))}</strong></div>
                  <div>Current Month Budget: <strong>{fmtNGN(Number(invoice.monthlyBudgetAmount ?? 0))}</strong></div>
                  <div>Already Expensed: <strong>{fmtNGN(Number(invoice.monthlyExpensedAmount ?? 0))}</strong></div>
                  <div>Available Balance: <strong>{fmtNGN(Number(invoice.monthlyAvailableAmount ?? 0))}</strong></div>
                  <div>Invoice Total + VAT: <strong>{fmtNGN(Number(invoice.totalAmount))}</strong></div>
                </div>
              )}
              {invoice.exceptionalJustification && (
                <div className='mt-3 p-3 bg-red-100/60 dark:bg-red-950/30 rounded-xl text-sm text-red-800 dark:text-red-300'>
                  <strong>Justification:</strong>{' '}
                  {invoice.exceptionalJustification}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2 space-y-5'>
          <div className='bg-card border border-border rounded-2xl p-6'>
            <h2 className='font-bold text-foreground mb-4'>Invoice Details</h2>
            <div className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
              {[
                ['Invoice ID', invoice.invoiceNo],
                ['Entity', invoice.entity.name],
                ['Vendor', invoice.vendorName],
                [
                  'Vendor Email',
                  invoice.vendor?.email ?? invoice.vendorEmail ?? '—'
                ],
                ...(invoice.vendorIsOneTime
                  ? [
                      ['One-Time Vendor Phone', invoice.oneTimeVendorPhone ?? '—'],
                      [
                        'One-Time Vendor Bank',
                        invoice.oneTimeVendorBankName
                          ? `${invoice.oneTimeVendorBankName} — ${invoice.oneTimeVendorBankAccountNo ?? ''} (${invoice.oneTimeVendorBankAccountName ?? ''})`
                          : '—'
                      ],
                      ['Reason', invoice.oneTimeVendorReason ?? '—']
                    ]
                  : []),
                [
                  'GL Account',
                  invoice.glAccount?.code
                    ? `${invoice.glAccount.code} — ${invoice.glAccount.name}${
                        invoice.budgetEntity?.code
                          ? ` (${invoice.budgetEntity.code})`
                          : ''
                      }`
                    : invoice.glAccountCode
                    ? `${invoice.glAccountCode}${
                        invoice.budgetEntity?.code
                          ? ` (${invoice.budgetEntity.code})`
                          : ''
                      }`
                    : '—'
                ],
                ['Status', invoice.status.replace('_', ' ')],
                [
                  'Submitted By',
                  `${invoice.submittedBy.name} (${invoice.submittedBy.email})`
                ],
                [
                  'Created',
                  new Date(invoice.createdAt).toLocaleDateString('en-NG', {
                    dateStyle: 'medium'
                  })
                ],
                [
                  'Due Date',
                  invoice.dueDate
                    ? new Date(invoice.dueDate).toLocaleDateString('en-NG')
                    : '—'
                ],
                [
                  'Paid At',
                  invoice.paidAt
                    ? new Date(invoice.paidAt).toLocaleDateString('en-NG')
                    : '—'
                ],
                ['Payment Ref', invoice.paymentRef ?? '—']
              ].map(([label, value]) => (
                <div key={label}>
                  <div className='text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5'>
                    {label}
                  </div>
                  <div className='text-foreground font-medium'>{value}</div>
                </div>
              ))}
            </div>
            {invoice.description && (
              <div className='mt-4 pt-4 border-t border-border'>
                <div className='text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1'>
                  Description
                </div>
                <p className='text-sm text-foreground'>{invoice.description}</p>
              </div>
            )}
          </div>

          <div className='bg-card border border-border rounded-2xl p-6'>
            <h2 className='font-bold text-foreground mb-4'>Asset Details</h2>
            <div className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
              {[
                ['Asset No', invoice.asset?.assetNo],
                ['Asset Name', invoice.asset?.name],
                ['Category', invoice.asset?.classification?.name ?? '—'],
                ['Serial No', invoice.asset?.serialNo ?? '—'],
                ['Current Status', invoice.asset?.status],
                ['Acquisition Value', invoice.asset?.acquisitionValue ? `₦${Number(invoice.asset.acquisitionValue).toLocaleString()}` : '—']
              ].map(([label, value]) => (
                <div key={label}>
                  <div className='text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5'>
                    {label}
                  </div>
                  <div className='text-foreground font-medium'>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {duplicateCheck?.isPotentialDuplicate && (
            <div className='bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-2xl p-5'>
              <div className='flex items-start gap-3'>
                <span className='text-xl'>⚠️</span>
                <div className='flex-1'>
                  <div className='font-bold text-amber-800 dark:text-amber-300 text-sm'>Potential Repetitive Expense</div>
                  <p className='text-sm text-amber-700 dark:text-amber-400 mt-1'>
                    {duplicateCheck.matches.length === 1
                      ? `A similar expense was posted against this asset on the same GL account ${Math.round((invoice.createdAt.getTime() - new Date(duplicateCheck.matches[0].transactionDate).getTime()) / 86400000)} day(s) ago.`
                      : `${duplicateCheck.matches.length} similar expenses were posted against this asset on the same GL account within the last ${duplicateCheck.windowDays} days.`}
                  </p>
                  <div className='mt-3 space-y-1.5'>
                    {duplicateCheck.matches.slice(0, 3).map((m) => (
                      <div key={m.id} className='text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2'>
                        <span className='font-mono'>{new Date(m.transactionDate).toLocaleDateString('en-NG')}</span>
                        <span>·</span>
                        <span>{m.invoiceNo ?? '—'}</span>
                        <span>·</span>
                        <span className='font-semibold'>₦{m.amount.toLocaleString()}</span>
                        <span>·</span>
                        <span>{m.vendorName ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {assetHistory && (
            <AssetCostHistorySection
              assetName={`${invoice.asset?.name} — ${invoice.asset?.assetNo}`}
              summary={assetHistory.summary}
              rows={assetHistory.rows}
            />
          )}

          <div className='bg-card border border-border rounded-2xl overflow-hidden'>
            <div className='px-6 py-4 border-b border-border'>
              <h2 className='font-bold text-foreground'>Line Items</h2>
            </div>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='bg-muted/40'>
                  <th className='px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
                    Description
                  </th>
                  <th className='px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
                    QTY
                  </th>
                  <th className='px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
                    Unit Cost (₦)
                  </th>
                  <th className='px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map(item => (
                  <tr key={item.id} className='border-t border-border'>
                    <td className='px-5 py-3 text-sm text-foreground'>
                      {item.description}
                    </td>
                    <td className='px-5 py-3 text-sm text-right text-foreground'>
                      {Number(item.quantity)}
                    </td>
                    <td className='px-5 py-3 text-sm text-right text-foreground'>
                      {fmtNGN(Number(item.unitCost))}
                    </td>
                    <td className='px-5 py-3 text-sm text-right font-semibold text-foreground'>
                      {fmtNGN(Number(item.totalCost))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className='border-t border-border p-6 space-y-2.5'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>
                  Subtotal (Line Items)
                </span>
                <span className='font-semibold text-foreground'>
                  {fmtNGN(subtotal)}
                </span>
              </div>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>
                  VAT @ {vatRate}% of Subtotal
                </span>
                <span className='text-foreground'>{fmtNGN(vatAmount)}</span>
              </div>
              <div className='flex justify-between text-sm font-semibold border-t border-border pt-2.5 mt-2.5'>
                <span className='text-foreground'>Total + VAT</span>
                <span className='text-foreground'>{fmtNGN(totalAmount)}</span>
              </div>
              <div className='flex justify-between text-sm'>
                <div>
                  <span className='text-red-600 dark:text-red-400 font-semibold'>
                    WHT — Withholding Tax @ {whtRate}% of Subtotal
                  </span>
                  <p className='text-xs text-muted-foreground'>
                    Deducted from vendor payment
                  </p>
                </div>
                <span className='text-red-600 dark:text-red-400 font-semibold'>
                  -{fmtNGN(whtAmount)}
                </span>
              </div>
              <div className='flex justify-between items-center border-t border-border pt-3 mt-1'>
                <div>
                  <span
                    className='font-extrabold text-base'
                    style={{ color: '#FFB800' }}
                  >
                    Amount Payable to Vendor
                  </span>
                  <p className='text-xs text-muted-foreground'>
                    Subtotal − WHT
                  </p>
                </div>
                <span
                  className='text-xl font-extrabold'
                  style={{ color: '#FFB800' }}
                >
                  {fmtNGN(amountPayable)}
                </span>
              </div>
            </div>
          </div>

          <LocalAttachmentsViewer attachmentsString={invoice.attachments} />
        </div>

        <div className='space-y-4'>
          {myPendingStep && (
            <ApprovalGLEditor
              invoiceId={params.id}
              invoiceAmount={Number(invoice.totalAmount)}
              currentGLCode={invoice.glAccount?.code}
              currentGLName={invoice.glAccount?.name}
              entityId={invoice.entityId}
              glOptions={formattedGLOptions}
            />
          )}

          <InvoiceApprovalSection
            invoiceId={params.id}
            instance={approvalInstance as any}
            myPendingStep={myPendingStep as any}
          />
        </div>
      </div>
    </div>
  )
}

function LocalAttachmentsViewer ({
  attachmentsString
}: {
  attachmentsString: string | null
}) {
  if (!attachmentsString) return null

  try {
    const parsedFiles = JSON.parse(attachmentsString)
    if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) return null

    return (
      <div className='bg-card border border-border rounded-2xl p-5 mt-4'>
        <h2 className='font-bold text-foreground mb-3 text-sm flex items-center gap-2'>
          📎 Supporting Documents
          <span className='text-xs font-normal text-muted-foreground'>
            ({parsedFiles.length})
          </span>
        </h2>
        <div className='flex flex-wrap gap-2'>
          {parsedFiles.map(
            (
              file: { name: string; url: string; size?: number; type?: string },
              i: number
            ) => {
              let downloadUrl = file.url

              if (
                file.url.includes('res.cloudinary.com') &&
                file.url.includes('/upload/')
              ) {
                downloadUrl = file.url.replace(
                  '/upload/',
                  '/upload/fl_attachment/'
                )
              }

              const nameLower = file.name?.toLowerCase() || ''
              let fileIcon = '📄'
              if (
                nameLower.endsWith('.xlsx') ||
                nameLower.endsWith('.xls') ||
                nameLower.endsWith('.csv')
              ) {
                fileIcon = '📊'
              } else if (
                nameLower.endsWith('.docx') ||
                nameLower.endsWith('.doc')
              ) {
                fileIcon = '📝'
              } else if (nameLower.endsWith('.pdf')) {
                fileIcon = '📕'
              } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(nameLower)) {
                fileIcon = '🖼️'
              }

              return (
                <a
                  key={file.url || i}
                  href={downloadUrl}
                  download={file.name || `Document-${i + 1}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='px-4 py-2 rounded-xl border border-border bg-muted text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer shadow-sm no-underline decoration-transparent'
                  title={`Download ${file.name}`}
                >
                  <span className='text-sm flex-shrink-0'>{fileIcon}</span>
                  <span className='text-left max-w-[200px] truncate'>
                    {file.name || `Document ${i + 1}`}
                  </span>
                </a>
              )
            }
          )}
        </div>
      </div>
    )
  } catch (e) {
    console.error('Failed to parse invoice attachments array safely:', e)
    return null
  }
}
