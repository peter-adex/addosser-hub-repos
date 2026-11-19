'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  X,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import VendorExportButton from './VendorExportButton'

interface Vendor {
  id: string
  name: string
  code: string | null
  email: string | null
  contactPerson: string | null
  phone: string | null
  isActive: boolean
  isApproved: boolean
  entity: { name: string; code: string } | null
}

async function fetchJSON (url: string) {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json'))
    throw new Error(`Server error (${res.status})`)
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Request failed')
  return d
}

interface Props {
  canCreate: boolean
}

export default function VendorManagementClient ({ canCreate }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (filter !== 'ALL') params.set('status', filter.toLowerCase())
      const d = await fetchJSON(`/api/vendors?${params}`)
      setVendors(d.vendors ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, filter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Vendor Management
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={load}
            className='p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground'
            title='Refresh'
          >
            <RefreshCw size={14} />
          </button>
          <VendorExportButton filters={{ search }} />
          {canCreate && (
            <Link
              href='/vendor/new'
              className='flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-extrabold hover:bg-yellow-500'
            >
              <Plus size={14} /> New Vendor
            </Link>
          )}
        </div>
      </div>

      <div className='flex gap-3 flex-wrap'>
        <div className='flex-1 min-w-[220px] relative'>
          <Search
            size={15}
            className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by name, code, email or TIN…'
            className='w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className='rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
        >
          <option value='ALL'>All Vendors</option>
          <option value='ACTIVE'>Active Only</option>
          <option value='APPROVED'>Approved Only</option>
          <option value='PENDING'>Pending Approval</option>
          <option value='INACTIVE'>Inactive</option>
        </select>
      </div>

      {loading && (
        <div className='flex items-center justify-center py-20 text-muted-foreground gap-2'>
          <Loader2 size={18} className='animate-spin' /> Loading vendors…
        </div>
      )}
      {!loading && error && (
        <div className='flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {!loading && !error && vendors.length === 0 && (
        <div className='bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground'>
          <Building2 size={40} className='opacity-30' />
          <p className='font-bold text-foreground'>No vendors found</p>
          {(search || filter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('')
                setFilter('ALL')
              }}
              className='text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline'
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && vendors.length > 0 && (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/30 text-xs text-muted-foreground uppercase'>
              <tr>
                <th className='text-left px-5 py-3'>Vendor</th>
                <th className='text-left px-5 py-3 hidden md:table-cell'>Code</th>
                <th className='text-left px-5 py-3 hidden lg:table-cell'>Entity</th>
                <th className='text-left px-5 py-3 hidden md:table-cell'>Contact</th>
                <th className='text-center px-5 py-3'>Status</th>
                <th className='text-left px-5 py-3'></th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {vendors.map(v => (
                <tr key={v.id} className='hover:bg-muted/20 transition-colors'>
                  <td className='px-5 py-4'>
                    <Link
                      href={`/vendor/${v.id}`}
                      className='font-semibold text-foreground hover:underline'
                    >
                      {v.name}
                    </Link>
                    {v.email && (
                      <div className='text-xs text-muted-foreground mt-0.5'>
                        {v.email}
                      </div>
                    )}
                  </td>
                  <td className='px-5 py-4 hidden md:table-cell'>
                    <code className='text-xs bg-muted px-2 py-0.5 rounded text-foreground'>
                      {v.code ?? '—'}
                    </code>
                  </td>
                  <td className='px-5 py-4 hidden lg:table-cell text-muted-foreground text-xs'>
                    {v.entity ? v.entity.code : 'Global'}
                  </td>
                  <td className='px-5 py-4 hidden md:table-cell text-muted-foreground text-xs'>
                    {v.contactPerson ?? v.phone ?? '—'}
                  </td>
                  <td className='px-5 py-4 text-center'>
                    <div className='flex flex-col items-center gap-1'>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          v.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {v.isApproved && (
                        <span className='px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
                          Approved
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-5 py-4'>
                    <div className='flex items-center gap-3'>
                      <Link
                        href={`/vendor/${v.id}`}
                        className='text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'
                      >
                        View
                      </Link>
                      <Link
                        href={`/vendor/${v.id}/account`}
                        className='flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground'
                      >
                        Account <ExternalLink size={10} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
