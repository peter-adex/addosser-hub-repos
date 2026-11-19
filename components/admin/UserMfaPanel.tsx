'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/shared/Badge'

interface MfaStatus {
  twoFactorEnabled: boolean
  twoFactorEnrolledAt: string | null
  twoFactorVerifiedAt: string | null
  twoFactorResetAt: string | null
  twoFactorResetByAdmin: { id: string; name: string; email: string } | null
  twoFactorLockedUntil: string | null
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default function UserMfaPanel({
  userId,
  onToast
}: {
  userId: string
  onToast?: (msg: string, ok?: boolean) => void
}) {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'reset' | 'require_reverify' | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/mfa`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) setStatus(data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [userId])

  async function runAction(action: 'reset' | 'require_reverify') {
    setBusy(true)
    setConfirmAction(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onToast?.(data?.error ?? 'Action failed.', false)
        return
      }
      onToast?.(data.message ?? 'Done.')
      await load()
    } catch {
      onToast?.('Network error.', false)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className='text-xs text-muted-foreground'>Loading 2FA status…</p>
  }
  if (!status) {
    return <p className='text-xs text-muted-foreground'>2FA status unavailable.</p>
  }

  const locked = status.twoFactorLockedUntil && new Date(status.twoFactorLockedUntil) > new Date()

  return (
    <div className='border border-border rounded-xl p-4 bg-muted/20'>
      <div className='flex items-center justify-between mb-3'>
        <h4 className='text-xs font-bold text-muted-foreground uppercase tracking-wider'>
          Two-Factor Authentication
        </h4>
        {status.twoFactorEnabled ? (
          <Badge variant='green'>Enrolled</Badge>
        ) : (
          <Badge variant='gray'>Not enrolled</Badge>
        )}
      </div>

      <div className='space-y-1 text-xs text-muted-foreground mb-3'>
        <div>Last verified: {fmt(status.twoFactorVerifiedAt)}</div>
        <div>Enrolled at: {fmt(status.twoFactorEnrolledAt)}</div>
        <div>
          Last reset: {fmt(status.twoFactorResetAt)}
          {status.twoFactorResetByAdmin && ` by ${status.twoFactorResetByAdmin.name}`}
        </div>
        {locked && (
          <div className='text-red-600 font-semibold'>
            Locked until {fmt(status.twoFactorLockedUntil)} (too many failed attempts)
          </div>
        )}
      </div>

      <div className='flex gap-2'>
        <button
          type='button'
          disabled={busy || !status.twoFactorEnabled}
          onClick={() => setConfirmAction('require_reverify')}
          className='px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-accent disabled:opacity-50'
        >
          Require re-verification
        </button>
        <button
          type='button'
          disabled={busy || !status.twoFactorEnabled}
          onClick={() => setConfirmAction('reset')}
          className='px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50'
        >
          Reset 2FA
        </button>
      </div>

      {confirmAction && (
        <div className='fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl'>
            <p className='text-sm text-foreground mb-4'>
              {confirmAction === 'reset'
                ? 'This permanently invalidates the user\u2019s current authenticator secret and all recovery codes. They will be required to enroll again from scratch at their next login. Continue?'
                : 'The user will be asked to re-verify their 2FA code the next time they access the app. Continue?'}
            </p>
            <div className='flex gap-3 justify-end'>
              <button
                onClick={() => setConfirmAction(null)}
                className='px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
              <button
                onClick={() => runAction(confirmAction)}
                className='px-4 py-2 text-sm rounded-xl font-bold text-white bg-red-600 hover:bg-red-700'
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
