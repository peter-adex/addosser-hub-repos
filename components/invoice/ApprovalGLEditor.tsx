'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  X,
  Search
} from 'lucide-react'
import { fmtNGNDepr } from '@/lib/depreciation'
import { useRouter } from 'next/navigation'

interface GLOption {
  id: string

  glAccountId: string

  code: string

  name: string

  category: string

  entityId: string

  entityCode?: string

  entityName?: string

  displayName?: string
}

interface BudgetInfo {
  glCode: string
  glName: string
  ytdBudget: number
  ytdActual: number
  remaining: number
  isExceeded: boolean
}

interface Props {
  invoiceId: string
  invoiceAmount: number
  currentGLCode?: string | null
  currentGLName?: string | null

  currentGLEntityCode?: string
  entityId: string
  glOptions: GLOption[]
}

export default function ApprovalGLEditor ({
  invoiceId,
  invoiceAmount,
  currentGLCode,
  currentGLName,
  entityId,
  glOptions
}: Props) {
  const router = useRouter()

  const initialActiveGLObj = useMemo(() => {
    return glOptions.find(g => g.code === currentGLCode)
  }, [currentGLCode, glOptions])

  const [selectedCode, setSelectedCode] = useState(initialActiveGLObj?.id ?? '')
  const [glSearch, setGlSearch] = useState('')

  const [glOpen, setGlOpen] = useState(false)
  const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmedNV, setConfirmedNV] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const activeGL = glOptions.find(
      g => g.code === currentGLCode && g.entityId === entityId
    )

    if (activeGL) {
      setGlSearch(
        `${activeGL.code} — ${activeGL.name}${
          activeGL.entityCode ? ` (${activeGL.entityCode})` : ''
        }`
      )
    }
  }, [currentGLCode, glOptions])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setGlOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const filteredGL = useMemo(() => {
    let q = glSearch.toLowerCase().trim()

    if (q.includes('—')) {
      q = q.split('—')[0].trim()
    }

    if (!q) {
      return glOptions
    }

    return glOptions.filter(
      g => g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
    )
  }, [glOptions, glSearch])

  const checkBudget = useCallback(
    async (code: string) => {
      if (!code || code === currentGLCode) {
        setBudgetInfo(null)
        return
      }
      setChecking(true)

      const operationalYear = new Date().getFullYear()

      try {
        const res = await fetch(
          `/api/budgets?entityId=${entityId}&glAccountId=${code}&year=${operationalYear}`
        )
        const payload = await res.json()

        if (res.ok && payload.success && payload.data) {
          const b = payload.data
          if (b) {
            const budgetAmt = Number(b.annualAmount ?? b.ytdBudget ?? 0)
            const actualAmt = Array.isArray(b.actualLines)
              ? b.actualLines.reduce(
                  (s: number, l: any) => s + Number(l.amount ?? 0),
                  0
                )
              : Number(b.ytdActual ?? 0)
            const remainingAmt = budgetAmt - actualAmt

            setBudgetInfo({
              glCode: code,
              glName: b.glAccount?.name ?? '',
              ytdBudget: budgetAmt,
              ytdActual: actualAmt,
              remaining: remainingAmt,
              isExceeded: invoiceAmount > remainingAmt
            })
          }
        } else {
          setBudgetInfo(null)
        }
      } catch (err) {
        console.error('[Budget Async Execution Fault Intercept]', err)
        setBudgetInfo(null)
      } finally {
        setChecking(false)
      }
    },
    [currentGLCode, entityId, invoiceAmount]
  )

  useEffect(() => {
    if (selectedCode && selectedCode !== currentGLCode) {
      setConfirmedNV(false)
      checkBudget(selectedCode)
    } else {
      setBudgetInfo(null)
    }
  }, [selectedCode, currentGLCode, checkBudget])

  const handleSave = async () => {
    if (!selectedCode || selectedCode === currentGLCode) return
    if (budgetInfo?.isExceeded && !confirmedNV) {
      setError('Please confirm negative variance recording before saving.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const matchedGLObj = glOptions.find(g => g.glAccountId === selectedCode)

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glAccountCode: matchedGLObj?.code,

          glAccountId: matchedGLObj?.glAccountId,

          budgetEntityId: matchedGLObj?.entityId,

          entityId: entityId,

          isExceptionalApproval: budgetInfo?.isExceeded && confirmedNV,

          isBudgetExceeded: budgetInfo?.isExceeded ?? false
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update GL account')
      setSavedMsg('GL account updated ✓')
      router.refresh()
      setTimeout(() => setSavedMsg(''), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const currentLabel = currentGLCode
    ? `${currentGLCode} — ${currentGLName ?? ''}`
    : 'None'

  const hasChanged = selectedCode !== (initialActiveGLObj?.id ?? '')

  return (
    <div className='bg-card border-2 border-[#FFB800] rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in'>
      <div className='flex items-center justify-between'>
        <h3 className='font-bold text-foreground flex items-center gap-2 text-sm'>
          🔄 Correct GL Account
          <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFB800]/20 text-[#1B2A8A] dark:text-yellow-400'>
            Approver Only
          </span>
        </h3>
        <p className='text-xs text-muted-foreground'>
          Current:{' '}
          <code className='bg-muted px-1.5 py-0.5 rounded font-bold'>
            {currentLabel}
          </code>
        </p>
      </div>

      <div className='relative space-y-1.5' ref={dropdownRef}>
        <label className='block text-xs font-bold text-muted-foreground uppercase tracking-wider'>
          Select Correct GL Account (OPEX & CAPEX)
        </label>
        <div className='relative flex items-center'>
          <Search size={14} className='absolute left-3 text-muted-foreground' />
          <input
            type='text'
            className='w-full pl-9 pr-10 py-2.5 rounded-xl border-2 border-[#FFB800] bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition-all'
            placeholder='Type to search GL code or name…'
            value={glSearch}
            onChange={e => {
              setGlSearch(e.target.value)
              setGlOpen(true)
            }}
            onFocus={() => setGlOpen(true)}
            autoComplete='off'
          />
          {glSearch && (
            <button
              type='button'
              onClick={() => {
                setGlSearch('')
                setSelectedCode('')
                setBudgetInfo(null)
                setGlOpen(false)
              }}
              className='absolute right-3 p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
              title='Clear active choice'
            >
              <X size={14} />
            </button>
          )}
        </div>

        {glOpen && (
          <div className='absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-xl shadow-xl py-1'>
            {filteredGL.length === 0 ? (
              <div className='px-4 py-2.5 text-xs text-muted-foreground italic'>
                No matching accounts found
              </div>
            ) : (

              filteredGL.map(gl => (
                <button
                  key={gl.id}
                  type='button'
                  onClick={() => {
                    setSelectedCode(gl.glAccountId)

                    setGlSearch(
                      `${gl.code} — ${gl.name}${
                        gl.entityCode ? ` (${gl.entityCode})` : ''
                      }`
                    )

                    setGlOpen(false)
                    checkBudget(gl.glAccountId!)
                  }}
                  className='w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
                >
                  <strong>{gl.code}</strong> — {gl.name}{' '}
                  {gl.entityCode && ` (${gl.entityCode})`}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {checking && (
        <div className='flex items-center gap-2 text-xs text-muted-foreground animate-pulse'>
          <Loader2 size={12} className='animate-spin text-[#1B2A8A]' /> Querying
          budget logs…
        </div>
      )}

      {budgetInfo && !checking && (
        <div
          className={`rounded-xl p-4 border text-sm animate-fade-in ${
            budgetInfo.isExceeded
              ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700'
              : 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700'
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold mb-3 ${
              budgetInfo.isExceeded
                ? 'text-red-700 dark:text-red-400'
                : 'text-green-700 dark:text-green-400'
            }`}
          >
            {budgetInfo.isExceeded ? (
              <>
                <AlertTriangle size={15} /> ⚠️ Budget Exceeded — Exceptional
                Approval Required
              </>
            ) : (
              <>
                <CheckCircle2 size={15} /> ✅ Budget Available
              </>
            )}
          </div>
          <div className='grid grid-cols-3 gap-3 mb-3'>
            {[
              ['YTD Budget', fmtNGNDepr(budgetInfo.ytdBudget)],
              ['YTD Actual', fmtNGNDepr(budgetInfo.ytdActual)],
              ['Remaining', fmtNGNDepr(budgetInfo.remaining)]
            ].map(([label, value]) => (
              <div
                key={label}
                className='bg-white/70 dark:bg-black/20 rounded-lg p-2 border border-border/40 shadow-sm'
              >
                <div className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
                  {label}
                </div>
                <div className='font-bold text-foreground text-sm tabular-nums'>
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className='text-xs text-muted-foreground mb-2 font-medium'>
            Invoice amount:{' '}
            <strong className='text-foreground'>
              {fmtNGNDepr(invoiceAmount)}
            </strong>
            {budgetInfo.isExceeded && (
              <span className='text-red-600 dark:text-red-400 ml-2 font-bold'>
                (exceeds by {fmtNGNDepr(invoiceAmount - budgetInfo.remaining)})
              </span>
            )}
          </div>
          {budgetInfo.isExceeded && (
            <label className='flex items-start gap-3 cursor-pointer mt-3 p-3 bg-red-100/50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 transition-all hover:opacity-95'>
              <input
                type='checkbox'
                checked={confirmedNV}
                onChange={e => setConfirmedNV(e.target.checked)}
                className='mt-0.5 accent-red-600 w-4 h-4 flex-shrink-0'
              />
              <span className='text-xs text-red-700 dark:text-red-400 font-medium leading-tight'>
                <strong>I confirm</strong> this expenditure should be recorded
                as an intentional <strong>Negative Variance</strong>.
              </span>
            </label>
          )}
        </div>
      )}

      {error && (
        <p className='text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1'>
          <AlertTriangle size={12} /> {error}
        </p>
      )}
      {savedMsg && (
        <p className='text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1'>
          <CheckCircle2 size={12} /> {savedMsg}
        </p>
      )}

      {hasChanged && (
        <button
          onClick={handleSave}
          disabled={
            saving ||
            checking ||
            (budgetInfo?.isExceeded === true && !confirmedNV)
          }
          className='flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all shadow-md active:scale-95'
          style={{ background: '#FFB800', color: '#1B2A8A' }}
        >
          {saving ? (
            <Loader2 size={14} className='animate-spin' />
          ) : (
            <Save size={14} />
          )}{' '}
          {saving ? 'Saving Correction…' : 'Save GL Correction'}
        </button>
      )}
    </div>
  )
}
