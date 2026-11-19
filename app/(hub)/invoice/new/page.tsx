import { Metadata } from 'next'
import Link from 'next/link'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import InvoiceForm from '@/components/invoice/InvoiceForm'

export const metadata: Metadata = { title: 'New Invoice' }

export default async function NewInvoicePage () {
  await requireGranularPermission('invoice', 'invoices', 'create')
  const user = await requireAuth()

  const userAdditionalEntities = await prisma.userEntity.findMany({
    where: { userId: user.id },
    select: { entityId: true }
  })

  const allowedEntityIds = Array.from(
    new Set([user.entityId, ...userAdditionalEntities.map(e => e.entityId)])
  )

  const [entities, vendors] = await Promise.all([
    prisma.entity.findMany({
      where: {
        isActive: true,
        ...(user.isSystem ? {} : { id: { in: allowedEntityIds } })
      },
      orderBy: { code: 'asc' }
    }),

    prisma.vendor.findMany({
      where: {
        isActive: true,
        ...(user.isSystem ? {} : { entityId: { in: allowedEntityIds } })
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        contactPerson: true,
        contactEmail: true,
        contactPhone: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
        taxId: true
      }
    })
  ])

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Link
          href='/invoice'
          className='hover:text-foreground transition-colors'
        >
          Invoice Processing
        </Link>
        <span>/</span>
        <span className='text-foreground font-medium'>New Invoice</span>
      </div>

      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          Submit Invoice Requisition
        </h1>
        <p className='text-muted-foreground text-sm mt-1'>
          Create a new vendor invoice for approval. All invoices go through the
          configured approval workflow before payment.
        </p>
      </div>

      <InvoiceForm entities={entities} vendors={vendors as any[]} />
    </div>
  )
}
