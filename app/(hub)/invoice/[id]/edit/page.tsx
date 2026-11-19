import { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireGranularPermission, requireAuth } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import InvoiceForm from '@/components/invoice/InvoiceForm'

export const metadata: Metadata = { title: 'Edit Invoice' }

export default async function InvoiceEditPage ({
  params
}: {
  params: { id: string }
}) {
  await requireGranularPermission('invoice', 'invoices', 'edit')
  const user = await requireAuth()

  const currentYear = new Date().getFullYear()

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      vendor: true,
      asset: {
        select: {
          id: true,
          assetNo: true,
          name: true,
          condition: true,
          branch: {
            select: {
              name: true
            }
          }
        }
      },
      budgetEntity: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      lineItems: {
        orderBy: {
          sortOrder: 'asc'
        }
      },
      entity: {
        select: {
          name: true,
          code: true
        }
      },
      submittedBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  if (!invoice) notFound()

  if (invoice.submittedById !== user.id && !user.isSystem) {
    redirect(`/invoice/${params.id}`)
  }

  const locked = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'].includes(
    invoice.status
  )

  const [entities, vendors, glAccounts] = await Promise.all([
    prisma.entity.findMany({
      where: { isActive: true },
      include: {
        branches: { where: { isActive: true }, orderBy: { name: 'asc' } }
      },
      orderBy: { code: 'asc' }
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    }),
    prisma.gLAccount.findMany({
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
  ])
  const lineItems = invoice.lineItems.map(l => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity),
    unitCost: Number(l.unitCost),
    totalCost: Number(l.totalCost)
  }))

  let parsedAttachments = []
  if (invoice.attachments) {
    try {
      const jsonParsed = JSON.parse(invoice.attachments)
      if (Array.isArray(jsonParsed)) {
        parsedAttachments = jsonParsed
      }
    } catch (e) {
      console.error('Failed to parse invoice attachments JSON matrix:', e)
    }
  }

  const formattedGLAccounts = glAccounts.flatMap(gl =>
    gl.entityAccounts.map(ea => ({
      id: `${gl.id}_${ea.entityId}`,
      glAccountId: gl.id,
      budgetEntityId: ea.entityId,
      code: gl.code,
      name: `${gl.name} (${ea.entity.code})`,
      category: gl.category,
      budgetType: ea.budgets[0]?.budgetType,
      entityAccounts: gl.entityAccounts
    }))
  )

  const formattedData = {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    invoiceType: invoice.invoiceType,
    entityId: invoice.entityId,
    budgetEntityId: invoice.budgetEntityId ?? undefined,
    branchId: invoice.branchId ?? undefined,
    vendorId: invoice.vendorId ?? undefined,
    vendorName: invoice.vendorName,
    glAccountCode: invoice.glAccountCode ?? undefined,
    glAccountId: invoice.glAccountId ?? undefined,
    description: invoice.description ?? undefined,
    vatRate: Number(invoice.vatRate),
    whtRate: Number(invoice.whtRate),
    dueDate: invoice.dueDate
      ? new Date(invoice.dueDate).toISOString().split('T')[0]
      : undefined,
    lineItems,
    isExceptionalApproval: invoice.isExceptionalApproval,
    isBudgetExceeded: invoice.isBudgetExceeded,

    assetId: invoice.assetId ?? undefined,

    asset: invoice.asset
      ? {
          id: invoice.asset.id,
          assetNo: invoice.asset.assetNo,
          name: invoice.asset.name,
          condition: invoice.asset.condition,
          branchName: invoice.asset.branch?.name
        }
      : undefined,

    attachments: parsedAttachments
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Link href='/invoice' className='hover:text-foreground'>
          Invoice Processing
        </Link>
        <span>/</span>
        <Link href={`/invoice/${params.id}`} className='hover:text-foreground'>
          {invoice.invoiceNo}
        </Link>
        <span>/</span>
        <span className='text-foreground font-medium'>Edit</span>
      </div>

      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          Edit Invoice Requisition
        </h1>
        <p className='text-muted-foreground text-sm mt-1'>
          Invoice ID:{' '}
          <code className='bg-muted px-2 py-0.5 rounded text-xs font-bold'>
            {invoice.invoiceNo}
          </code>
          &nbsp;·&nbsp; {invoice.entity.name}
        </p>
      </div>

      {locked ? (
        <div className='bg-card border border-border rounded-2xl p-10 text-center'>
          <div className='text-5xl mb-4'>🔒</div>
          <h2 className='text-xl font-bold text-foreground mb-2'>
            Invoice Cannot Be Edited
          </h2>
          <p className='text-muted-foreground text-sm max-w-md mx-auto mb-6'>
            This invoice is currently{' '}
            <strong className='text-foreground'>
              {invoice.status.replace('_', ' ')}
            </strong>
            . Only <strong>DRAFT</strong> or <strong>RECALLED</strong> invoices
            can be edited.
          </p>
          <Link
            href={`/invoice/${params.id}`}
            className='inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent'
          >
            ← Back to Invoice
          </Link>
        </div>
      ) : (
        <InvoiceForm
          entities={entities as any}
          vendors={vendors as any[]}
          glAccounts={formattedGLAccounts as any}
          initialData={formattedData as any}
        />
      )}
    </div>
  )
}
