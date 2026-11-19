'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Fuel,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Search,
  Plus,
  Trash2
} from 'lucide-react'
import { useEntities, useVendors, type ApiVehicle } from '@/lib/hooks/useApi'
import { genId } from '@/lib/utils'

const INP =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition disabled:opacity-60'
const REQ = <span className='text-red-500 ml-0.5'>*</span>
const fmtNgn = (n: number) =>
  '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface GLOption {
  glAccountId: string
  code: string
  name: string
  category: string
}

interface ApproverStep {
  stepNumber: number
  label: string
  approvers: { userId: string; name: string; email: string; approvalLimitAmount: number | null }[]
}

interface EntitlementCheck {
  hasEntitlement: boolean
  exceeded: boolean
  exceedanceAmount: number
  entitlementType?: 'litres' | 'naira'
  entitlementAmount?: number
  durationDays?: number
  priorApprovedAmount?: number
  basisMismatch?: boolean
}

interface BudgetCheck {
  exceeded?: boolean
  monthlyAvailable?: number
  financialYear?: number
}

interface FuelLineState {
  key: string
  vehicleId: string
  vehicle: ApiVehicle | null
  litres: string
  pumpPrice: string
}

const newLine = (): FuelLineState => ({
  key: genId(),
  vehicleId: '',
  vehicle: null,
  litres: '',
  pumpPrice: ''
})

function VehicleCombobox ({
  entityId,
  selected,
  disabledVehicleIds,
  onSelect
}: {
  entityId: string
  selected: ApiVehicle | null
  disabledVehicleIds: Set<string>
  onSelect: (v: ApiVehicle | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ApiVehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !entityId) return
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      const p = new URLSearchParams({ entityId, limit: '20' })
      if (query.trim()) p.set('search', query.trim())
      fetch(`/api/fleet/vehicles?${p}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          setResults(d.data?.items ?? [])
          setSearched(true)
        })
        .catch(() => {
          if (!cancelled) setResults([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, open, entityId])

  useEffect(() => {
    function onDocClick (e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  if (selected) {
    return (
      <div className={`${INP} flex items-center justify-between gap-2`}>
        <span className='truncate'>
          <span className='font-mono font-semibold'>{selected.plateNumber}</span>
          <span className='text-muted-foreground'>
            {' '}
            — {selected.make} {selected.model}
          </span>
        </span>
        <button
          type='button'
          onClick={() => {
            onSelect(null)
            setQuery('')
          }}
          className='text-[11px] text-brand-navy dark:text-brand-gold hover:underline flex-shrink-0'
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className='relative'>
      <Search
        size={13}
        className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none'
      />
      <input
        className={`${INP} pl-8 uppercase placeholder:normal-case`}
        placeholder='Type a plate number to search…'
        value={query}
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className='absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto'>
          {loading && results.length === 0 ? (
            <p className='px-3 py-2 text-[12px] text-muted-foreground flex items-center gap-1.5'>
              <Loader2 size={12} className='animate-spin' /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className='px-3 py-2 text-[12px] text-muted-foreground'>
              {searched ? 'No vehicles match.' : 'Start typing to search.'}
            </p>
          ) : (
            results.map(v => {
              const taken = disabledVehicleIds.has(v.id)
              return (
                <button
                  type='button'
                  key={v.id}
                  disabled={taken}
                  onClick={() => {
                    onSelect(v)
                    setOpen(false)
                    setQuery('')
                  }}
                  className='w-full text-left px-3 py-2 text-[12.5px] hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <span className='font-mono font-semibold text-foreground'>{v.plateNumber}</span>{' '}
                  <span className='text-muted-foreground'>
                    {v.make} {v.model}
                  </span>
                  {taken && (
                    <span className='ml-2 text-[10.5px] text-amber-600'>already added</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function FuelLineRow ({
  line,
  entityId,
  disabledVehicleIds,
  canRemove,
  error,
  onChange,
  onRemove,
  onEntitlementResult
}: {
  line: FuelLineState
  entityId: string
  disabledVehicleIds: Set<string>
  canRemove: boolean
  error?: { vehicleId?: string; litres?: string; pumpPrice?: string }
  onChange: (patch: Partial<FuelLineState>) => void
  onRemove: () => void
  onEntitlementResult: (result: EntitlementCheck | null) => void
}) {
  const [entitlementCheck, setEntitlementCheck] = useState<EntitlementCheck | null>(null)
  const [entitlementLoading, setEntitlementLoading] = useState(false)

  const selectedVehicle = line.vehicle
  const litresNum = parseFloat(line.litres) || 0
  const pumpPriceNum = parseFloat(line.pumpPrice) || 0
  const amount = Math.round(litresNum * pumpPriceNum * 100) / 100

  const entitlementBasis = selectedVehicle?.fuelEntitlement?.type ?? 'litres'
  const compareAmount = entitlementBasis === 'naira' ? amount : litresNum

  useEffect(() => {
    if (!line.vehicleId || compareAmount <= 0) {
      setEntitlementCheck(null)
      onEntitlementResult(null)
      return
    }
    let cancelled = false
    setEntitlementLoading(true)
    const p = new URLSearchParams({
      vehicleId: line.vehicleId,
      fuelType: entitlementBasis,
      requestedAmount: String(compareAmount)
    })
    fetch(`/api/fleet/fuel-entitlements/check?${p}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const result: EntitlementCheck | null = d.success ? d.data : null
        setEntitlementCheck(result)
        onEntitlementResult(result)
      })
      .finally(() => {
        if (!cancelled) setEntitlementLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [line.vehicleId, entitlementBasis, compareAmount])

  return (
    <div className='border border-border rounded-xl p-4'>
      <div className='flex items-start justify-between gap-3 mb-3'>
        <div className='flex-1 min-w-0'>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Vehicle{REQ}
          </label>
          <VehicleCombobox
            entityId={entityId}
            selected={line.vehicle}
            disabledVehicleIds={disabledVehicleIds}
            onSelect={v => onChange({ vehicle: v, vehicleId: v?.id ?? '' })}
          />
          {error?.vehicleId && <p className='text-[11px] text-red-500 mt-1'>{error.vehicleId}</p>}
          {selectedVehicle && (
            <p className='text-[11px] text-muted-foreground mt-1'>
              {selectedVehicle.fuelEntitlement ? (
                <>
                  Entitlement:{' '}
                  <strong className='text-foreground'>
                    {selectedVehicle.fuelEntitlement.amount.toLocaleString('en-NG')}{' '}
                    {selectedVehicle.fuelEntitlement.type === 'litres' ? 'litres' : 'Naira'}
                  </strong>{' '}
                  every {selectedVehicle.fuelEntitlement.durationDays} days.
                </>
              ) : (
                'No fuel entitlement configured for this vehicle yet (Fleet → Fleet Settings → Fuel).'
              )}
            </p>
          )}
        </div>
        {canRemove && (
          <button
            type='button'
            title='Remove this vehicle'
            onClick={onRemove}
            className='h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors mt-5'
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <div>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Litres{REQ}
          </label>
          <input
            type='number'
            min={0}
            step='0.01'
            inputMode='decimal'
            className={INP}
            placeholder='e.g. 50'
            value={line.litres}
            onChange={e => onChange({ litres: e.target.value })}
          />
          {error?.litres && <p className='text-[11px] text-red-500 mt-1'>{error.litres}</p>}
        </div>
        <div>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Current Pump Price (₦/L){REQ}
          </label>
          <input
            type='number'
            min={0}
            step='0.01'
            inputMode='decimal'
            className={INP}
            placeholder='e.g. 950'
            value={line.pumpPrice}
            onChange={e => onChange({ pumpPrice: e.target.value })}
          />
          {error?.pumpPrice && <p className='text-[11px] text-red-500 mt-1'>{error.pumpPrice}</p>}
        </div>
        <div>
          <label className='text-[11px] font-medium text-muted-foreground block mb-1'>
            Amount (₦)
          </label>
          <input
            type='text'
            readOnly
            disabled
            className={`${INP} font-semibold`}
            value={amount > 0 ? fmtNgn(amount) : '—'}
          />
        </div>
      </div>

      {line.vehicleId && compareAmount > 0 && (
        <div className='mt-3'>
          {entitlementLoading ? (
            <p className='text-[11px] text-muted-foreground flex items-center gap-1.5'>
              <Loader2 size={11} className='animate-spin' /> Checking entitlement…
            </p>
          ) : entitlementCheck?.hasEntitlement ? (
            entitlementCheck.exceeded ? (
              <div className='flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11.5px] text-amber-800 dark:text-amber-300'>
                <AlertTriangle size={13} className='flex-shrink-0 mt-0.5' />
                <span>
                  Exceeds the {entitlementCheck.durationDays}-day entitlement of{' '}
                  {entitlementCheck.entitlementType === 'naira'
                    ? fmtNgn(entitlementCheck.entitlementAmount ?? 0)
                    : `${entitlementCheck.entitlementAmount} litres`}{' '}
                  by{' '}
                  <strong>
                    {entitlementCheck.entitlementType === 'naira'
                      ? fmtNgn(entitlementCheck.exceedanceAmount)
                      : `${entitlementCheck.exceedanceAmount} litres`}
                  </strong>
                  . Exceptional approval will be required.
                </span>
              </div>
            ) : (
              <p className='text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5'>
                <CheckCircle2 size={11} /> Within entitlement (
                {entitlementCheck.priorApprovedAmount ?? 0} already approved this period).
              </p>
            )
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function FuelPaymentForm () {
  const router = useRouter()
  const { data: entRes } = useEntities()
  const { data: venRes } = useVendors({ status: 'active' })

  const [entityId, setEntityId] = useState('')

  const [lines, setLines] = useState<FuelLineState[]>([newLine()])
  const [lineEntitlements, setLineEntitlements] = useState<Record<string, EntitlementCheck | null>>({})

  const [description, setDescription] = useState('')

  const [glOptions, setGlOptions] = useState<GLOption[]>([])
  const [glLoading, setGlLoading] = useState(false)
  const [glAccountId, setGlAccountId] = useState('')
  const [glOpen, setGlOpen] = useState(false)

  const [isOneTime, setIsOneTime] = useState(false)
  const [vendorId, setVendorId] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorOpen, setVendorOpen] = useState(false)
  const [otvPhone, setOtvPhone] = useState('')
  const [otvBankName, setOtvBankName] = useState('')
  const [otvBankAccountNo, setOtvBankAccountNo] = useState('')
  const [otvBankAccountName, setOtvBankAccountName] = useState('')
  const [otvReason, setOtvReason] = useState('')

  const [budgetCheck, setBudgetCheck] = useState<BudgetCheck | null>(null)

  const [approverSteps, setApproverSteps] = useState<ApproverStep[]>([])
  const [approverError, setApproverError] = useState('')
  const [approverLoading, setApproverLoading] = useState(false)
  const [selectedApprovers, setSelectedApprovers] = useState<Record<number, string>>({})

  const [justification, setJustification] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const vendors = venRes?.items ?? []

  useEffect(() => {
    setLines([newLine()])
    setLineEntitlements({})
    setGlAccountId('')
    setGlOptions([])
  }, [entityId])

  function addLine () {
    setLines(l => [...l, newLine()])
  }
  function removeLine (key: string) {
    setLines(l => (l.length > 1 ? l.filter(x => x.key !== key) : l))
    setLineEntitlements(m => {
      const n = { ...m }
      delete n[key]
      return n
    })
  }
  function patchLine (key: string, patch: Partial<FuelLineState>) {
    setLines(l => l.map(x => (x.key === key ? { ...x, ...patch } : x)))
  }

  const lineAmounts = useMemo(
    () =>
      lines.map(l => {
        const litresNum = parseFloat(l.litres) || 0
        const pumpPriceNum = parseFloat(l.pumpPrice) || 0
        return Math.round(litresNum * pumpPriceNum * 100) / 100
      }),
    [lines]
  )
  const amount = Math.round(lineAmounts.reduce((s, a) => s + a, 0) * 100) / 100

  useEffect(() => {
    if (!entityId) return
    let cancelled = false
    setGlLoading(true)
    fetch(`/api/gl-accounts/search?entityId=${entityId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.success) setGlOptions(d.data)
      })
      .finally(() => {
        if (!cancelled) setGlLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entityId])

  useEffect(() => {
    const gl = glOptions.find(g => g.glAccountId === glAccountId)
    if (!entityId || !gl || !amount) {
      setBudgetCheck(null)
      return
    }
    let cancelled = false
    fetch(
      `/api/budgets/check?entityId=${entityId}&glAccountCode=${encodeURIComponent(gl.code)}&amount=${amount}`,
      { credentials: 'include' }
    )
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.success !== false) setBudgetCheck(d.data ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [entityId, glAccountId, amount, glOptions])

  const anyLineExceeded = Object.values(lineEntitlements).some(r => r?.exceeded)
  const isExceptional = anyLineExceeded || !!budgetCheck?.exceeded

  useEffect(() => {
    if (!entityId) {
      setApproverSteps([])
      return
    }
    let cancelled = false
    setApproverLoading(true)
    setApproverError('')
    fetch(
      `/api/approval-workflows/eligible-approvers?entityId=${entityId}&module=invoice&isBudgetExceeded=${isExceptional}`,
      { credentials: 'include' }
    )
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setApproverSteps(d.steps ?? [])
        if (d.message) setApproverError(d.message)
        setSelectedApprovers({})
      })
      .catch(() => {
        if (!cancelled) setApproverError('Failed to load eligible approvers. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setApproverLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entityId, isExceptional])

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase()
    if (!q) return vendors.slice(0, 20)
    return vendors.filter(v => v.name.toLowerCase().includes(q)).slice(0, 20)
  }, [vendors, vendorSearch])
  const selectedVendor = vendors.find(v => v.id === vendorId)
  const selectedGL = glOptions.find(g => g.glAccountId === glAccountId)

  function validate () {
    const e: Record<string, string> = {}
    if (!entityId) e.entityId = 'Select an entity'

    lines.forEach((l, i) => {
      if (!l.vehicleId) e[`line_${i}_vehicleId`] = 'Select a vehicle'
      if (!(parseFloat(l.litres) > 0)) e[`line_${i}_litres`] = 'Enter the litres'
      if (!(parseFloat(l.pumpPrice) > 0)) e[`line_${i}_pumpPrice`] = 'Enter the pump price'
    })
    const vehicleIds = lines.map(l => l.vehicleId).filter(Boolean)
    if (new Set(vehicleIds).size !== vehicleIds.length) {
      e.lines = 'The same vehicle is selected more than once — each vehicle can only have one line'
    }
    if (amount <= 0) e.lines = e.lines || 'Enter at least one vehicle with litres and a pump price'

    if (!glAccountId) e.glAccount = 'Select a GL Account'
    if (isOneTime) {
      if (!vendorSearch.trim()) e.vendor = 'Enter the fuel station / payee name'
      if (!otvReason.trim()) e.otvReason = 'State the reason for this one-time payment'
      if (!otvBankName.trim()) e.otvBankName = 'Bank name is required'
      if (!otvBankAccountName.trim()) e.otvBankAccountName = 'Account name is required'
      if (!/^\d{9}$/.test(otvBankAccountNo)) {
        e.otvBankAccountNo = otvBankAccountNo
          ? 'Account number must be exactly 9 digits'
          : 'Account number is required'
      }
    } else if (!vendorId) {
      e.vendor = 'Select a vendor (fuel station)'
    }
    if (isExceptional && !justification.trim()) {
      e.justification = 'A justification is required when the entitlement or budget is exceeded'
    }
    for (const step of approverSteps) {
      if (!selectedApprovers[step.stepNumber]) {
        e[`approver_${step.stepNumber}`] = `Select an approver for ${step.label}`
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit () {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const payload = {
        entityId,
        invoiceType: 'FLEET_FUEL',
        vendorId: isOneTime ? undefined : vendorId || undefined,
        vendorName: isOneTime ? vendorSearch.trim() : selectedVendor?.name ?? '',
        vendorEmail: isOneTime ? undefined : selectedVendor?.email || undefined,
        vendorIsOneTime: isOneTime,
        oneTimeVendorPhone: isOneTime ? otvPhone || undefined : undefined,
        oneTimeVendorBankName: isOneTime ? otvBankName || undefined : undefined,
        oneTimeVendorBankAccountNo: isOneTime ? otvBankAccountNo || undefined : undefined,
        oneTimeVendorBankAccountName: isOneTime ? otvBankAccountName || undefined : undefined,
        oneTimeVendorReason: isOneTime ? otvReason || undefined : undefined,
        glAccountId,
        glAccountCode: selectedGL?.code ?? '',
        vatRate: 0,
        whtRate: 0,
        description: description.trim() || `Fuel payment — ${lines.length} vehicle${lines.length === 1 ? '' : 's'}`,
        isBudgetExceeded: isExceptional,
        isExceptionalApproval: isExceptional,
        exceptionalJustification: isExceptional ? justification.trim() : undefined,
        approverSelections: Object.entries(selectedApprovers).map(([stepNumber, userId]) => ({
          stepNumber: Number(stepNumber),
          userId
        })),
        lineItems: lines.map(l => {
          const v = l.vehicle
          const label = v ? `${v.plateNumber} — ${v.make} ${v.model}` : 'vehicle'
          return {
            description: `Fuel — ${l.litres}L @ ₦${l.pumpPrice}/L — ${label}`,
            quantity: parseFloat(l.litres) || 0,
            unitCost: parseFloat(l.pumpPrice) || 0,
            vehicleId: l.vehicleId
          }
        })
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to submit fuel request')
        return
      }
      router.push('/fleet/fuel')
      router.refresh()
    } catch {
      setSubmitError('Network error — the request was not submitted')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='max-w-3xl space-y-5'>
      <div className='bg-card border border-border rounded-2xl p-5'>
        <h3 className='text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2'>
          <Fuel size={15} /> Fuel Payment Request
        </h3>
        <div>
          <label className='text-[12px] font-medium text-foreground block mb-1.5'>
            Entity{REQ}
          </label>
          <select className={INP} value={entityId} onChange={e => setEntityId(e.target.value)}>
            <option value=''>Select entity…</option>
            {(entRes?.items ?? []).map(en => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </select>
          {errors.entityId && <p className='text-[11px] text-red-500 mt-1'>{errors.entityId}</p>}
        </div>
      </div>

      <div className='bg-card border border-border rounded-2xl p-5'>
        <div className='flex items-center justify-between mb-1'>
          <h3 className='text-[14px] font-semibold text-foreground'>Vehicles</h3>
          <button
            type='button'
            disabled={!entityId}
            onClick={addLine}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Plus size={13} /> Add Vehicle
          </button>
        </div>
        <p className='text-[11.5px] text-muted-foreground mb-4'>
          Add every vehicle being fuelled on this request. Amount is always Litres × Current Pump
          Price — it isn't editable directly.
        </p>

        {!entityId ? (
          <p className='text-[12.5px] text-muted-foreground'>Select an entity first.</p>
        ) : (
          <div className='space-y-3'>
            {lines.map((line, i) => (
              <FuelLineRow
                key={line.key}
                line={line}
                entityId={entityId}
                disabledVehicleIds={new Set(lines.filter(l => l.key !== line.key).map(l => l.vehicleId).filter(Boolean))}
                canRemove={lines.length > 1}
                error={{
                  vehicleId: errors[`line_${i}_vehicleId`],
                  litres: errors[`line_${i}_litres`],
                  pumpPrice: errors[`line_${i}_pumpPrice`]
                }}
                onChange={patch => patchLine(line.key, patch)}
                onRemove={() => removeLine(line.key)}
                onEntitlementResult={result =>
                  setLineEntitlements(m => ({ ...m, [line.key]: result }))
                }
              />
            ))}
          </div>
        )}
        {errors.lines && <p className='text-[11px] text-red-500 mt-2'>{errors.lines}</p>}

        {amount > 0 && (
          <div className='flex justify-end mt-3 pt-3 border-t border-border'>
            <p className='text-[13px] text-foreground'>
              Total: <strong>{fmtNgn(amount)}</strong>
            </p>
          </div>
        )}
      </div>

      <div className='bg-card border border-border rounded-2xl p-5'>
        <h3 className='text-[14px] font-semibold text-foreground mb-1'>GL Account</h3>
        <p className='text-[11.5px] text-muted-foreground mb-4'>
          Any GL account enabled for this entity.
        </p>
        <div className='relative'>
          <button
            type='button'
            disabled={!entityId}
            onClick={() => setGlOpen(o => !o)}
            className={`${INP} flex items-center justify-between text-left`}
          >
            <span className={selectedGL ? 'text-foreground' : 'text-muted-foreground'}>
              {glLoading
                ? 'Loading…'
                : selectedGL
                ? `${selectedGL.code} — ${selectedGL.name}`
                : entityId
                ? glOptions.length
                  ? 'Select GL Account…'
                  : 'No GL account configured for this entity'
                : 'Select an entity first'}
            </span>
            <ChevronDown size={14} className='text-muted-foreground flex-shrink-0' />
          </button>
          {glOpen && glOptions.length > 0 && (
            <div className='absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto'>
              {glOptions.map(g => (
                <button
                  type='button'
                  key={g.glAccountId}
                  onClick={() => {
                    setGlAccountId(g.glAccountId)
                    setGlOpen(false)
                  }}
                  className='w-full text-left px-3 py-2 text-[12.5px] hover:bg-muted transition-colors'
                >
                  <span className='font-mono font-semibold text-foreground'>{g.code}</span>{' '}
                  <span className='text-muted-foreground'>{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {errors.glAccount && <p className='text-[11px] text-red-500 mt-1'>{errors.glAccount}</p>}
      </div>

      <div className='bg-card border border-border rounded-2xl p-5'>
        <h3 className='text-[14px] font-semibold text-foreground mb-4'>Fuel Station / Vendor</h3>
        <div className='flex gap-4 mb-4'>
          <label className='inline-flex items-center gap-2 text-[13px] cursor-pointer'>
            <input
              type='radio'
              checked={!isOneTime}
              onChange={() => {
                setIsOneTime(false)
                setVendorSearch('')
              }}
              className='h-4 w-4'
            />
            Registered Vendor
          </label>
          <label className='inline-flex items-center gap-2 text-[13px] cursor-pointer'>
            <input
              type='radio'
              checked={isOneTime}
              onChange={() => {
                setIsOneTime(true)
                setVendorId('')
              }}
              className='h-4 w-4'
            />
            One-time Station / Payee
          </label>
        </div>

        {!isOneTime ? (
          <div className='relative'>
            <div className='relative'>
              <Search
                size={13}
                className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'
              />
              <input
                className={`${INP} pl-8`}
                placeholder='Search registered vendors…'
                value={selectedVendor ? selectedVendor.name : vendorSearch}
                onFocus={() => setVendorOpen(true)}
                onChange={e => {
                  setVendorId('')
                  setVendorSearch(e.target.value)
                  setVendorOpen(true)
                }}
              />
            </div>
            {vendorOpen && filteredVendors.length > 0 && (
              <div className='absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto'>
                {filteredVendors.map(v => (
                  <button
                    type='button'
                    key={v.id}
                    onClick={() => {
                      setVendorId(v.id)
                      setVendorSearch('')
                      setVendorOpen(false)
                    }}
                    className='w-full text-left px-3 py-2 text-[12.5px] hover:bg-muted transition-colors'
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className='space-y-3'>
            <div>
              <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                Station / Payee Name{REQ}
              </label>
              <input
                className={INP}
                placeholder='e.g. NNPC Filling Station, Ikeja'
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
              />
            </div>
            <div>
              <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                Phone (optional)
              </label>
              <input
                className={INP}
                placeholder='e.g. 08012345678'
                value={otvPhone}
                onChange={e => setOtvPhone(e.target.value)}
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                  Bank Name{REQ}
                </label>
                <input
                  className={INP}
                  placeholder='e.g. Access Bank'
                  value={otvBankName}
                  onChange={e => setOtvBankName(e.target.value)}
                />
                {errors.otvBankName && (
                  <p className='text-[11px] text-red-500 mt-1'>{errors.otvBankName}</p>
                )}
              </div>
              <div>
                <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                  Account Number{REQ}
                </label>
                <input
                  className={`${INP} font-mono tracking-wider`}
                  inputMode='numeric'
                  autoComplete='off'
                  maxLength={9}
                  placeholder='9 digits'
                  value={otvBankAccountNo}
                  onChange={e => setOtvBankAccountNo(e.target.value.replace(/\D/g, '').slice(0, 9))}
                />
                {errors.otvBankAccountNo && (
                  <p className='text-[11px] text-red-500 mt-1'>{errors.otvBankAccountNo}</p>
                )}
              </div>
            </div>
            <div>
              <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                Account Name{REQ}
              </label>
              <input
                className={INP}
                placeholder='Name on the bank account'
                value={otvBankAccountName}
                onChange={e => setOtvBankAccountName(e.target.value)}
              />
              {errors.otvBankAccountName && (
                <p className='text-[11px] text-red-500 mt-1'>{errors.otvBankAccountName}</p>
              )}
            </div>
            <div>
              <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                Reason for one-time payment{REQ}
              </label>
              <input
                className={INP}
                placeholder='e.g. Nearest station during an inter-state trip'
                value={otvReason}
                onChange={e => setOtvReason(e.target.value)}
              />
              {errors.otvReason && (
                <p className='text-[11px] text-red-500 mt-1'>{errors.otvReason}</p>
              )}
            </div>
          </div>
        )}
        {errors.vendor && <p className='text-[11px] text-red-500 mt-1'>{errors.vendor}</p>}
      </div>

      <div className='bg-card border border-border rounded-2xl p-5'>
        <label className='text-[12px] font-medium text-foreground block mb-1.5'>
          Notes (optional)
        </label>
        <textarea
          className={`${INP} min-h-[70px]`}
          placeholder='e.g. Trip to Ibadan branch, round trip'
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {budgetCheck?.exceeded && (
        <div className='rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[12.5px] text-amber-800 dark:text-amber-300 flex items-start gap-2'>
          <AlertTriangle size={14} className='flex-shrink-0 mt-0.5' />
          <span>
            This also exceeds the GL account's available monthly budget
            {typeof budgetCheck.monthlyAvailable === 'number'
              ? ` (${fmtNgn(budgetCheck.monthlyAvailable)} available)`
              : ''}
            . Exceptional approval will be required.
          </span>
        </div>
      )}

      {isExceptional && (
        <div className='bg-card border border-amber-300 dark:border-amber-800 rounded-2xl p-5'>
          <h3 className='text-[14px] font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2'>
            <AlertTriangle size={14} /> Exceptional Approval Required
          </h3>
          <label className='text-[12px] font-medium text-foreground block mb-1.5'>
            Justification{REQ}
          </label>
          <textarea
            className={`${INP} min-h-[70px]`}
            placeholder='Explain why this fuel request should be approved despite exceeding the limit'
            value={justification}
            onChange={e => setJustification(e.target.value)}
          />
          {errors.justification && (
            <p className='text-[11px] text-red-500 mt-1'>{errors.justification}</p>
          )}
        </div>
      )}

      <div className='bg-card border border-border rounded-2xl p-5'>
        <h3 className='text-[14px] font-semibold text-foreground mb-1'>Select Approvers</h3>
        <p className='text-[11.5px] text-muted-foreground mb-4'>
          From the same Invoice Processing approval workflow configured for this entity.
        </p>
        {!entityId ? (
          <p className='text-[12.5px] text-muted-foreground'>Select an entity first.</p>
        ) : approverLoading ? (
          <p className='text-[12.5px] text-muted-foreground flex items-center gap-1.5'>
            <Loader2 size={12} className='animate-spin' /> Loading eligible approvers…
          </p>
        ) : approverError && approverSteps.length === 0 ? (
          <p className='text-[12.5px] text-red-600 dark:text-red-400'>{approverError}</p>
        ) : (
          <div className='space-y-3'>
            {approverSteps.map(step => (
              <div key={step.stepNumber}>
                <label className='text-[12px] font-medium text-foreground block mb-1.5'>
                  {step.label}
                  {REQ}
                </label>
                <select
                  className={INP}
                  value={selectedApprovers[step.stepNumber] ?? ''}
                  onChange={e =>
                    setSelectedApprovers(s => ({ ...s, [step.stepNumber]: e.target.value }))
                  }
                >
                  <option value=''>Select approver…</option>
                  {step.approvers.map(a => (
                    <option key={a.userId} value={a.userId}>
                      {a.name} ({a.email})
                      {a.approvalLimitAmount ? ` — limit ${fmtNgn(a.approvalLimitAmount)}` : ''}
                    </option>
                  ))}
                </select>
                {errors[`approver_${step.stepNumber}`] && (
                  <p className='text-[11px] text-red-500 mt-1'>
                    {errors[`approver_${step.stepNumber}`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {submitError && (
        <div className='rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-[12.5px] text-red-700 dark:text-red-400'>
          {submitError}
        </div>
      )}

      <div className='flex justify-end gap-3'>
        <button
          type='button'
          onClick={() => router.push('/fleet/fuel')}
          className='rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted transition-colors'
        >
          Cancel
        </button>
        <button
          type='button'
          disabled={submitting}
          onClick={submit}
          className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-[13px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors disabled:opacity-50'
        >
          {submitting && <Loader2 size={14} className='animate-spin' />}
          Submit Fuel Request
        </button>
      </div>
    </div>
  )
}
