'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePaymentCaps } from '@/hooks/usePaymentCaps'
import {
  Bell,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Send,
  Search,
  RotateCcw
} from 'lucide-react'

function naira (v: string | number | null | undefined): string {
  if (!v) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  if (!n) return '—'
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0
  }).format(n)}`
}

function fmtDateTime (d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isOverdue (d: string): boolean {
  return new Date(d) < new Date()
}

const FREQUENCIES = ['ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY'] as const
type Frequency = typeof FREQUENCIES[number]

interface Vendor {
  id: string
  name: string
  code?: string | null
}
interface Reminder {
  id: string
  title: string
  description: string | null
  amount: string | null
  reminderDate: string
  nextSendAt: string | null
  frequency: Frequency
  isActive: boolean
  lastSentAt: string | null
  notes: string | null
  additionalEmails: string | null
  failureCount?: number
  lastFailureReason?: string | null
  vendor: Vendor | null
}

const BLANK = {
  title: '',
  description: '',
  amount: '',
  vendorId: '',
  reminderDate: '',
  frequency: 'ONCE' as Frequency,
  notes: '',
  additionalEmails: ''
}

export default function PaymentRemindersPage () {
  const user = useCurrentUser()
  const caps = usePaymentCaps()
  const canManage = caps.canView('reminders')
  const perms = { canView: canManage, canCreate: canManage, canEdit: canManage, canDelete: canManage }

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [checkingNow, setCheckingNow] = useState(false)
  const [checkNowResult, setCheckNowResult] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const activeReminders = reminders.filter(r => r.isActive)
  const inactiveReminders = reminders.filter(r => !r.isActive)
  const overdueCount = activeReminders.filter(
    r => r.nextSendAt && isOverdue(r.nextSendAt)
  ).length

  const searchQuery = search.trim().toLowerCase()
  const matchesSearch = (r: Reminder) =>
    !searchQuery ||
    r.title.toLowerCase().includes(searchQuery) ||
    (r.notes ?? '').toLowerCase().includes(searchQuery) ||
    (r.vendor?.name ?? '').toLowerCase().includes(searchQuery)

  const visibleReminders = reminders
    .filter(r => {
      if (statusFilter === 'active') return r.isActive
      if (statusFilter === 'inactive') return !r.isActive
      return true
    })
    .filter(matchesSearch)

  const loadReminders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/reminders')
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(
          `Server error (${res.status}) — reminders API may be missing`
        )
      }
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed to load')
      setReminders(d.reminders ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/payment/vendors-lookup')
      .then(async res => {
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/json')) return
        const d = await res.json()
        setVendors(d.vendors ?? [])
      })
      .catch(() => {
      })
  }, [])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  useEffect(() => {
    if (!highlightId || reminders.length === 0) return
    const target = reminders.find(r => r.id === highlightId)
    if (!target) return

    const isVisible =
      (statusFilter === 'all' ||
        (statusFilter === 'active' && target.isActive) ||
        (statusFilter === 'inactive' && !target.isActive)) &&
      matchesSearch(target)

    if (!isVisible) {
      setStatusFilter('all')
      setSearch('')
      return
    }

    const el = document.getElementById(`reminder-${highlightId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(highlightId)
      const t = setTimeout(() => setHighlightedId(null), 4000)
      return () => clearTimeout(t)
    }
  }, [highlightId, reminders, statusFilter, searchQuery])

  function setF (key: keyof typeof BLANK, v: string) {
    setForm(f => ({ ...f, [key]: v }))
  }

  function openEdit (r: Reminder) {
    setEditingId(r.id)
    setForm({
      title: r.title,
      description: '',
      amount: r.amount ? String(Math.round(Number(r.amount))) : '',
      vendorId: r.vendor?.id ?? '',
      reminderDate: r.nextSendAt
        ? new Date(r.nextSendAt).toISOString().slice(0, 16)
        : new Date(r.reminderDate).toISOString().slice(0, 16),
      frequency: r.frequency,
      notes: r.notes ?? '',
      additionalEmails: r.additionalEmails ?? ''
    })
    setError('')
    setShowForm(true)
  }

  function closeForm () {
    setShowForm(false)
    setEditingId(null)
    setForm(BLANK)
    setError('')
  }

  async function handleSave () {
    setError('')
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    if (!form.reminderDate) {
      setError('Date and time are required.')
      return
    }
    if (form.amount && !/^\d+$/.test(form.amount)) {
      setError('Amount must be a whole number (no decimals).')
      return
    }

    setSaving(true)
    try {
      const isEdit = !!editingId
      const res = await fetch(
        isEdit ? `/api/payment/reminders/${editingId}` : '/api/payment/reminders',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim() || null,
            amount: form.amount ? parseInt(form.amount, 10) : null,
            vendorId: form.vendorId || null,
            reminderDate: new Date(form.reminderDate).toISOString(),
            frequency: form.frequency,
            notes: form.notes.trim() || null,
            additionalEmails: form.additionalEmails.trim() || null
          })
        }
      )

      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(
          `Server error (${res.status}) — please check the reminders API route`
        )
      }
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Save failed')

      setSuccess(isEdit ? 'Reminder updated successfully.' : 'Reminder created successfully.')
      closeForm()
      loadReminders()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckNow () {
    setCheckingNow(true)
    setCheckNowResult('')
    try {
      const res = await fetch('/api/cron/reminders', { method: 'POST' })
      const d = await res.json()
      if (!res.ok || d.success === false) {
        setCheckNowResult(`❌ ${d.error ?? d.message ?? 'Failed to check reminders'}`)
      } else {
        setCheckNowResult(
          `✅ Checked — ${d.processed ?? 0} due, ${d.sent ?? 0} sent, ${d.failed ?? 0} failed.`
        )
        loadReminders()
      }
    } catch {
      setCheckNowResult('❌ Network error — could not reach the server.')
    } finally {
      setCheckingNow(false)
    }
  }

  async function handleDelete (id: string) {
    if (!confirm('Deactivate this reminder?')) return
    await fetch(`/api/payment/reminders/${id}`, { method: 'DELETE' })
    loadReminders()
  }

  async function handleReactivate (id: string) {
    await fetch(`/api/payment/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true })
    })
    loadReminders()
  }

  if (!perms.canView) {
    return (
      <div className='flex flex-col items-center justify-center py-32 gap-3'>
        <AlertCircle size={40} className='text-red-500' />
        <p className='font-bold text-foreground'>Access Denied</p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Payment Reminders
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Schedule email + bell notifications before payments fall due
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={loadReminders}
            className='p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground'
            title='Refresh list'
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleCheckNow}
            disabled={checkingNow}
            title='Manually trigger the due-reminders check right now (useful when testing locally, since local dev has no external cron running)'
            className='flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border hover:bg-accent text-sm font-semibold text-foreground disabled:opacity-50'
          >
            {checkingNow ? (
              <Loader2 size={14} className='animate-spin' />
            ) : (
              <Send size={14} />
            )}
            Check Reminders Now
          </button>
          {perms.canCreate && (
            <button
              onClick={() => {
                setEditingId(null)
                setForm(BLANK)
                setShowForm(!showForm)
                setError('')
              }}
              className='flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-extrabold hover:bg-yellow-500'
            >
              <Plus size={14} /> New Reminder
            </button>
          )}
        </div>
      </div>

      {checkNowResult && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
            checkNowResult.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          {checkNowResult}
        </div>
      )}

      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[
          {
            label: 'Active',
            value: activeReminders.length,
            icon: '🔔',
            color: ''
          },
          {
            label: 'Overdue',
            value: overdueCount,
            icon: '⚠️',
            color: overdueCount > 0 ? 'text-red-600 dark:text-red-400' : ''
          },
          {
            label: 'Inactive',
            value: inactiveReminders.length,
            icon: '💤',
            color: ''
          },
          {
            label: 'Total Created',
            value: reminders.length,
            icon: '📋',
            color: ''
          }
        ].map(t => (
          <div
            key={t.label}
            className='bg-card border border-border rounded-2xl p-5'
          >
            <div className='text-2xl mb-2'>{t.icon}</div>
            <div
              className={`text-2xl font-extrabold ${
                t.color || 'text-foreground'
              }`}
            >
              {t.value}
            </div>
            <div className='text-xs text-muted-foreground mt-1'>{t.label}</div>
          </div>
        ))}
      </div>

      <div className='flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between'>
        <div className='relative flex-1 max-w-sm'>
          <Search
            size={14}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
          />
          <input
            type='text'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by title, notes or vendor…'
            className='w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
          />
        </div>
        <div className='flex gap-1 p-1 bg-card border border-border rounded-xl'>
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['inactive', 'Inactive']
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === key
                  ? 'bg-[#1B2A8A] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div className='px-4 py-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 flex justify-between'>
          {success}
          <button onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {showForm && (perms.canCreate || (editingId && perms.canEdit)) && (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-5 py-4 border-b border-border flex items-center gap-2'>
            <Bell size={16} className='text-[#FFB800]' />
            <h2 className='font-bold text-foreground'>
              {editingId ? 'Edit Payment Reminder' : 'Create Payment Reminder'}
            </h2>
          </div>
          <div className='p-5 space-y-4'>
            <div>
              <label className='block text-sm font-bold text-foreground mb-1.5'>
                Title <span className='text-red-500'>*</span>
              </label>
              <input
                value={form.title}
                onChange={e => setF('title', e.target.value)}
                placeholder='e.g. Pay Vendor ABC outstanding balance'
                className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-bold text-foreground mb-1.5'>
                  Amount{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional — whole ₦)
                  </span>
                </label>
                <div className='relative'>
                  <span className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm'>
                    ₦
                  </span>
                  <input
                    type='text'
                    inputMode='numeric'
                    pattern='[0-9]*'
                    value={form.amount}
                    onChange={e =>
                      setF('amount', e.target.value.replace(/[^\d]/g, ''))
                    }
                    placeholder='e.g. 500000'
                    className='w-full pl-7 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
                  />
                </div>
                {form.amount && (
                  <p className='text-xs text-[#FFB800] font-bold mt-1'>
                    {naira(form.amount)}
                  </p>
                )}
              </div>

              <div>
                <label className='block text-sm font-bold text-foreground mb-1.5'>
                  Vendor{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                </label>
                <select
                  value={form.vendorId}
                  onChange={e => setF('vendorId', e.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
                >
                  <option value=''>— Select vendor —</option>
                  {vendors.length === 0 && (
                    <option disabled>Loading vendors…</option>
                  )}
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-bold text-foreground mb-1.5'>
                  Reminder Date & Time <span className='text-red-500'>*</span>
                </label>
                <input
                  type='datetime-local'
                  value={form.reminderDate}
                  onChange={e => setF('reminderDate', e.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
                />
              </div>

              <div>
                <label className='block text-sm font-bold text-foreground mb-1.5'>
                  Frequency
                </label>
                <select
                  value={form.frequency}
                  onChange={e => setF('frequency', e.target.value as Frequency)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className='block text-sm font-bold text-foreground mb-1.5'>
                Additional Notification Emails{' '}
                <span className='text-muted-foreground font-normal'>
                  (optional — comma-separated)
                </span>
              </label>
              <input
                type='text'
                value={form.additionalEmails}
                onChange={e => setF('additionalEmails', e.target.value)}
                placeholder='finance@company.com, cfo@company.com'
                className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
              />
              <p className='text-xs text-muted-foreground mt-1'>
                Your account email will always receive the notification. Add
                extra emails here.
              </p>
            </div>

            <div>
              <label className='block text-sm font-bold text-foreground mb-1.5'>
                Notes{' '}
                <span className='text-muted-foreground font-normal'>
                  (optional)
                </span>
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                placeholder='Context or instructions…'
                className='w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] resize-none'
              />
            </div>

            {error && (
              <div className='px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
                {error}
              </div>
            )}

            <div className='flex gap-3'>
              <button
                onClick={handleSave}
                disabled={saving}
                className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] font-extrabold text-sm hover:bg-yellow-500 disabled:opacity-50'
              >
                {saving ? (
                  <Loader2 size={14} className='animate-spin' />
                ) : (
                  <Bell size={14} />
                )}
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Reminder'}
              </button>
              <button
                onClick={closeForm}
                className='px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className='flex items-center justify-center py-20 text-muted-foreground gap-2'>
          <Loader2 size={18} className='animate-spin' /> Loading…
        </div>
      ) : visibleReminders.length === 0 ? (
        <div className='bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground'>
          <Bell size={40} className='opacity-30' />
          <p className='font-bold text-foreground'>
            {searchQuery || statusFilter !== 'all'
              ? 'No reminders match your search/filter'
              : 'No reminders yet'}
          </p>
          <p className='text-sm'>
            {searchQuery || statusFilter !== 'all'
              ? 'Try a different keyword or switch the filter above.'
              : 'Create a reminder to get notified before payments fall due.'}
          </p>
        </div>
      ) : (
        <div className='bg-card border border-border rounded-2xl overflow-hidden'>
          <div className='px-5 py-3.5 border-b border-border flex items-center justify-between'>
            <h2 className='text-sm font-bold text-foreground'>
              Reminders
            </h2>
            <span className='text-xs text-muted-foreground'>
              {visibleReminders.length} of {reminders.length}
            </span>
          </div>
          <div className='divide-y divide-border'>
            {visibleReminders.map(r => {
              const overdue = r.isActive && r.nextSendAt ? isOverdue(r.nextSendAt) : false
              return (
                <div
                  key={r.id}
                  id={`reminder-${r.id}`}
                  className={`px-5 py-4 flex items-start justify-between gap-4 flex-wrap transition-colors duration-1000 ${
                    !r.isActive ? 'opacity-60' : ''
                  } ${
                    highlightedId === r.id
                      ? 'bg-[#FFB800]/20 ring-2 ring-[#FFB800] ring-inset'
                      : overdue
                      ? 'bg-red-50/40 dark:bg-red-950/10'
                      : ''
                  }`}
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1 flex-wrap'>
                      <p className='font-semibold text-foreground text-sm'>
                        {r.title}
                      </p>
                      {!r.isActive && (
                        <span className='px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border'>
                          Inactive
                        </span>
                      )}
                      {overdue && (
                        <span className='px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                          Overdue
                        </span>
                      )}
                      <span className='px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground'>
                        {r.frequency}
                      </span>
                    </div>
                    {r.vendor && (
                      <p className='text-xs text-muted-foreground'>
                        Vendor: {r.vendor.name}
                      </p>
                    )}
                    {r.notes && (
                      <p className='text-xs text-muted-foreground mt-0.5 line-clamp-2'>
                        {r.notes}
                      </p>
                    )}
                    <div className='flex items-center gap-4 mt-2 text-xs text-muted-foreground'>
                      <span className='flex items-center gap-1'>
                        <Calendar size={10} />
                        <strong
                          className={
                            overdue
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-foreground'
                          }
                        >
                          {fmtDateTime(r.nextSendAt ?? r.reminderDate)}
                        </strong>
                      </span>
                      {r.lastSentAt && (
                        <span>Last sent: {fmtDateTime(r.lastSentAt)}</span>
                      )}
                    </div>
                    {!r.isActive && r.lastFailureReason && (
                      <p className='text-xs text-red-600 dark:text-red-400 mt-1.5'>
                        ⚠️ Deactivated after {r.failureCount ?? 'repeated'} failed
                        send attempt(s): {r.lastFailureReason}
                      </p>
                    )}
                  </div>

                  <div className='flex items-center gap-4'>
                    {r.amount && (
                      <div className='text-right'>
                        <div className='text-sm font-extrabold font-mono text-[#FFB800]'>
                          {naira(r.amount)}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Amount
                        </div>
                      </div>
                    )}
                    {!r.isActive && perms.canEdit && (
                      <button
                        onClick={() => handleReactivate(r.id)}
                        className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400 transition-all'
                        title='Reactivate this reminder'
                      >
                        <RotateCcw size={12} /> Reactivate
                      </button>
                    )}
                    {perms.canEdit && (
                      <button
                        onClick={() => openEdit(r)}
                        className='p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground'
                        title='Edit reminder'
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {r.isActive && perms.canDelete && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        className='p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-muted-foreground hover:text-red-500'
                        title='Deactivate reminder'
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
