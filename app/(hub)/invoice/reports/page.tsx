import { Metadata } from 'next'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { formatCompact } from '@/lib/utils'
import { Badge } from '@/components/shared/Badge'
import { StatCard } from '@/components/shared/StatCard'
import InvoiceReportsClient from '@/components/invoice/InvoiceReportsClient'

export const metadata: Metadata = { title: 'Invoice Reports & Export' }

export default async function InvoiceReportsPage ({
  searchParams
}: {
  searchParams: {
    from?: string
    to?: string
    entity?: string
    status?: string
    type?: string
  }
}) {
  await requireGranularPermission('invoice', 'invoices', 'view')
  const user = await requireAuth()

  const now = new Date()
  const fromDate = searchParams.from
    ? new Date(searchParams.from)
    : new Date(now.getFullYear(), 0, 1)
  const toDate = searchParams.to ? new Date(searchParams.to) : now

  const entityFilter = searchParams.entity || undefined
  const statusFilter = searchParams.status || undefined
  const typeFilter = searchParams.type || undefined

  const invoiceScope = user.isSystem ? {} : { entityId: user.entityId }
  const entityScope = user.isSystem ? {} : { id: user.entityId }

  const [invoices, entities, glAccounts, summaryStats] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...invoiceScope,
        createdAt: { gte: fromDate, lte: toDate },
        ...(entityFilter ? { entityId: entityFilter } : {}),
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(typeFilter ? { invoiceType: typeFilter as any } : {})
      },
      include: {
        entity: { select: { name: true, code: true } },
        vendor: { select: { name: true } },
        submittedBy: { select: { name: true } },
        lineItems: {
          select: {
            description: true,
            quantity: true,
            unitCost: true,
            totalCost: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    }),

    prisma.entity.findMany({
      where: { isActive: true, ...entityScope },
      orderBy: { name: 'asc' }
    }),

    prisma.gLAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' }
    }),

    prisma.invoice.aggregate({
      where: { ...invoiceScope, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'REJECTED' } },
      _count: { id: true },
      _sum: {
        totalAmount: true,
        amountPayable: true,
        vatAmount: true,
        whtAmount: true
      }
    })
  ])
  const monthlyMap: Record<string, { count: number; amount: number }> = {}
  for (const inv of invoices) {
    if (inv.status === 'REJECTED') continue
    const key = inv.createdAt.toISOString().slice(0, 7)
    if (!monthlyMap[key]) monthlyMap[key] = { count: 0, amount: 0 }
    monthlyMap[key].count++
    monthlyMap[key].amount += Number(inv.totalAmount ?? 0)
  }

  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, count: v.count, amount: v.amount }))

  const statusBreakdown = invoices.reduce<Record<string, number>>(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] ?? 0) + 1
      return acc
    },
    {}
  )

  const exceptionalInvoices = invoices.filter(
    inv => inv.isExceptionalApproval || inv.isBudgetExceeded
  )

  const totalAmount = Number(summaryStats._sum.totalAmount ?? 0)
  const totalPayable = Number(summaryStats._sum.amountPayable ?? 0)
  const totalVAT = Number(summaryStats._sum.vatAmount ?? 0)
  const totalWHT = Number(summaryStats._sum.whtAmount ?? 0)
  const pendingCount = invoices.filter(i => i.status === 'PENDING').length
  const paidCount = invoices.filter(i => i.status === 'PAID').length

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-4'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Invoice Reports & Export
          </h1>
          <p className='text-muted-foreground text-sm mt-1'>
            Financial overview for the period{' '}
            <strong>
              {fromDate.toLocaleDateString('en-NG', { dateStyle: 'medium' })}
            </strong>{' '}
            —{' '}
            <strong>
              {toDate.toLocaleDateString('en-NG', { dateStyle: 'medium' })}
            </strong>
          </p>
        </div>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          label='Total Invoices'
          value={invoices.length}
          icon='🧾'
          color='#1B2A8A'
        />
        <StatCard
          label='Total Amount'
          value={formatCompact(totalAmount)}
          icon='💰'
          color='#FFB800'
        />
        <StatCard
          label='Pending Approval'
          value={pendingCount}
          icon='⏳'
          color='#d97706'
        />
        <StatCard label='Paid' value={paidCount} icon='✅' color='#16a34a' />
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          label='Total Payable (Net)'
          value={formatCompact(totalPayable)}
          icon='💳'
          color='#0284c7'
        />
        <StatCard
          label='Total VAT (7.5%)'
          value={formatCompact(totalVAT)}
          icon='📊'
          color='#7c3aed'
        />
        <StatCard
          label='Total WHT (2%)'
          value={formatCompact(totalWHT)}
          icon='📉'
          color='#dc2626'
        />
        <StatCard
          label='Exceptional Approvals'
          value={exceptionalInvoices.length}
          icon='⚠️'
          color='#dc2626'
        />
      </div>

      <div className='bg-card border border-border rounded-2xl p-6'>
        <h2 className='font-bold text-foreground mb-4'>Status Breakdown</h2>
        <div className='flex flex-wrap gap-3'>
          {Object.entries(statusBreakdown).map(([status, count]) => (
            <div
              key={status}
              className='flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-2'
            >
              <Badge
                variant={
                  status === 'PAID' || status === 'APPROVED'
                    ? 'green'
                    : status === 'PENDING'
                    ? 'yellow'
                    : status === 'REJECTED'
                    ? 'red'
                    : 'gray'
                }
              >
                {status.replace(/_/g, ' ')}
              </Badge>
              <span className='font-bold text-foreground text-sm'>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {exceptionalInvoices.length > 0 && (
        <div className='bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-6'>
          <h2 className='font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2'>
            ⚠️ Exceptional Expenditure Records — Negative Variance
          </h2>
          <p className='text-xs text-amber-700 dark:text-amber-500 mb-4'>
            {exceptionalInvoices.length} invoice
            {exceptionalInvoices.length !== 1 ? 's' : ''} were approved despite
            exceeding the GL budget. These are recorded as negative variances.
          </p>
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-sm'>
              <thead>
                <tr className='bg-amber-100 dark:bg-amber-900/30'>
                  {[
                    'Invoice ID',
                    'Entity',
                    'GL Account',
                    'Amount',
                    'Status',
                    'Submitter'
                  ].map(h => (
                    <th
                      key={h}
                      className='px-4 py-2 text-left text-xs font-bold text-amber-800 dark:text-amber-400 uppercase'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exceptionalInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    className='border-t border-amber-200 dark:border-amber-800'
                  >
                    <td className='px-4 py-2.5'>
                      <code className='text-xs font-bold text-amber-900 dark:text-amber-300'>
                        {inv.invoiceNo}
                      </code>
                    </td>
                    <td className='px-4 py-2.5 text-amber-900 dark:text-amber-300'>
                      {inv.entity?.name ?? '—'}
                    </td>
                    <td className='px-4 py-2.5 text-amber-900 dark:text-amber-300'>
                      {inv.glAccountCode ?? '—'}
                    </td>
                    <td className='px-4 py-2.5 font-bold text-amber-900 dark:text-amber-300'>
                      {formatCompact(Number(inv.totalAmount))}
                    </td>
                    <td className='px-4 py-2.5'>
                      <Badge
                        variant={inv.status === 'PAID' ? 'green' : 'yellow'}
                      >
                        {inv.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className='px-4 py-2.5 text-amber-900 dark:text-amber-300'>
                      {inv.submittedBy?.name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InvoiceReportsClient
        invoices={invoices.map(inv => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          invoiceType: inv.invoiceType,
          entityName: inv.entity?.name ?? '',
          entityCode: inv.entity?.code ?? '',
          vendorName: inv.vendor?.name ?? inv.vendorName,
          glCode: inv.glAccountCode ?? '',
          description: inv.description ?? '',
          subtotal: Number(inv.subtotal ?? 0),
          vatAmount: Number(inv.vatAmount ?? 0),
          whtAmount: Number(inv.whtAmount ?? 0),
          totalAmount: Number(inv.totalAmount ?? 0),
          amountPayable: Number(inv.amountPayable ?? 0),
          status: inv.status,
          dueDate: inv.dueDate?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
          submitterName: inv.submittedBy?.name ?? '',
          isExceptional: inv.isExceptionalApproval || inv.isBudgetExceeded
        }))}
        entities={entities}
        glAccounts={glAccounts}
        monthlyTrend={monthlyTrend}
        filters={{
          from: fromDate.toISOString().split('T')[0],
          to: toDate.toISOString().split('T')[0],
          entity: entityFilter ?? '',
          status: statusFilter ?? '',
          type: typeFilter ?? ''
        }}
      />
    </div>
  )
}
