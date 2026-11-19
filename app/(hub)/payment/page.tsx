import { Metadata } from 'next'
import Link from 'next/link'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { getPaymentQueue } from '@/lib/payment'
import { formatCompact } from '@/lib/utils'
import { Badge } from '@/components/shared/Badge'

export const metadata: Metadata = { title: 'Payment Queue' }

export default async function PaymentQueuePage () {
  await requireGranularPermission('payment', 'queue', 'view')
  const user = await requireAuth()

  const allowedEntityIds = user.isSystem ? null : user.allowedEntityIds
  const invoices = await getPaymentQueue(allowedEntityIds)

  const totalValue = invoices.reduce(
    (s, inv) => s + Number(inv.amountPayable),
    0
  )

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Payment Queue
          </h1>
          <p className='text-muted-foreground text-sm mt-1'>
            Fully approved invoices ready to be assigned for payment
          </p>
        </div>
        <Link
          href='/payment/my-tasks'
          className='text-sm font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'
        >
          My Teller Tasks →
        </Link>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-card border border-border rounded-2xl p-5 flex items-center gap-4'>
          <div className='w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-2xl'>
            💳
          </div>
          <div>
            <div className='text-2xl font-extrabold text-foreground'>
              {invoices.length}
            </div>
            <div className='text-xs text-muted-foreground'>
              Awaiting Assignment
            </div>
          </div>
        </div>
        <div className='bg-card border border-border rounded-2xl p-5 flex items-center gap-4'>
          <div className='w-12 h-12 rounded-xl bg-[#1B2A8A]/10 flex items-center justify-center text-2xl'>
            💰
          </div>
          <div>
            <div className='text-2xl font-extrabold text-foreground'>
              {formatCompact(totalValue)}
            </div>
            <div className='text-xs text-muted-foreground'>
              Total Value Pending
            </div>
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className='bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground'>
          <span className='text-5xl'>✅</span>
          <span className='font-bold text-foreground'>
            No invoices waiting for payment assignment
          </span>
          <p className='text-sm'>
            New invoices appear here as soon as they're fully approved.
          </p>
        </div>
      ) : (
        <div className='space-y-4'>
          {invoices.map(invoice => (
            <div
              key={invoice.id}
              className='bg-card border border-border rounded-2xl overflow-hidden'
            >
              <div className='px-6 py-4 flex items-start justify-between gap-4 flex-wrap'>
                <div>
                  <div className='flex items-center gap-2 mb-1 flex-wrap'>
                    <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded'>
                      {invoice.invoiceNo}
                    </code>
                    <Badge variant='green'>Fully Approved</Badge>
                  </div>
                  <h3 className='font-bold text-foreground'>
                    {invoice.vendor?.name ?? invoice.vendorName}
                  </h3>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    {invoice.entity.name} · Submitted by{' '}
                    {invoice.submittedBy.name}
                  </p>
                </div>
                <div className='text-right flex flex-col items-end gap-3'>
                  <div>
                    <div
                      className='text-2xl font-extrabold'
                      style={{ color: '#FFB800' }}
                    >
                      {formatCompact(Number(invoice.amountPayable))}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Amount Payable
                    </div>
                  </div>
                  <Link
                    href={`/payment/assigned/${invoice.id}`}
                    className='bg-[#1B2A8A] hover:bg-[#121E6B] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors'
                  >
                    Assign Teller →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
