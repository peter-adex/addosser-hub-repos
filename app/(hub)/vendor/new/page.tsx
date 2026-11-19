import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth, hasGranularPermission } from '@/lib/permissions'
import VendorForm, { VendorFormData } from '@/components/vendor/VendorForm'

export const metadata: Metadata = { title: 'New Vendor' }

const BLANK: VendorFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  taxId: '',
  rcNumber: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  bankSortCode: '',
  notes: '',
  contractFileUrl: '',
  contractFileName: '',
  isApproved: false
}

export default async function NewVendorPage () {
  await requireAuth()
  const canCreate = await hasGranularPermission('vendor', 'list', 'create')
  if (!canCreate) redirect('/unauthorized')

  return <VendorForm mode='create' initial={BLANK} />
}
