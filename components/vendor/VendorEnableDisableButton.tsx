'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  vendorId: string
  isActive: boolean
}

export default function VendorEnableDisableButton ({ vendorId, isActive }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle () {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })
      const ct = res.headers.get('content-type') ?? ''
      const d = ct.includes('application/json') ? await res.json() : null
      if (!res.ok) throw new Error(d?.error ?? `Server error (${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex flex-col items-end gap-1'>
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50 ${
          isActive
            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
            : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
        }`}
      >
        {loading && <Loader2 size={13} className='animate-spin' />}
        {isActive ? 'Disable' : 'Enable'}
      </button>
      {error && <p className='text-xs text-red-600 dark:text-red-400'>{error}</p>}
    </div>
  )
}
