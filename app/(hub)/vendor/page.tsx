import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAuth, hasGranularPermission } from '@/lib/permissions'
import VendorManagementClient from '@/components/vendor/VendorManagementClient'

export const metadata: Metadata = { title: 'Vendor Management' }

export default async function VendorPage () {
  await requireAuth()

  const [canView, canCreate] = await Promise.all([
    hasGranularPermission('vendor', 'list', 'view'),
    hasGranularPermission('vendor', 'list', 'create')
  ])

  if (!canView) redirect('/unauthorized')

  return <VendorManagementClient canCreate={canCreate} />
}
