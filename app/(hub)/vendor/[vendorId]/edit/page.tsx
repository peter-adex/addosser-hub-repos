import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireAuth, hasGranularPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import VendorForm, { VendorFormData } from '@/components/vendor/VendorForm'

export const metadata: Metadata = { title: 'Edit Vendor' }

export default async function EditVendorPage ({
  params
}: {
  params: { vendorId: string }
}) {
  await requireAuth()
  const canEdit = await hasGranularPermission('vendor', 'list', 'edit')
  if (!canEdit) redirect('/unauthorized')

  const vendor = await prisma.vendor.findUnique({ where: { id: params.vendorId } })
  if (!vendor) notFound()

  const initial: VendorFormData = {
    name: vendor.name ?? '',
    email: vendor.email ?? '',
    phone: vendor.phone ?? '',
    address: vendor.address ?? '',
    website: vendor.website ?? '',
    taxId: vendor.taxId ?? '',
    rcNumber: vendor.rcNumber ?? '',
    contactPerson: vendor.contactPerson ?? '',
    contactEmail: vendor.contactEmail ?? '',
    contactPhone: vendor.contactPhone ?? '',
    bankName: vendor.bankName ?? '',
    bankAccountNo: vendor.bankAccountNo ?? '',
    bankAccountName: vendor.bankAccountName ?? '',
    bankSortCode: vendor.bankSortCode ?? '',
    notes: vendor.notes ?? '',
    contractFileUrl: vendor.contractFileUrl ?? '',
    contractFileName: vendor.contractFileName ?? '',
    isApproved: vendor.isApproved
  }

  return <VendorForm mode='edit' vendorId={vendor.id} initial={initial} />
}
