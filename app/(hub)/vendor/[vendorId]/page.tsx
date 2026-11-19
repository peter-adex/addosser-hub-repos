import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, ExternalLink, CheckCircle2 } from 'lucide-react'
import { requireAuth, hasGranularPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import VendorEnableDisableButton from '@/components/vendor/VendorEnableDisableButton'

export const metadata: Metadata = { title: 'Vendor Profile' }

export default async function VendorProfilePage ({
  params
}: {
  params: { vendorId: string }
}) {
  await requireAuth()
  const canView = await hasGranularPermission('vendor', 'list', 'view')
  if (!canView) redirect('/unauthorized')
  const canEdit = await hasGranularPermission('vendor', 'list', 'edit')

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    include: {
      entity: { select: { name: true, code: true } },
      createdBy: { select: { name: true, email: true } },
      _count: { select: { invoices: true } }
    }
  })
  if (!vendor) notFound()

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div key={label} className='flex justify-between gap-4 py-2 border-b border-border last:border-0'>
        <span className='text-muted-foreground text-sm'>{label}</span>
        <span className='font-medium text-foreground text-sm text-right'>{value}</span>
      </div>
    ) : null

  return (
    <div className='max-w-3xl mx-auto space-y-6 pb-16'>
      <Link
        href='/vendor'
        className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft size={14} /> Back to vendors
      </Link>

      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <div className='flex items-center gap-2 flex-wrap'>
            <h1 className='text-2xl font-extrabold text-foreground'>{vendor.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                vendor.isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {vendor.isActive ? 'Active' : 'Inactive'}
            </span>
            {vendor.isApproved && (
              <span className='px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1'>
                <CheckCircle2 size={11} /> Approved
              </span>
            )}
          </div>
          {vendor.code && (
            <code className='text-xs bg-muted px-2 py-0.5 rounded text-foreground mt-1.5 inline-block'>
              {vendor.code}
            </code>
          )}
        </div>
        {canEdit && (
          <div className='flex gap-2'>
            <Link
              href={`/vendor/${vendor.id}/edit`}
              className='flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-accent'
            >
              <Pencil size={13} /> Edit
            </Link>
            <VendorEnableDisableButton vendorId={vendor.id} isActive={vendor.isActive} />
          </div>
        )}
      </div>

      <section className='bg-card border border-border rounded-2xl p-6'>
        <h2 className='text-sm font-extrabold text-foreground uppercase tracking-wide mb-3'>
          Company Details
        </h2>
        <div>
          {row('Entity', vendor.entity ? `${vendor.entity.name} (${vendor.entity.code})` : 'Global — usable by any entity')}
          {row('Email', vendor.email)}
          {row('Phone', vendor.phone)}
          {row('Address', vendor.address)}
          {row('Website', vendor.website)}
          {row('TIN (Tax ID)', vendor.taxId)}
          {row('RC Number', vendor.rcNumber)}
        </div>
      </section>

      {(vendor.contactPerson || vendor.contactEmail || vendor.contactPhone) && (
        <section className='bg-card border border-border rounded-2xl p-6'>
          <h2 className='text-sm font-extrabold text-foreground uppercase tracking-wide mb-3'>
            Contact Person
          </h2>
          <div>
            {row('Name', vendor.contactPerson)}
            {row('Email', vendor.contactEmail)}
            {row('Phone', vendor.contactPhone)}
          </div>
        </section>
      )}

      {(vendor.bankName || vendor.bankAccountNo) && (
        <section className='bg-card border border-border rounded-2xl p-6'>
          <h2 className='text-sm font-extrabold text-foreground uppercase tracking-wide mb-3'>
            Bank Details
          </h2>
          <div>
            {row('Bank', vendor.bankName)}
            {row('Account No', vendor.bankAccountNo ? `****${vendor.bankAccountNo.slice(-4)}` : null)}
            {row('Account Name', vendor.bankAccountName)}
            {row('Sort Code', vendor.bankSortCode)}
          </div>
        </section>
      )}

      {vendor.contractFileUrl && (
        <section className='bg-card border border-border rounded-2xl p-6'>
          <h2 className='text-sm font-extrabold text-foreground uppercase tracking-wide mb-3'>
            Contract Agreement
          </h2>
          <a
            href={vendor.contractFileUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border text-sm font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline w-fit'
          >
            📎 {vendor.contractFileName ?? 'View Contract'}
          </a>
        </section>
      )}

      {vendor.notes && (
        <section className='bg-card border border-border rounded-2xl p-6'>
          <h2 className='text-sm font-extrabold text-foreground uppercase tracking-wide mb-3'>Notes</h2>
          <p className='text-sm text-muted-foreground whitespace-pre-wrap'>{vendor.notes}</p>
        </section>
      )}

      <section className='bg-card border border-border rounded-2xl p-6 space-y-4'>
        <div className='text-xs text-muted-foreground'>
          Registered by {vendor.createdBy?.name ?? 'Unknown'} · {vendor._count.invoices} invoice
          {vendor._count.invoices !== 1 ? 's' : ''} on file
        </div>
        <Link
          href={`/vendor/${vendor.id}/account`}
          className='flex items-center justify-between w-full px-4 py-3 bg-[#1B2A8A] text-white rounded-xl text-sm font-bold hover:bg-[#121E6B] transition-colors'
        >
          View Vendor Account & Payment History <ExternalLink size={16} />
        </Link>
      </section>
    </div>
  )
}
