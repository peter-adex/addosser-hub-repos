import { Metadata } from 'next'
import Link from 'next/link'
import { requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { formatCompact } from '@/lib/utils'
import { StatCard } from '@/components/shared/StatCard'
import InvoiceListClient from '@/components/invoice/InvoiceListClient'

export const metadata: Metadata = { title: 'Fuel Payment Processing' }

export const dynamic = 'force-dynamic'

export default async function FleetFuelPage ({
  searchParams
}: {
  searchParams: { status?: string; q?: string }
}) {
  const user = await requireAuth()

  const allowedEntities = user.allowedEntityIds?.length
    ? user.allowedEntityIds
    : [user.entityId]

  const statusFilter = searchParams.status
  const q = searchParams.q?.trim()

  const where: any = {
    invoiceType: 'FLEET_FUEL',
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: 'insensitive' } },
            { vendorName: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        }
      : {}),
    ...(user.isSystem
      ? {}
      : {
          AND: [
            { entityId: { in: allowedEntities } },
            {
              OR: [
                { status: { notIn: ['DRAFT', 'RECALLED'] } },
                { submittedById: user.id }
              ]
            }
          ]
        })
  }

  const activeApprovalSteps = await prisma.approvalInstance.findMany({
    where: {
      resourceType: 'Invoice',
      status: 'IN_PROGRESS',
      steps: { some: { userId: user.id, status: 'PENDING' } }
    },
    select: { resourceId: true }
  })
  const actionableInvoiceIds = new Set(activeApprovalSteps.map(s => s.resourceId))

  const [invoices, kpis] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        entity: { select: { name: true, code: true } },
        vendor: { select: { name: true } },
        submittedBy: { select: { name: true, email: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        glAccount: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: user.isSystem
        ? { invoiceType: 'FLEET_FUEL' }
        : { invoiceType: 'FLEET_FUEL', entityId: { in: allowedEntities } },
      _count: true,
      _sum: { amountPayable: true }
    })
  ])

  const pending = kpis.find(k => k.status === 'PENDING')?._count ?? 0
  const approved = kpis.find(k => k.status === 'APPROVED')?._count ?? 0
  const paid = kpis.find(k => k.status === 'PAID')?._count ?? 0
  const totalPayable = kpis.reduce((s, k) => s + Number(k._sum.amountPayable ?? 0), 0)
  const myPendingApprovalCount = invoices.filter(
    inv => inv.status === 'PENDING' && actionableInvoiceIds.has(inv.id)
  ).length

  const pendingInvoiceIds = invoices.filter(inv => inv.status === 'PENDING').map(inv => inv.id)
  const approvalInstanceMap: Record<string, boolean> = {}
  if (pendingInvoiceIds.length > 0) {
    const instances = await prisma.approvalInstance.findMany({
      where: { resourceId: { in: pendingInvoiceIds } },
      include: { steps: { select: { status: true } } }
    })
    for (const inst of instances) {
      approvalInstanceMap[inst.resourceId] = inst.steps.every(s =>
        ['PENDING', 'WAITING'].includes(s.status)
      )
    }
  }
  const enrichedInvoices = invoices.map(inv => ({
    ...inv,
    noStepActioned: approvalInstanceMap[inv.id] ?? true
  }))

  const canApproveInvoice = await import('@/lib/permissions')
    .then(m => m.hasGranularPermission('invoice', 'approvals', 'approve'))
    .catch(() => false)

  const shouldHideCreateButton = canApproveInvoice && !user.isSystem && user.roleName !== 'Super Admin'

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between flex-wrap gap-4'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>Fuel Payment Processing</h1>
          <p className='text-muted-foreground text-sm mt-1'>
            Fuel requests — creation, approval, payment and reporting
          </p>
        </div>
        {!shouldHideCreateButton && (
          <Link
            href='/fleet/fuel/new'
            className='px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90'
            style={{ background: '#FFB800', color: '#1B2A8A' }}
          >
            ＋ New Fuel Payment
          </Link>
        )}
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard label='Pending Approval' value={pending} icon='⏳' color='#d97706' />
        <StatCard
          label='Awaiting My Action'
          value={myPendingApprovalCount}
          icon='📥'
          color='#dc2626'
        />
        <StatCard label='Approved' value={approved} icon='✅' color='#16a34a' />
        <StatCard label='Paid' value={paid} icon='💳' color='#1B2A8A' />
        <StatCard
          label='Total Payable'
          value={formatCompact(totalPayable)}
          icon='⛽'
          color='#7c3aed'
        />
      </div>

      <InvoiceListClient
        initialInvoices={enrichedInvoices as any}
        currentUserId={user.id}
        canApprove={canApproveInvoice}
      />
    </div>
  )
}
