'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Fuel,
  History,
  Loader2,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Save,
  Trash2,
  Check
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import { useEntities } from '@/lib/hooks/useApi'

const REMINDER_DAY_OPTIONS = [20, 15, 10, 5] as const
const CRITICAL_INTERVAL_OPTIONS = [2, 3, 5, 7] as const

interface Settings {
  enableExpiryNotifications: boolean
  reminderDaysBeforeExpiry: number[]
  notifyAssignedUser: boolean
  notifyDefaultRecipients: boolean
  defaultRecipients: string[]
  enableCriticalNotifications: boolean
  criticalIntervalDays: number
}

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition disabled:opacity-60 disabled:cursor-not-allowed'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sameSettings (a: Settings, b: Settings) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function Toggle ({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-brand-navy' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

function Section ({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className='bg-card border border-border rounded-2xl p-5 mb-4'>
      <h3 className='text-[14px] font-semibold text-foreground'>{title}</h3>
      {description && (
        <p className='text-[12px] text-muted-foreground mt-0.5 mb-4'>{description}</p>
      )}
      {!description && <div className='mb-4' />}
      {children}
    </section>
  )
}

function Row ({
  label,
  hint,
  control
}: {
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div className='flex items-start justify-between gap-6 py-3 border-t border-border first:border-t-0 first:pt-0'>
      <div className='min-w-0'>
        <p className='text-[13px] font-medium text-foreground'>{label}</p>
        {hint && <p className='text-[11.5px] text-muted-foreground mt-0.5'>{hint}</p>}
      </div>
      <div className='flex-shrink-0 pt-0.5'>{control}</div>
    </div>
  )
}

export default function FleetSettingsPage () {
  return (
    <PermissionGuard module='fleet-settings' action='canView'>
      <FleetSettingsContent />
    </PermissionGuard>
  )
}

function FleetSettingsContent () {
  const perms = usePagePermissions('fleet-settings')
  const canEdit = perms.canEdit

  const [saved, setSaved] = useState<Settings | null>(null)
  const [form, setForm] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [tab, setTab] = useState<'notifications' | 'fuel' | 'history'>('notifications')
  const [newEmail, setNewEmail] = useState('')
  const [newEmailError, setNewEmailError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/fleet/settings', {
        credentials: 'include',
        cache: 'no-store'
      })
      const json = await res.json()
      if (!res.ok) {
        setLoadError(json.error ?? 'Failed to load settings')
        return
      }
      const d = json.data
      const s: Settings = {
        enableExpiryNotifications: d.enableExpiryNotifications,
        reminderDaysBeforeExpiry: d.reminderDaysBeforeExpiry ?? [],
        notifyAssignedUser: d.notifyAssignedUser,
        notifyDefaultRecipients: d.notifyDefaultRecipients,
        defaultRecipients: d.defaultRecipients ?? [],
        enableCriticalNotifications: d.enableCriticalNotifications,
        criticalIntervalDays: d.criticalIntervalDays
      }
      setSaved(s)
      setForm(s)
    } catch {
      setLoadError('Network error — could not load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(
    () => !!form && !!saved && !sameSettings(form, saved),
    [form, saved]
  )

  const recipientErrors = useMemo(() => {
    const errs: Record<number, string> = {}
    if (!form) return errs
    const seen = new Map<string, number>()
    form.defaultRecipients.forEach((raw, i) => {
      const e = raw.trim().toLowerCase()
      if (!EMAIL_RE.test(e)) errs[i] = 'Enter a valid email address'
      else if (seen.has(e)) errs[i] = 'Duplicate address'
      else seen.set(e, i)
    })
    return errs
  }, [form])

  const hasRecipientErrors = Object.keys(recipientErrors).length > 0

  function patch (p: Partial<Settings>) {
    setForm(f => (f ? { ...f, ...p } : f))
    setSavedAt(null)
  }

  function toggleDay (d: number) {
    if (!form) return
    const has = form.reminderDaysBeforeExpiry.includes(d)
    patch({
      reminderDaysBeforeExpiry: has
        ? form.reminderDaysBeforeExpiry.filter(x => x !== d)
        : [...form.reminderDaysBeforeExpiry, d].sort((a, b) => b - a)
    })
  }

  function addRecipient () {
    if (!form) return
    const e = newEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      setNewEmailError('Enter a valid email address')
      return
    }
    if (form.defaultRecipients.some(x => x.trim().toLowerCase() === e)) {
      setNewEmailError('That address is already in the list')
      return
    }
    patch({ defaultRecipients: [...form.defaultRecipients, e] })
    setNewEmail('')
    setNewEmailError('')
  }

  const clientIssues = useMemo(() => {
    const issues: string[] = []
    if (!form) return issues
    if (form.enableExpiryNotifications && form.reminderDaysBeforeExpiry.length === 0)
      issues.push('Select at least one reminder interval while expiry notifications are enabled.')
    const hasRoute =
      form.notifyAssignedUser ||
      (form.notifyDefaultRecipients && form.defaultRecipients.length > 0)
    if ((form.enableExpiryNotifications || form.enableCriticalNotifications) && !hasRoute)
      issues.push(
        'Notifications are on but nobody would receive them — enable assigned-user notifications, or enable default recipients and add at least one address.'
      )
    return issues
  }, [form])

  async function save () {
    if (!form || !canEdit) return
    setSaving(true)
    setSaveError([])
    try {
      const res = await fetch('/api/fleet/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          defaultRecipients: form.defaultRecipients.map(e => e.trim().toLowerCase())
        })
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(
          Array.isArray(json.details) && json.details.length
            ? json.details
            : [json.error ?? 'Failed to save settings']
        )
        return
      }
      const d = json.data
      const s: Settings = {
        enableExpiryNotifications: d.enableExpiryNotifications,
        reminderDaysBeforeExpiry: d.reminderDaysBeforeExpiry ?? [],
        notifyAssignedUser: d.notifyAssignedUser,
        notifyDefaultRecipients: d.notifyDefaultRecipients,
        defaultRecipients: d.defaultRecipients ?? [],
        enableCriticalNotifications: d.enableCriticalNotifications,
        criticalIntervalDays: d.criticalIntervalDays
      }
      setSaved(s)
      setForm(s)
      setSavedAt(Date.now())
    } catch {
      setSaveError(['Network error — your changes were not saved.'])
    } finally {
      setSaving(false)
    }
  }

  const locked = !canEdit || saving

  return (
    <div className='animate-fade-in max-w-3xl'>
      <PageHeader
        title='Fleet Settings'
        subtitle='Configure how and when vehicle document expiry notifications are sent'
      />

      <div className='flex gap-1 border-b border-border mb-5' role='tablist'>
        {([
          ['notifications', 'Notifications', Bell],
          ['fuel', 'Fuel', Fuel],
          ['history', 'History', History]
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            role='tab'
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'text-brand-navy dark:text-brand-gold border-brand-navy dark:border-brand-gold'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'fuel' && <FuelEntitlementSettings canEdit={canEdit} />}

      {tab === 'history' && <NotificationHistory />}

      {tab !== 'notifications' ? null : loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 size={22} className='animate-spin text-muted-foreground' />
        </div>
      ) : loadError || !form ? (
        <div className='rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-[13px] text-red-700 dark:text-red-400 flex items-center justify-between gap-3'>
          <span>{loadError || 'Could not load settings'}</span>
          <button
            onClick={load}
            className='rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-[12px] font-medium hover:bg-red-100 dark:hover:bg-red-950/50'
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {!canEdit && (
            <div className='mb-4 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground'>
              You have view-only access. Contact an administrator to change these settings.
            </div>
          )}

          <Section
            title='Vehicle Document Expiry Notifications'
            description='Send a reminder before a vehicle document expires.'
          >
            <Row
              label='Enable expiry notifications'
              hint='When off, no reminder emails are sent.'
              control={
                <Toggle
                  label='Enable expiry notifications'
                  checked={form.enableExpiryNotifications}
                  disabled={locked}
                  onChange={v => patch({ enableExpiryNotifications: v })}
                />
              }
            />
            <div
              className={`pt-3 border-t border-border ${
                form.enableExpiryNotifications ? '' : 'opacity-50'
              }`}
            >
              <p className='text-[13px] font-medium text-foreground mb-2'>
                Notify before expiry
              </p>
              <div className='flex flex-wrap gap-2'>
                {REMINDER_DAY_OPTIONS.map(d => {
                  const on = form.reminderDaysBeforeExpiry.includes(d)
                  return (
                    <label
                      key={d}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] cursor-pointer select-none transition-colors ${
                        on
                          ? 'border-brand-navy bg-brand-navy/5 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      } ${locked || !form.enableExpiryNotifications ? 'pointer-events-none' : ''}`}
                    >
                      <input
                        type='checkbox'
                        checked={on}
                        disabled={locked || !form.enableExpiryNotifications}
                        onChange={() => toggleDay(d)}
                        className='h-4 w-4 rounded border-border'
                      />
                      {d} days before
                    </label>
                  )
                })}
              </div>
              <p className='text-[11.5px] text-muted-foreground mt-2'>
                Multiple intervals can be enabled — e.g. 20, 10 and 5 days sends
                three reminders for the same document.
              </p>
            </div>
          </Section>

          <Section
            title='Recipients'
            description='Who receives document expiry and critical notifications.'
          >
            <Row
              label='Notify assigned driver / staff'
              hint='Sent to the vehicle’s assigned user when they have an email address on file.'
              control={
                <Toggle
                  label='Notify assigned user'
                  checked={form.notifyAssignedUser}
                  disabled={locked}
                  onChange={v => patch({ notifyAssignedUser: v })}
                />
              }
            />
            <Row
              label='Also notify default Fleet recipients'
              hint='The addresses below. If the assigned user is also in this list they only receive one email.'
              control={
                <Toggle
                  label='Notify default recipients'
                  checked={form.notifyDefaultRecipients}
                  disabled={locked}
                  onChange={v => patch({ notifyDefaultRecipients: v })}
                />
              }
            />

            <div
              className={`pt-3 border-t border-border ${
                form.notifyDefaultRecipients ? '' : 'opacity-50'
              }`}
            >
              <p className='text-[13px] font-medium text-foreground mb-2'>
                Default Fleet notification recipients
              </p>

              {form.defaultRecipients.length === 0 ? (
                <p className='text-[12px] text-muted-foreground mb-3'>
                  No default recipients yet.
                </p>
              ) : (
                <ul className='space-y-2 mb-3'>
                  {form.defaultRecipients.map((email, i) => (
                    <li key={i}>
                      <div className='flex items-center gap-2'>
                        <input
                          type='email'
                          className={`${INP} ${
                            recipientErrors[i] ? 'border-red-400 focus:ring-red-300' : ''
                          }`}
                          value={email}
                          disabled={locked}
                          aria-label={`Recipient ${i + 1}`}
                          aria-invalid={!!recipientErrors[i]}
                          onChange={e =>
                            patch({
                              defaultRecipients: form.defaultRecipients.map((x, j) =>
                                j === i ? e.target.value : x
                              )
                            })
                          }
                        />
                        <button
                          type='button'
                          disabled={locked}
                          onClick={() =>
                            patch({
                              defaultRecipients: form.defaultRecipients.filter(
                                (_, j) => j !== i
                              )
                            })
                          }
                          className='h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                          title='Remove recipient'
                          aria-label={`Remove recipient ${i + 1}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {recipientErrors[i] && (
                        <p className='text-[11px] text-red-500 mt-1'>{recipientErrors[i]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className='flex items-start gap-2'>
                <div className='flex-1'>
                  <input
                    type='email'
                    className={`${INP} ${newEmailError ? 'border-red-400 focus:ring-red-300' : ''}`}
                    placeholder='name@company.com'
                    value={newEmail}
                    disabled={locked}
                    onChange={e => {
                      setNewEmail(e.target.value)
                      setNewEmailError('')
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRecipient()
                      }
                    }}
                  />
                  {newEmailError && (
                    <p className='text-[11px] text-red-500 mt-1'>{newEmailError}</p>
                  )}
                </div>
                <button
                  type='button'
                  disabled={locked || !newEmail.trim()}
                  onClick={addRecipient}
                  className='inline-flex items-center gap-1.5 h-9 rounded-lg border border-border px-3 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <Plus size={13} /> Add recipient
                </button>
              </div>
            </div>
          </Section>

          <Section
            title='Critical Expired Document Notifications'
            description='When a document has expired and has not been renewed, send a critical notice until the new expiry date is recorded.'
          >
            <Row
              label='Enable critical notifications'
              hint='When off, expired documents do not trigger any email.'
              control={
                <Toggle
                  label='Enable critical notifications'
                  checked={form.enableCriticalNotifications}
                  disabled={locked}
                  onChange={v => patch({ enableCriticalNotifications: v })}
                />
              }
            />
            <div
              className={`pt-3 border-t border-border ${
                form.enableCriticalNotifications ? '' : 'opacity-50'
              }`}
            >
              <p className='text-[13px] font-medium text-foreground mb-2'>
                Repeat critical notification
              </p>
              <div
                role='radiogroup'
                aria-label='Repeat critical notification'
                className='flex flex-wrap gap-2'
              >
                {CRITICAL_INTERVAL_OPTIONS.map(n => {
                  const on = form.criticalIntervalDays === n
                  return (
                    <label
                      key={n}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] cursor-pointer select-none transition-colors ${
                        on
                          ? 'border-brand-navy bg-brand-navy/5 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      } ${
                        locked || !form.enableCriticalNotifications
                          ? 'pointer-events-none'
                          : ''
                      }`}
                    >
                      <input
                        type='radio'
                        name='criticalInterval'
                        checked={on}
                        disabled={locked || !form.enableCriticalNotifications}
                        onChange={() => patch({ criticalIntervalDays: n })}
                        className='h-4 w-4'
                      />
                      Every {n} days
                    </label>
                  )
                })}
              </div>
              <p className='text-[11.5px] text-muted-foreground mt-2'>
                The notice repeats at this interval and continues until the
                document’s expiry date is updated to a future date — it stops
                automatically once renewed.
              </p>
            </div>
          </Section>

          {(clientIssues.length > 0 || hasRecipientErrors) && dirty && (
            <div className='mb-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[12.5px] text-amber-800 dark:text-amber-300 flex gap-2'>
              <AlertTriangle size={15} className='flex-shrink-0 mt-0.5' />
              <div>
                {hasRecipientErrors && <p>Fix the highlighted recipient addresses before saving.</p>}
                {clientIssues.map(m => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            </div>
          )}
          {saveError.length > 0 && (
            <div
              role='alert'
              className='mb-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-[12.5px] text-red-700 dark:text-red-400'
            >
              {saveError.map(m => (
                <p key={m}>{m}</p>
              ))}
            </div>
          )}

          {canEdit && (
            <div className='flex items-center justify-end gap-3 sticky bottom-0 z-10 py-3 bg-background'>
              {savedAt && !dirty && (
                <span className='inline-flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400'>
                  <CheckCircle2 size={14} /> Settings saved
                </span>
              )}
              {dirty && (
                <button
                  type='button'
                  disabled={saving}
                  onClick={() => {
                    setForm(saved)
                    setSaveError([])
                    setNewEmail('')
                    setNewEmailError('')
                  }}
                  className='rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50'
                >
                  Discard changes
                </button>
              )}
              <button
                type='button'
                onClick={save}
                disabled={
                  saving || !dirty || hasRecipientErrors || clientIssues.length > 0
                }
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {saving && <Loader2 size={13} className='animate-spin' />}
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}


interface LogRow {
  id: string
  notificationType: 'reminder' | 'critical'
  thresholdDays: number
  expiryDate: string
  recipients: string[]
  status: 'sending' | 'sent' | 'failed'
  error: string | null
  sentAt: string
  vehicleDocument: {
    type: string
    documentType: { name: string } | null
    vehicle: { plateNumber: string; make: string; model: string }
  }
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  dateStyle: 'medium',
  timeStyle: 'short'
})
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

const STATUS_STYLE: Record<LogRow['status'], string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  failed:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  sending:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
}

function NotificationHistory () {
  const [rows, setRows] = useState<LogRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run () {
      setLoading(true)
      setError('')
      try {
        const p = new URLSearchParams({ page: String(page), limit: '20' })
        if (type) p.set('type', type)
        if (status) p.set('status', status)
        const res = await fetch(`/api/fleet/notification-log?${p}`, {
          credentials: 'include',
          cache: 'no-store'
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error ?? 'Failed to load notification history')
          return
        }
        setRows(json.data?.items ?? [])
        setTotal(json.data?.pagination?.total ?? 0)
        setTotalPages(json.data?.pagination?.totalPages ?? 1)
      } catch {
        if (!cancelled) setError('Network error — could not load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [page, type, status])

  return (
    <div>
      <div className='flex flex-wrap items-center gap-3 mb-4'>
        <select
          className={`${INP} w-44`}
          value={type}
          aria-label='Filter by notification type'
          onChange={e => {
            setType(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All types</option>
          <option value='reminder'>Expiry reminder</option>
          <option value='critical'>Critical (expired)</option>
        </select>
        <select
          className={`${INP} w-40`}
          value={status}
          aria-label='Filter by delivery status'
          onChange={e => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>All statuses</option>
          <option value='sent'>Sent</option>
          <option value='failed'>Failed</option>
          <option value='sending'>In progress</option>
        </select>
        <span className='text-[11.5px] text-muted-foreground ml-auto'>
          {total} notification{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        {loading ? (
          <div className='flex items-center justify-center py-14'>
            <Loader2 size={20} className='animate-spin text-muted-foreground' />
          </div>
        ) : error ? (
          <p className='p-5 text-[13px] text-red-600 dark:text-red-400'>{error}</p>
        ) : rows.length === 0 ? (
          <p className='p-8 text-center text-[13px] text-muted-foreground'>
            No notifications have been sent yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-[12.5px]'>
              <thead>
                <tr className='bg-muted/40'>
                  {['Sent (Lagos time)', 'Vehicle', 'Document', 'Type', 'Timing', 'Recipients', 'Status'].map(h => (
                    <th
                      key={h}
                      className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const docName =
                    r.vehicleDocument.documentType?.name ?? r.vehicleDocument.type
                  const recipients = Array.isArray(r.recipients) ? r.recipients : []
                  return (
                    <tr key={r.id} className='border-t border-border align-top'>
                      <td className='px-4 py-3 whitespace-nowrap text-muted-foreground'>
                        {dateTimeFmt.format(new Date(r.sentAt))}
                      </td>
                      <td className='px-4 py-3'>
                        <p className='font-mono font-semibold text-foreground'>
                          {r.vehicleDocument.vehicle.plateNumber}
                        </p>
                        <p className='text-[11px] text-muted-foreground'>
                          {r.vehicleDocument.vehicle.make} {r.vehicleDocument.vehicle.model}
                        </p>
                      </td>
                      <td className='px-4 py-3 text-foreground'>
                        {docName}
                        <p className='text-[11px] text-muted-foreground'>
                          Expiry {dateFmt.format(new Date(r.expiryDate))}
                        </p>
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap'>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                            r.notificationType === 'critical'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900'
                          }`}
                        >
                          {r.notificationType === 'critical' ? 'Critical' : 'Reminder'}
                        </span>
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap text-muted-foreground'>
                        {r.notificationType === 'critical'
                          ? `${r.thresholdDays} day${r.thresholdDays === 1 ? '' : 's'} expired`
                          : `${r.thresholdDays}-day reminder`}
                      </td>
                      <td className='px-4 py-3 max-w-[220px]' title={recipients.join(', ')}>
                        <p className='truncate text-foreground'>{recipients[0] ?? '—'}</p>
                        {recipients.length > 1 && (
                          <p className='text-[11px] text-muted-foreground'>
                            +{recipients.length - 1} more
                          </p>
                        )}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap' title={r.error ?? undefined}>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold capitalize ${STATUS_STYLE[r.status]}`}
                        >
                          {r.status === 'sending' ? 'In progress' : r.status}
                        </span>
                        {r.status === 'failed' && r.error && (
                          <p className='mt-1 max-w-[200px] truncate text-[11px] text-red-500'>
                            {r.error}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className='flex items-center justify-end gap-2 mt-3'>
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className='h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Prev
          </button>
          <span className='text-[11px] text-muted-foreground'>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className='h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

type FuelType = 'litres' | 'naira'

interface FuelVehicle {
  id: string
  plateNumber: string
  make: string
  model: string
  entity: { id: string; name: string } | null
  fuelEntitlement: { type: FuelType; amount: number; durationDays: number; updatedAt: string } | null
}

const fuelNumberFmt = new Intl.NumberFormat('en-NG')

function FuelRow ({
  vehicle,
  canEdit,
  onChanged
}: {
  vehicle: FuelVehicle
  canEdit: boolean
  onChanged: (vehicleId: string, entitlement: FuelVehicle['fuelEntitlement']) => void
}) {
  const saved = vehicle.fuelEntitlement
  const [type, setType] = useState<FuelType>(saved?.type ?? 'litres')
  const [amount, setAmount] = useState(saved?.amount != null ? String(saved.amount) : '')
  const [duration, setDuration] = useState(
    saved?.durationDays != null ? String(saved.durationDays) : '30'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dirty =
    type !== (saved?.type ?? 'litres') ||
    amount !== (saved?.amount != null ? String(saved.amount) : '') ||
    duration !== (saved?.durationDays != null ? String(saved.durationDays) : '30')

  async function save () {
    const amt = Number(amount)
    const dur = Number(duration)
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Enter an amount greater than zero')
      return
    }
    if (!duration || isNaN(dur) || dur <= 0) {
      setError('Enter a duration in days')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/fleet/fuel-entitlements/${vehicle.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: amt, durationDays: dur })
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save')
        return
      }
      onChanged(vehicle.id, {
        type: json.data.type,
        amount: json.data.amount,
        durationDays: json.data.durationDays,
        updatedAt: json.data.updatedAt
      })
    } catch {
      setError('Network error — not saved')
    } finally {
      setSaving(false)
    }
  }

  async function clear () {
    if (!confirm(`Remove the fuel entitlement for ${vehicle.plateNumber}?`)) return
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/fleet/fuel-entitlements/${vehicle.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to remove')
        return
      }
      setAmount('')
      setDuration('30')
      setType('litres')
      onChanged(vehicle.id, null)
    } catch {
      setError('Network error — not removed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className='border-t border-border align-top'>
      <td className='px-4 py-3'>
        <p className='font-mono font-semibold text-foreground'>{vehicle.plateNumber}</p>
        <p className='text-[11px] text-muted-foreground'>{vehicle.entity?.name ?? '—'}</p>
      </td>
      <td className='px-4 py-3 text-foreground'>
        {vehicle.make} {vehicle.model}
      </td>
      <td className='px-4 py-3'>
        <div className='flex gap-3'>
          {(['litres', 'naira'] as const).map(t => (
            <label
              key={t}
              className={`inline-flex items-center gap-1.5 text-[12px] ${
                canEdit ? 'cursor-pointer' : 'cursor-default text-muted-foreground'
              }`}
            >
              <input
                type='radio'
                name={`fuel-type-${vehicle.id}`}
                checked={type === t}
                disabled={!canEdit || saving}
                onChange={() => setType(t)}
                className='h-3.5 w-3.5'
              />
              {t === 'litres' ? 'Litres' : 'Naira'}
            </label>
          ))}
        </div>
      </td>
      <td className='px-4 py-3'>
        <input
          type='number'
          min={0}
          step='0.01'
          inputMode='decimal'
          className={`${INP} w-full min-w-[9rem]`}
          placeholder={type === 'litres' ? 'e.g. 100' : 'e.g. 50000'}
          value={amount}
          disabled={!canEdit || saving}
          onChange={e => setAmount(e.target.value)}
        />
      </td>
      <td className='px-4 py-3'>
        <div className='flex items-center gap-1.5'>
          <input
            type='number'
            min={1}
            className={`${INP} w-full min-w-[5.5rem]`}
            value={duration}
            disabled={!canEdit || saving}
            onChange={e => setDuration(e.target.value)}
          />
          <span className='text-[11px] text-muted-foreground'>days</span>
        </div>
      </td>
      <td className='px-4 py-3'>
        {canEdit && (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              disabled={saving || !dirty}
              onClick={save}
              className='inline-flex items-center gap-1.5 h-8 rounded-lg bg-brand-navy px-3 text-[12px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {saving ? (
                <Loader2 size={12} className='animate-spin' />
              ) : !dirty && saved ? (
                <Check size={12} />
              ) : (
                <Save size={12} />
              )}
              Save
            </button>
            {saved && (
              <button
                type='button'
                title='Remove entitlement'
                disabled={saving}
                onClick={clear}
                className='h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50'
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
        {error && <p className='text-[11px] text-red-500 mt-1 max-w-[180px]'>{error}</p>}
      </td>
    </tr>
  )
}

function FuelEntitlementSettings ({ canEdit }: { canEdit: boolean }) {
  const { data: entRes } = useEntities()
  const [entityId, setEntityId] = useState('')
  const [search, setSearch] = useState('')
  const [vehicles, setVehicles] = useState<FuelVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams()
      if (entityId) p.set('entityId', entityId)
      if (search) p.set('search', search)
      const res = await fetch(`/api/fleet/fuel-entitlements?${p}`, {
        credentials: 'include',
        cache: 'no-store'
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load vehicles')
        return
      }
      setVehicles(json.data?.items ?? [])
    } catch {
      setError('Network error — could not load vehicles')
    } finally {
      setLoading(false)
    }
  }, [entityId, search])

  useEffect(() => {
    load()
  }, [load])

  function handleChanged (vehicleId: string, entitlement: FuelVehicle['fuelEntitlement']) {
    setVehicles(list =>
      list.map(v => (v.id === vehicleId ? { ...v, fuelEntitlement: entitlement } : v))
    )
  }

  const configuredCount = vehicles.filter(v => v.fuelEntitlement).length

  return (
    <div>
      <p className='text-[12.5px] text-muted-foreground mb-4'>
        Set a fuel entitlement per vehicle — a cap in litres or in Naira,
        reset every configured number of days. This does not itself validate
        fuel invoices; it defines the limit that step will check against.
      </p>

      <div className='flex flex-wrap items-center gap-3 mb-4'>
        <input
          className={`${INP} w-56`}
          placeholder='Search plate, make, model…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={`${INP} w-56`}
          value={entityId}
          onChange={e => setEntityId(e.target.value)}
        >
          <option value=''>All Entities</option>
          {(entRes?.items ?? []).map(en => (
            <option key={en.id} value={en.id}>
              {en.name}
            </option>
          ))}
        </select>
        <span className='text-[11.5px] text-muted-foreground ml-auto'>
          {configuredCount} of {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'} configured
        </span>
      </div>

      <div className='bg-card border border-border rounded-2xl overflow-hidden'>
        {loading ? (
          <div className='flex items-center justify-center py-14'>
            <Loader2 size={20} className='animate-spin text-muted-foreground' />
          </div>
        ) : error ? (
          <div className='p-5 flex items-center justify-between gap-3'>
            <p className='text-[13px] text-red-600 dark:text-red-400'>{error}</p>
            <button
              onClick={load}
              className='rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted'
            >
              Retry
            </button>
          </div>
        ) : vehicles.length === 0 ? (
          <p className='p-8 text-center text-[13px] text-muted-foreground'>
            No vehicles found.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-[12.5px]'>
              <thead>
                <tr className='bg-muted/40'>
                  {['Vehicle Reg No', 'Vehicle Make', 'Entitlement Type', 'Amount', 'Duration', ''].map(
                    h => (
                      <th
                        key={h}
                        className='px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap'
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <FuelRow key={v.id} vehicle={v} canEdit={canEdit} onChanged={handleChanged} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className='mt-4 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground'>
          You have view-only access. Contact an administrator to change fuel entitlements.
        </div>
      )}
    </div>
  )
}
