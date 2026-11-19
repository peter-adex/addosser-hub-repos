'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { isSafeReturnPath } from '@/lib/session-config'

export default function LoginForm () {
  const router = useRouter()
  const searchParams = useSearchParams()

  const requestedCallbackUrl = searchParams.get('callbackUrl')
  const callbackUrl = isSafeReturnPath(requestedCallbackUrl)
    ? requestedCallbackUrl
    : '/dashboard'

  const idleExpired = searchParams.get('reason') === 'idle'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email: email.toLowerCase(),
      password,
      redirect: false
    })

    if (res?.error) {
      setLoading(false)
      setError('Invalid email or password. Please try again.')
      return
    }

    const session = await getSession()
    const mfaStatus = (session?.user as any)?.mfaStatus

    if (mfaStatus === 'enrollment_required') {
      router.push(`/2fa/setup?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    } else if (mfaStatus === 'verification_required') {
      router.push(`/2fa/verify?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    } else {
      router.push(callbackUrl)
    }
    router.refresh()
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#1E2D45] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:border-transparent'

  return (
    <div
      className='min-h-screen flex'
      style={{
        background: 'linear-gradient(135deg, #0F1523 0%, #1B2A8A 100%)'
      }}
    >
      <div className='hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white'>
        <Image
          src='/logo.png'
          alt='Addosser'
          width={120}
          height={120}
          className='mb-8 rounded-2xl object-contain'
        />
        <h1 className='text-4xl font-extrabold mb-4 text-center leading-tight'>
          Addosser
          <br />
          Enterprise Hub
        </h1>
        <p className='text-white/60 text-lg text-center max-w-md'>
          Unified management platform for budgeting, assets, fleet, facilities
          and invoice processing.
        </p>
        <div className='mt-12 grid grid-cols-3 gap-5 w-full max-w-sm'>
          {[
            { icon: '📊', label: 'Budgeting' },
            { icon: '🏗️', label: 'Assets' },
            { icon: '🚗', label: 'Fleet' },
            { icon: '🏢', label: 'Facility' },
            { icon: '🧾', label: 'Invoices' },
            { icon: '⚙️', label: 'Admin' }
          ].map(item => (
            <div
              key={item.label}
              className='flex flex-col items-center gap-2 bg-white/5 rounded-xl p-4 border border-white/10'
            >
              <span className='text-2xl'>{item.icon}</span>
              <span className='text-xs text-white/70 font-medium'>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='w-full max-w-md bg-white dark:bg-[#1A2236] rounded-2xl shadow-2xl p-10'>
          <div className='flex items-center gap-3 mb-8 lg:hidden'>
            <Image
              src='/logo.png'
              alt='Addosser'
              width={48}
              height={48}
              className='rounded-xl object-contain'
            />
            <div>
              <div className='font-extrabold text-[#1B2A8A] text-lg'>
                ADDOSSER
              </div>
              <div className='text-xs text-gray-500 uppercase tracking-widest'>
                Enterprise Hub
              </div>
            </div>
          </div>

          <h2 className='text-2xl font-extrabold text-gray-900 dark:text-white mb-1'>
            Welcome back
          </h2>
          <p className='text-sm text-gray-500 dark:text-gray-400 mb-8'>
            Sign in to your account to continue
          </p>

          {idleExpired && !error && (
            <div className='mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium'>
              Your session has expired due to inactivity. Please log in again.
            </div>
          )}

          {error && (
            <div className='mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium'>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-5'>
            <div>
              <label className='block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5'>
                Email Address
              </label>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='you@addosser.com'
                required
                className={inputCls}
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='block text-xs font-bold text-gray-500 uppercase tracking-wider'>
                  Password
                </label>
                <Link
                  href='/forgot-password'
                  className='text-xs font-semibold text-[#1B2A8A] hover:underline dark:text-blue-400'
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
                required
                className={inputCls}
              />
            </div>

            <button
              type='submit'
              disabled={loading}
              className='w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60'
              style={{ background: '#FFB800', color: '#1B2A8A' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className='text-center text-xs text-gray-400 mt-6'>
            Don&apos;t have an account?{' '}
            <span className='font-semibold'>Contact your administrator.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
