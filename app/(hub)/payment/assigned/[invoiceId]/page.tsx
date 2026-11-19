import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { getTellerRoleIds } from '@/lib/payment-access'
import { prisma } from '@/lib/prisma'

import AssignPaymentForm from '@/components/payment/AssignPaymentForm'
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from '@/lib/invoice-type-labels'

export const metadata: Metadata = { title: 'Assign Payment — Addosser Hub' }

export default async function AssignPaymentPage ({
  params
}: {
  params: { invoiceId: string }
}) {
  await requireGranularPermission('payment', 'workflow', 'assign')
  await requireAuth()

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          email: true,
          bankName: true,
          bankAccountNo: true,
          bankAccountName: true
        }
      },
      entity: { select: { id: true, name: true, code: true } },
      submittedBy: { select: { name: true, email: true } }
    }
  })

  if (!invoice) notFound()

  if (
    invoice.approvalStatus !== 'FULLY_APPROVED' ||
    invoice.status !== 'APPROVED'
  ) {
    notFound()
  }

  const existingBatch = await prisma.paymentBatch.findFirst({
    where: {
      invoiceId: invoice.id,
      status: { not: 'CANCELLED' }
    }
  })
  if (existingBatch) notFound()

  const tellerRoleIds = await getTellerRoleIds()

  const tellers = await prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: tellerRoleIds },
      OR: [
        { entityId: invoice.entityId },
        { entityAccess: { some: { entityId: invoice.entityId } } }
      ]
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' }
  })

  const financials = {
    subtotal: invoice.subtotal.toString(),
    vatRate: invoice.vatRate.toString(),
    vatAmount: invoice.vatAmount.toString(),
    whtRate: invoice.whtRate.toString(),
    whtAmount: invoice.whtAmount.toString(),
    amountPayable: invoice.amountPayable.toString()
  }

  return (
    <div className='max-w-3xl mx-auto space-y-6'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Link href='/payment' className='hover:underline'>
          Payment Queue
        </Link>
        <span>/</span>
        <span>Assign Payment</span>
      </div>

      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          Assign Payment
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>
          Invoice{' '}
          <span className='font-semibold text-foreground'>
            {invoice.invoiceNo}
          </span>{' '}
          · {invoice.entity.name} ({invoice.entity.code})
        </p>
      </div>

      <div className='bg-card border border-border rounded-2xl p-5 grid grid-cols-2 gap-4 text-sm'>
        <div>
          <div className='text-xs text-muted-foreground mb-0.5'>Invoice Type</div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${INVOICE_TYPE_BADGE_CLASS[invoice.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
            {invoiceTypeLabel(invoice.invoiceType)}
          </span>
        </div>
        <div>
          <div className='text-xs text-muted-foreground mb-0.5'>Vendor</div>
          <div className='font-semibold text-foreground'>
            {invoice.vendor?.name ?? invoice.vendorName}
          </div>
        </div>
        <div>
          <div className='text-xs text-muted-foreground mb-0.5'>
            Amount Payable
          </div>
          <div className='font-extrabold font-mono text-[#FFB800]'>
            ₦
            {Number(invoice.amountPayable).toLocaleString('en-NG', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </div>
        </div>
        <div>
          <div className='text-xs text-muted-foreground mb-0.5'>
            Vendor Bank
          </div>
          <div className='font-semibold text-foreground'>
            {invoice.vendor?.bankName
              ? `${invoice.vendor.bankName} — ${
                  invoice.vendor.bankAccountNo ?? '—'
                }`
              : 'Not on file'}
          </div>
        </div>
        <div>
          <div className='text-xs text-muted-foreground mb-0.5'>
            Submitted By
          </div>
          <div className='font-semibold text-foreground'>
            {invoice.submittedBy.name}
          </div>
        </div>
        {invoice.vendor?.email && (
          <div className='col-span-2'>
            <div className='text-xs text-muted-foreground mb-0.5'>
              Vendor Email (receives payment confirmation)
            </div>
            <div className='font-semibold text-foreground'>
              {invoice.vendor.email}
            </div>
          </div>
        )}
      </div>

      {tellers.length === 0 ? (
        <div className='bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-sm'>
          <p className='font-bold text-amber-800 dark:text-amber-300 mb-2'>
            No Tellers available for {invoice.entity.name}
          </p>
          <p className='text-amber-700 dark:text-amber-400'>
            There are no active users with Teller access (canEdit on Payment
            Processing) for this entity. Ask your Administrator to assign the
            Teller role to at least one user before proceeding.
          </p>
        </div>
      ) : (
        <div className='bg-card border border-border rounded-2xl p-6'>
          <AssignPaymentForm
            invoiceId={invoice.id}
            invoiceNo={invoice.invoiceNo}
            vendorName={invoice.vendor?.name ?? invoice.vendorName}
            financials={financials}
            tellers={tellers}
          />
        </div>
      )}
    </div>
  )
}
