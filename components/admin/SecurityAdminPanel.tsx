'use client'

import { useEffect, useState } from 'react'

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
const labelCls =
  'block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'

export default function SecurityAdminPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState<number>(14)
  const [savedDays, setSavedDays] = useState<number>(14)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/security-settings')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error ?? 'Could not load security settings.')
          return
        }
        setDays(data.data.mfaReauthIntervalDays)
        setSavedDays(data.data.mfaReauthIntervalDays)
      } catch {
        setError('Network error while loading security settings.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/security-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaReauthIntervalDays: days })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not save security settings.')
        return
      }
      setSavedDays(data.data.mfaReauthIntervalDays)
      setMessage('Security settings updated.')
      setTimeout(() => setMessage(''), 3500)
    } catch {
      setError('Network error while saving security settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='bg-card border border-border rounded-2xl p-6'>
      <h3 className='font-bold text-foreground mb-1'>Security Policy</h3>
      <p className='text-xs text-muted-foreground mb-4'>
        Controls how often every user must re-enter their two-factor
        authentication code. Enrollment itself is mandatory for every user
        and cannot be disabled here.
      </p>

      {loading ? (
        <p className='text-sm text-muted-foreground'>Loading…</p>
      ) : (
        <>
          {error && (
            <div className='mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium'>
              {error}
            </div>
          )}
          {message && (
            <div className='mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium'>
              {message}
            </div>
          )}

          <div className='max-w-xs'>
            <label className={labelCls}>
              Require 2FA re-verification every (days)
            </label>
            <input
              type='number'
              min={1}
              max={365}
              className={inputCls}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
            <p className='text-xs text-muted-foreground mt-1.5'>
              A user won&apos;t be prompted again until this many days have
              passed since their last successful verification.
            </p>
          </div>

          <button
            onClick={save}
            disabled={saving || days === savedDays || !Number.isFinite(days) || days < 1 || days > 365}
            className='mt-4 px-5 py-2 text-sm rounded-xl font-bold disabled:opacity-60'
            style={{ background: '#FFB800', color: '#1B2A8A' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      )}
    </div>
  )
}
