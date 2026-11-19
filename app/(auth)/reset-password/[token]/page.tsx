'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'

export default function ResetPasswordPage () {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log({
      password,
      confirm
    })

    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      })
      const data = await res.json()

      if (!res.ok)
        throw new Error(
          data.error ?? 'Reset failed. The link may have expired.'
        )
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F1523] to-[#1B2A8A] p-8'>
      <div className='w-full max-w-md bg-white rounded-2xl shadow-2xl p-10'>
        <div className='flex items-center gap-3 mb-8'>
          <Image
            src='/logo.png'
            alt='Addosser'
            width={52}
            height={52}
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

        {done ? (
          <div className='text-center py-4'>
            <div className='text-5xl mb-4'>✅</div>
            <h2 className='text-xl font-extrabold text-gray-900 mb-2'>
              Password Reset!
            </h2>
            <p className='text-sm text-gray-500'>
              Your password has been updated. Redirecting to sign in…
            </p>
          </div>
        ) : (
          <>
            <h2 className='text-2xl font-extrabold text-gray-900 mb-1'>
              Set new password
            </h2>
            <p className='text-sm text-gray-500 mb-8'>
              Choose a strong password for your account.
            </p>

            {error && (
              <div className='mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium'>
                {error}
                {error.toLowerCase().includes('expired') && (
                  <div className='mt-2'>
                    <Link
                      href='/forgot-password'
                      className='underline font-bold'
                    >
                      Request a new reset link →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-5'>
              <div>
                <label className='block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5'>
                  New Password
                </label>
                <input
                  type='password'
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder='Min. 8 characters'
                  required
                  minLength={8}
                  className={inputCls}
                />
              </div>

              <div>
                <label className='block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5'>
                  Confirm New Password
                </label>
                <input
                  type='password'
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder='Repeat your new password'
                  required
                  className={inputCls}
                />
              </div>

              <ul className='text-xs text-gray-400 space-y-1 pl-1'>
                <li
                  className={
                    password.length >= 8 ? 'text-green-600 font-medium' : ''
                  }
                >
                  {password.length >= 8 ? '✓' : '○'} At least 8 characters
                </li>
                <li
                  className={
                    /[A-Z]/.test(password) ? 'text-green-600 font-medium' : ''
                  }
                >
                  {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                </li>
                <li
                  className={
                    /[0-9]/.test(password) ? 'text-green-600 font-medium' : ''
                  }
                >
                  {/[0-9]/.test(password) ? '✓' : '○'} One number
                </li>
              </ul>

              <button
                type='submit'
                disabled={loading}
                className='w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {loading ? 'Updating password…' : 'Reset Password'}
              </button>
            </form>

            <p className='text-center text-xs text-gray-400 mt-6'>
              Remember your password?{' '}
              <Link
                href='/login'
                className='font-semibold text-[#1B2A8A] hover:underline'
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
