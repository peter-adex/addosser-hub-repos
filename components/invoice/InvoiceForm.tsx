'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  Wrench,
  ShoppingCart,
  Search,
  Upload,
  X,
  Download,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import InvoiceLineItems, {
  type LineItem,
  type InvoiceTotals
} from './InvoiceLineItems'
import { formatCompact, genId } from '@/lib/utils'
import { compressImageBase64 } from '@/lib/compressor'

export type InvoiceType = 'GENERAL_EXPENSE' | 'ASSET_RELATED' | 'ASSET_PURCHASE'

interface Entity {
  id: string
  name: string
  code: string
}
interface Branch {
  id: string
  name: string
  code: string | null
}
type GLAcct = {
  id: string
  code: string
  name: string
  category: string
  budgetType?: string

  entityAccounts: {
    entityId: string
  }[]
}
interface Vendor {
  id: string
  name: string
  code: string | null
  email: string | null
  contactPerson: string | null
  contactEmail: string | null
  contactPhone: string | null
  bankName: string | null
  bankAccountNo: string | null
  bankAccountName: string | null
  taxId: string | null
}
interface Asset {
  id: string
  assetNo: string
  name: string
  condition: string
  branchName?: string
}
interface Maintenance {
  id: string
  type: string
  description: string | null
  cost: number
  performedAt: string
}

interface Props {
  entities: Entity[]
  glAccounts?: (GLAcct & { budgetType?: string })[]
  vendors: Vendor[]
  initialData?: {
    id: string
    invoiceNo: string
    invoiceType: InvoiceType
    entityId: string
    budgetEntityId?: string
    branchId?: string
    vendorId?: string
    vendorName: string
    vendorIsOneTime?: boolean
    oneTimeVendorPhone?: string
    oneTimeVendorBankName?: string
    oneTimeVendorBankAccountNo?: string
    oneTimeVendorBankAccountName?: string
    oneTimeVendorReason?: string
    glAccountCode: string
    glAccountId?: string
    description?: string
    vatRate: number
    whtRate: number
    lineItems: any[]
    isExceptionalApproval: boolean
    isBudgetExceeded: boolean

    asset?: {
      id: string
      assetNo: string
      name: string
      condition: string
      branchName?: string
    }

    attachments?: {
      url: string
      name: string
      type: string
      size: number
    }[]
  }
}

const INVOICE_TYPES: {
  id: InvoiceType
  label: string
  desc: string
  icon: React.ReactNode
}[] = [
  {
    id: 'GENERAL_EXPENSE',
    label: 'General Expense',
    desc: 'Process an invoice without linking to any asset',
    icon: <Briefcase size={18} />
  },
  {
    id: 'ASSET_RELATED',
    label: 'Asset-Related',
    desc: 'Link invoice to an existing asset (repairs, maintenance, upgrade)',
    icon: <Wrench size={18} />
  },
  {
    id: 'ASSET_PURCHASE',
    label: 'Asset Purchase',
    desc: 'Create a new asset from this purchase invoice',
    icon: <ShoppingCart size={18} />
  }
]

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]
const ALLOWED_EXTS =
  '.pdf,.xls,.xlsx,.doc,.docx,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.svg'

interface AttachedFile {
  id: string
  name: string
  size: number
  type: string
  base64?: string
  url?: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n)
const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export default function InvoiceForm ({
  entities,
  glAccounts = [],
  vendors,
  initialData
}: Props) {
  const router = useRouter()

  const [glOptions, setGlOptions] = useState<(GLAcct & { budgetType?: string })[]>(glAccounts)

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    initialData?.invoiceType ?? 'GENERAL_EXPENSE'
  )

  const [entityId, setEntityId] = useState(
    initialData?.entityId ?? entities[0]?.id ?? ''
  )
  const [branchId, setBranchId] = useState(initialData?.branchId ?? '')
  const [branches, setBranches] = useState<Branch[]>([])
  const [description, setDescription] = useState(initialData?.description ?? '')

  const initialGLRecord = glOptions.find(
    g =>
      (g as any).glAccountId === initialData?.glAccountId &&
      (g as any).budgetEntityId === initialData?.budgetEntityId
  )

  const [glAccountId, setGlId] = useState(initialGLRecord?.id ?? '')
  const [actualGLId, setActualGLId] = useState(initialData?.glAccountId ?? '')

  const [budgetEntityId, setBudgetEntityId] = useState(
    initialData?.budgetEntityId ?? ''
  )

  const [glSearch, setGlSearch] = useState(
    initialGLRecord ? `${initialGLRecord.code} — ${initialGLRecord.name}` : ''
  )
  const [glOpen, setGlOpen] = useState(false)
  const [selectedGLType, setSelectedGLType] = useState<string>(
    initialGLRecord?.budgetType ?? ''
  )

  const [vendorId, setVendorId] = useState(initialData?.vendorId ?? '')
  const [vendorSearch, setVSearch] = useState(initialData?.vendorName ?? '')
  const [vendorOpen, setVOpen] = useState(false)

  const [isOneTimeVendor, setIsOneTimeVendor] = useState(
    initialData?.vendorIsOneTime ?? false
  )
  const [oneTimeVendorPhone, setOTVPhone] = useState(
    initialData?.oneTimeVendorPhone ?? ''
  )
  const [oneTimeVendorBankName, setOTVBankName] = useState(
    initialData?.oneTimeVendorBankName ?? ''
  )
  const [oneTimeVendorBankAccountNo, setOTVBankAccountNo] = useState(
    initialData?.oneTimeVendorBankAccountNo ?? ''
  )
  const [oneTimeVendorBankAccountName, setOTVBankAccountName] = useState(
    initialData?.oneTimeVendorBankAccountName ?? ''
  )
  const [oneTimeVendorReason, setOTVReason] = useState(
    initialData?.oneTimeVendorReason ?? ''
  )

  const initialVendorRecord = vendors.find(
    v => v.id === initialData?.vendorId || v.name === initialData?.vendorName
  )
  const [selectedVendor, setSelVendor] = useState<Vendor | null>(
    initialVendorRecord ?? null
  )

  const [showCrossEntityWarning, setShowCrossEntityWarning] = useState(false)

  const [crossEntityInfo, setCrossEntityInfo] = useState<{
    invoiceEntityCode: string
    budgetEntityCode: string
    glName: string
  } | null>(null)

  const [assetId, setAssetId] = useState('')
  const [assetSearch, setAssetSearch] = useState('')
  const [assetOpen, setAssetOpen] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetLoading, setAssetLoading] = useState(false)
  const [selectedAsset, setSelAsset] = useState<Asset | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [maintenanceOpen, setMtcOpen] = useState(false)

  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetSerial, setNewAssetSerial] = useState('')

  const [budgetData, setBudgetData] = useState<{
    annualBudget: number
    monthlyBudget: number
    monthlyCommitted: number
    monthlyAvailable: number
    financialYear: number
    currentMonth: number
  } | null>(null)
  const [isExceptional, setIsExceptional] = useState(
    initialData?.isBudgetExceeded ?? false
  )
  const [justification, setJustification] = useState('')

  interface EligibleApprover {
    userId: string
    name: string
    email: string
    approvalLimitAmount: number | null
    isExceptionalApprover: boolean
  }
  interface ApproverStep {
    stepNumber: number
    label: string
    approvers: EligibleApprover[]
  }
  const [approverSteps, setApproverSteps] = useState<ApproverStep[]>([])
  const [selectedApprovers, setSelectedApprovers] = useState<Record<number, string>>({})
  const [approverLoading, setApproverLoading] = useState(false)
  const [approverError, setApproverError] = useState('')
  const [approverSearch, setApproverSearch] = useState<Record<number, string>>({})
  const [approverOpenStep, setApproverOpenStep] = useState<number | null>(null)

  useEffect(() => {
    if (!entityId) {
      setApproverSteps([])
      return
    }
    let cancelled = false
    setApproverLoading(true)
    setApproverError('')
    fetch(
      `/api/approval-workflows/eligible-approvers?entityId=${entityId}&module=invoice&isBudgetExceeded=${isExceptional}`
    )
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setApproverSteps(data.steps ?? [])
        if (data.message) setApproverError(data.message)
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

  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.lineItems ?? []
  )

  const [totals, setTotals] = useState<InvoiceTotals>({
    subtotal: 0,
    vatAmount: 0,
    totalPlusVat: 0,
    whtAmount: 0,
    amountPayable: 0
  })

  const [attachments, setAttachments] = useState<AttachedFile[]>(
    (initialData?.attachments ?? []).map(att => ({
      id: genId(),
      name: att.name,
      size: att.size,
      type: att.type,
      url: att.url,
      base64: ''
    }))
  )
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')

  const glRef = useRef<HTMLDivElement>(null)
  const vendorRef = useRef<HTMLDivElement>(null)
  const assetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (glRef.current && !glRef.current.contains(e.target as Node))
        setGlOpen(false)
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node))
        setVOpen(false)
      if (assetRef.current && !assetRef.current.contains(e.target as Node))
        setAssetOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!entityId) return
    setBranchId('')
    fetch(`/api/branches?entityId=${entityId}&active=true`)
      .then(r => r.json())
      .then(d => setBranches(d.success ? d.data : []))
      .catch(() => setBranches([]))
  }, [entityId])

  useEffect(() => {
    if (invoiceType !== 'ASSET_RELATED' || !entityId) return
    setAssetLoading(true)
    fetch(`/api/assets?entityId=${entityId}&approval=APPROVED&take=200`)
      .then(r => r.json())
      .then(d =>
        setAssets(
          d.success
            ? d.data.map((a: any) => ({
                id: a.id,
                assetNo: a.assetNo,
                name: a.name,
                condition: a.condition,
                branchName: a.branch?.name
              }))
            : []
        )
      )
      .catch(() => setAssets([]))
      .finally(() => setAssetLoading(false))
  }, [invoiceType, entityId])

  useEffect(() => {
    if (
      invoiceType !== 'ASSET_RELATED' ||
      !initialData?.asset ||
      assetLoading
    ) {
      return
    }

    setAssetId(initialData.asset.id)
    setSelAsset(initialData.asset)
    setAssetSearch(`${initialData.asset.assetNo} — ${initialData.asset.name}`)

    loadMaintenance(initialData.asset.id)
  }, [invoiceType, assetLoading, initialData])

  const loadMaintenance = async (aid: string) => {
    try {
      const res = await fetch(`/api/assets/${aid}/maintenance`)
      const data = await res.json()
      setMaintenance(data.success ? data.data : [])
    } catch {
      setMaintenance([])
    }
  }

  const handleGLSelectionChange = (
    idValue: string,
    displayCodeAndName: string
  ) => {
    const matchedAccount = glOptions.find(
      g => g.id === idValue || g.code === idValue
    ) as any

    if (!matchedAccount) {
      setSelectedGLType('')
      setActualGLId('')
      return
    }

    setGlId(idValue)

    setActualGLId(matchedAccount.glAccountId || matchedAccount.id)

    setBudgetEntityId(matchedAccount.budgetEntityId)

    setGlSearch('')
    setGlOpen(false)

    setSelectedGLType(matchedAccount.budgetType ?? 'OPEX')

    const invoiceEntity = entities.find(e => e.id === entityId)

    const budgetEntity = entities.find(
      e => e.id === matchedAccount.budgetEntityId
    )

    console.log('Cross Entity Check:', {
      invoiceEntityId: entityId,
      budgetEntityId: matchedAccount.budgetEntityId,
      invoiceEntityCode: invoiceEntity?.code,
      budgetEntityCode: budgetEntity?.code,
      selectedGLId: matchedAccount.id,
      actualGLId: matchedAccount.glAccountId
    })

    if (invoiceEntity && budgetEntity && invoiceEntity.id !== budgetEntity.id) {
      setCrossEntityInfo({
        invoiceEntityCode: invoiceEntity.code,
        budgetEntityCode: budgetEntity.code,
        glName: matchedAccount.name
      })

      setShowCrossEntityWarning(true)
    } else {
      setShowCrossEntityWarning(false)
      setCrossEntityInfo(null)
    }
  }
  useEffect(() => {
    const effectiveEntityId = budgetEntityId || entityId
    if (!effectiveEntityId) return

    const t = setTimeout(() => {
      const ctrl = new AbortController()
      fetch(
        `/api/gl-accounts/search?entityId=${effectiveEntityId}&q=${encodeURIComponent(glSearch.trim())}`,
        { signal: ctrl.signal }
      )
        .then(r => r.json())
        .then(d => {
          if (d.success) setGlOptions(d.data)
        })
        .catch(() => {})
      return () => ctrl.abort()
    }, 300)

    return () => clearTimeout(t)
  }, [entityId, budgetEntityId, glSearch])

  const filteredGL = useMemo(() => {
    const q = glSearch.trim().toLowerCase()

    return glOptions.filter(g => {
      const searchText = [g.code, g.name, g.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return !q || searchText.includes(q)
    })
  }, [glOptions, glSearch])

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.toLowerCase()
    return vendors.filter(
      v =>
        v.name.toLowerCase().includes(q) ||
        (v.code ?? '').toLowerCase().includes(q) ||
        (v.email ?? '').toLowerCase().includes(q)
    )
  }, [vendors, vendorSearch])

  const filteredAssets = useMemo(() => {
    const q = assetSearch.toLowerCase()
    return assets.filter(
      a =>
        a.name.toLowerCase().includes(q) || a.assetNo.toLowerCase().includes(q)
    )
  }, [assets, assetSearch])
  const selectedGL = useMemo(
    () => glOptions.find(g => g.id === glAccountId),
    [glOptions, glAccountId]
  )

  useEffect(() => {
    if (!actualGLId || !entityId || totals.subtotal <= 0 || !selectedGL?.code) {
      setBudgetData(null)
      setIsExceptional(false)
      return
    }

    const ctrl = new AbortController()

    fetch(
      `/api/budgets/check?entityId=${budgetEntityId || entityId}&glAccountCode=${encodeURIComponent(selectedGL.code)}&amount=${totals.totalPlusVat}`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then(d => {
        if (!d.success || !d.data || !d.data.found) {
          setBudgetData(null)
          setIsExceptional(false)
          return
        }

        const b = d.data

        setBudgetData({
          annualBudget: b.annualBudget,
          monthlyBudget: b.monthlyBudget,
          monthlyCommitted: b.monthlyCommitted,
          monthlyAvailable: b.monthlyAvailable,
          financialYear: b.financialYear,
          currentMonth: b.currentMonth
        })

        setIsExceptional(b.exceeded)
      })
      .catch(() => {})

    return () => ctrl.abort()
  }, [
    actualGLId,
    entityId,
    budgetEntityId,
    selectedGL?.code,
    totals.subtotal,
    totals.totalPlusVat
  ])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    setUploadingFiles(true)
    const newAttachments: AttachedFile[] = []

    for (const file of files) {
      if (
        !ALLOWED_TYPES.includes(file.type) &&
        !file.name.match(
          /\.(pdf|xls|xlsx|doc|docx|html|htm|png|jpg|jpeg|gif|webp|svg)$/i
        )
      ) {
        continue
      }

      const isImage = file.type.startsWith('image/')
      const maxDocSize = 8 * 1024 * 1024

      if (!isImage && file.size > maxDocSize) {
        alert(
          `❌ Document upload rejected! The maximum allowed file size for PDFs, Word, or Excel sheets is 8MB. Your file "${
            file.name
          }" is ${Math.round(
            file.size / 1024 / 1024
          )}MB. Please optimize it before attaching.`
        )
        continue
      }

      const base64 = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      try {
        const optimizedBase64 = await compressImageBase64(base64, 1200, 750000)

        newAttachments.push({
          id: genId(),
          name: file.name,
          size: file.size,
          type: file.type,
          base64: optimizedBase64
        })
      } catch (err) {
        console.error(
          `[Form Compressor Error] Failed to optimize "${file.name}". Using raw stream fallback:`,
          err
        )
        newAttachments.push({
          id: genId(),
          name: file.name,
          size: file.size,
          type: file.type,
          base64: base64
        })
      }
    }

    setAttachments(prev => [...prev, ...newAttachments])
    setUploadingFiles(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const downloadAttachment = (att: AttachedFile) => {
    window.open(att.url || att.base64, '_blank')
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!entityId) e.entity = 'Entity is required'
    if (isOneTimeVendor) {
      if (!vendorSearch.trim()) e.vendor = 'Vendor/payee name is required'
      else if (!oneTimeVendorReason.trim())
        e.oneTimeVendorReason = 'Please state the reason for this one-time payment'
    } else if (!vendorId && !vendorSearch.trim()) {
      e.vendor = 'Vendor is required'
    }
    if (!description.trim()) e.description = 'Description / Purpose is required'
    if (!glAccountId) e.glAccount = 'GL Account is required'
    if (!lineItems.length || lineItems.every(l => !l.description.trim())) {
      e.lineItems = 'At least one line item with a description is required'
    }
    if (!attachments.length) {
      e.attachments = 'At least one attachment is required before submitting'
    }
    if (isExceptional && !justification.trim()) {
      e.justification = 'Justification is required when budget is exceeded'
    }
    if (invoiceType === 'ASSET_RELATED' && !assetId) {
      e.asset = 'Please select the asset this invoice relates to'
    }
    if (!approverSteps.length) {
      e.approvers = 'No approval workflow is configured for this entity — an Administrator must configure one before invoices can be submitted'
    } else if (approverSteps.some(s => !selectedApprovers[s.stepNumber])) {
      e.approvers = 'Please select an approver for every required step in the approval sequence'
    } else {
      const insufficientStep = approverSteps.find(s => {
        const a = s.approvers.find(a => a.userId === selectedApprovers[s.stepNumber])
        return a && a.approvalLimitAmount != null && a.approvalLimitAmount < totals.totalPlusVat
      })
      if (insufficientStep) {
        e.approvers = `The approver selected for Step ${insufficientStep.stepNumber} has an approval limit below this invoice's Total + VAT (${fmt(totals.totalPlusVat)}). Please select a different approver with a higher limit.`
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log('New below submit')
    console.log({
      glAccountId,
      actualGLId,
      budgetEntityId
    })

    setApiError('')
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)
    try {
      const uploadedAttachments: {
        url: string
        name: string
        type: string
        size: number
      }[] = []
      for (const att of attachments) {
        if (att.url) {
          uploadedAttachments.push({
            url: att.url,
            name: att.name,
            type: att.type,
            size: att.size
          })
          continue
        }
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: att.base64,
              folder: 'invoices/attachments'
            })
          })
          const uploadData = await uploadRes.json()
          if (uploadRes.ok) {
            uploadedAttachments.push({
              url: uploadData.data.url,
              name: att.name,
              type: att.type,
              size: att.size
            })
          }
        } catch {
        }
      }

      const body = {
        entityId,
        budgetEntityId,
        branchId: branchId || undefined,
        vendorId: isOneTimeVendor ? undefined : (vendorId || undefined),
        vendorName: isOneTimeVendor ? vendorSearch.trim() : (selectedVendor?.name ?? vendorSearch.trim()),
        vendorEmail: isOneTimeVendor ? undefined : (selectedVendor?.email ?? undefined),
        vendorIsOneTime: isOneTimeVendor,
        oneTimeVendorPhone: isOneTimeVendor ? (oneTimeVendorPhone || undefined) : undefined,
        oneTimeVendorBankName: isOneTimeVendor ? (oneTimeVendorBankName || undefined) : undefined,
        oneTimeVendorBankAccountNo: isOneTimeVendor ? (oneTimeVendorBankAccountNo || undefined) : undefined,
        oneTimeVendorBankAccountName: isOneTimeVendor ? (oneTimeVendorBankAccountName || undefined) : undefined,
        oneTimeVendorReason: isOneTimeVendor ? (oneTimeVendorReason || undefined) : undefined,
        description,
        glAccountId: actualGLId || glAccountId,
        glAccountCode: selectedGL?.code ?? '',
        invoiceType,
        assetId: invoiceType === 'ASSET_RELATED' ? assetId : undefined,
        newAssetName:
          invoiceType === 'ASSET_PURCHASE' ? newAssetName : undefined,
        newAssetSerial:
          invoiceType === 'ASSET_PURCHASE' ? newAssetSerial : undefined,
        subtotal: totals.subtotal,
        vatRate: 0.075,
        vatAmount: totals.vatAmount,
        whtRate: 0.02,
        whtAmount: totals.whtAmount,
        totalAmount: totals.totalPlusVat,
        amountPayable: totals.amountPayable,
        isBudgetExceeded: isExceptional,
        isExceptionalApproval: isExceptional,
        exceptionalJustification: isExceptional ? justification : undefined,
        approverSelections: Object.entries(selectedApprovers).map(([stepNumber, userId]) => ({
          stepNumber: Number(stepNumber),
          userId
        })),
        lineItems: lineItems.map((l, i) => ({
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
          totalCost: l.totalCost,
          sortOrder: i
        })),
        attachments: uploadedAttachments.length
          ? uploadedAttachments
          : attachments.map(a => ({
              name: a.name,
              type: a.type,
              size: a.size,
              url: ''
            }))
      }

      const isEditMode = !!initialData?.id

      const res = await fetch(
        isEditMode ? `/api/invoices/${initialData.id}` : '/api/invoices',
        {
          method: isEditMode ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )

      const text = await res.text()
      let data: any = {}
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Server error (${res.status})`)
      }
      if (!res.ok) {
        if (data?.details) {
          const fieldMsgs = Object.entries(
            data.details as Record<string, string[]>
          )
            .filter(([, v]) => v?.length)
            .map(([k, v]) => `${k}: ${v[0]}`)
            .slice(0, 3)
            .join(' | ')
          throw new Error(fieldMsgs || data.error || 'Validation failed')
        }
        throw new Error(data.error ?? 'Failed to create invoice')
      }

      router.push(`/invoice/${data.data.id}`)
      router.refresh()
    } catch (err: any) {
      setApiError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
  const labelCls =
    'block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'
  const errCls = 'text-xs text-red-500 dark:text-red-400 mt-1 font-medium'

  return (
    <>
      {(loading || uploadingFiles) && (
        <div className='fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm'>
          <div className='bg-card border border-border rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4'>
            <div className='w-14 h-14 mx-auto mb-5 relative'>
              <div className='absolute inset-0 rounded-full border-4 border-muted' />
              <div className='absolute inset-0 rounded-full border-4 border-[#FFB800] border-t-transparent animate-spin' />
            </div>
            <div className='font-bold text-foreground text-lg mb-2'>
              {uploadingFiles
                ? 'Uploading Attachments…'
                : 'Submitting Invoice Requisition…'}
            </div>
            <p className='text-sm text-muted-foreground'>
              {uploadingFiles
                ? 'Please wait while your files are being uploaded securely.'
                : 'Your invoice is being processed. Please do not close this window.'}
            </p>
          </div>
        </div>
      )}

      {showCrossEntityWarning && crossEntityInfo && (
        <div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/50'>
          <div className='bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl'>
            <h3 className='text-lg font-bold text-amber-600 mb-3'>
              ⚠ Cross-Entity Budget Allocation
            </h3>

            <p className='text-sm text-foreground mb-4'>You selected:</p>

            <div className='bg-muted rounded-xl p-4 text-sm mb-4'>
              <div>
                <strong>GL Account:</strong> {crossEntityInfo.glName}
              </div>

              <div>
                <strong>Budget Entity:</strong>{' '}
                {crossEntityInfo.budgetEntityCode}
              </div>

              <div>
                <strong>Invoice Entity:</strong>{' '}
                {crossEntityInfo.invoiceEntityCode}
              </div>
            </div>

            <div className='text-sm text-muted-foreground mb-6'>
              This invoice will be processed under{' '}
              <strong>{crossEntityInfo.invoiceEntityCode}</strong> but charged
              against <strong>{crossEntityInfo.budgetEntityCode}</strong>{' '}
              approved budget allocation.
            </div>

            <div className='flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => {
                  setShowCrossEntityWarning(false)
                }}
                className='px-4 py-2 rounded-xl bg-[#FFB800] text-[#1B2A8A] font-bold'
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6'>
        {(apiError || Object.keys(errors).length > 0) && (
          <div className='p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm'>
            {apiError
              ? `⚠️ ${apiError}`
              : `⚠️ Please fix ${Object.keys(errors).length} field${
                  Object.keys(errors).length > 1 ? 's' : ''
                } before submitting.`}
          </div>
        )}

        <div className='bg-card border border-border rounded-2xl p-5'>
          <h2 className='font-bold text-foreground mb-3'>Invoice Type</h2>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            {INVOICE_TYPES.map(type => {
              const active = invoiceType === type.id
              return (
                <button
                  key={type.id}
                  type='button'
                  onClick={() => {
                    setInvoiceType(type.id)
                    setAssetId('')
                    setSelAsset(null)
                    setMaintenance([])
                  }}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-[#FFB800] bg-[#FFB800]/10'
                      : 'border-border bg-background hover:border-[#FFB800]/40'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex-shrink-0 ${
                      active ? 'text-[#FFB800]' : 'text-muted-foreground'
                    }`}
                  >
                    {type.icon}
                  </div>
                  <div>
                    <div
                      className={`font-bold text-sm ${
                        active
                          ? 'text-[#1B2A8A] dark:text-[#FFB800]'
                          : 'text-foreground'
                      }`}
                    >
                      {type.label}
                    </div>
                    <div className='text-xs text-muted-foreground mt-0.5'>
                      {type.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className='bg-card border border-border rounded-2xl p-6 space-y-4'>
          <h2 className='font-bold text-foreground'>Invoice Details</h2>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={labelCls}>
                Entity <span className='text-red-500'>*</span>
              </label>
              <select
                className={inputCls}
                value={entityId}
                onChange={e => {
                  setEntityId(e.target.value)

                  setGlId('')
                  setBudgetEntityId('')

                  setGlSearch('')
                  setSelectedGLType('')
                }}
                required
              >
                {entities.map(en => (
                  <option key={en.id} value={en.id}>
                    {en.name} ({en.code})
                  </option>
                ))}
              </select>
              {errors.entity && <p className={errCls}>{errors.entity}</p>}
            </div>
            <div>
              <label className={labelCls}>
                Branch{' '}
                <span className='normal-case font-normal text-muted-foreground'>
                  (optional)
                </span>
              </label>
              <select
                className={inputCls}
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
              >
                <option value=''>— Select Branch —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Payee Type</label>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => setIsOneTimeVendor(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  !isOneTimeVendor
                    ? 'border-[#FFB800] bg-[#FFB800]/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                Registered Vendor
              </button>
              <button
                type='button'
                onClick={() => {
                  setIsOneTimeVendor(true)
                  setVendorId('')
                  setSelVendor(null)
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isOneTimeVendor
                    ? 'border-[#FFB800] bg-[#FFB800]/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                One-Time Vendor
              </button>
            </div>
            {isOneTimeVendor && (
              <p className='text-xs text-muted-foreground mt-1.5'>
                For a payee with no permanent vendor record — e.g. a roadside
                repair, a one-off supplier for a single event. If this payee
                is used repeatedly, consider registering them as a vendor
                instead.
              </p>
            )}
          </div>

          {!isOneTimeVendor && (
          <div>
            <label className={labelCls}>
              Vendor <span className='text-red-500'>*</span>
            </label>
            <div className='relative' ref={vendorRef}>
              <input
                type='text'
                className={`${inputCls} ${
                  errors.vendor ? 'border-red-400' : ''
                }`}
                placeholder='Search vendors by name or code…'
                value={vendorSearch}
                onChange={e => {
                  setVSearch(e.target.value)
                  setVendorId('')
                  setSelVendor(null)
                  setVOpen(true)
                }}
                onFocus={() => setVOpen(true)}
                autoComplete='off'
              />
              {vendorOpen && (
                <div className='absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                  {filteredVendors.length === 0 ? (
                    <div className='px-4 py-3 text-sm text-muted-foreground'>
                      No vendors match "{vendorSearch}"
                    </div>
                  ) : (
                    filteredVendors.slice(0, 20).map(v => (
                      <button
                        key={v.id}
                        type='button'
                        className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors'
                        onClick={() => {
                          setVendorId(v.id)
                          setVSearch(v.name)
                          setSelVendor(v)
                          setVOpen(false)
                        }}
                      >
                        <span className='font-semibold text-foreground'>
                          {v.name}
                        </span>
                        {v.code && (
                          <code className='ml-2 text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground'>
                            {v.code}
                          </code>
                        )}
                        {v.email && (
                          <span className='ml-2 text-xs text-muted-foreground'>
                            {v.email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedVendor && (
              <div className='mt-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 space-y-0.5'>
                <div className='font-bold'>✓ {selectedVendor.name}</div>
                {selectedVendor.contactPerson && (
                  <div>
                    Contact: {selectedVendor.contactPerson}{' '}
                    {selectedVendor.contactPhone
                      ? `· ${selectedVendor.contactPhone}`
                      : ''}
                  </div>
                )}
                {selectedVendor.bankName && (
                  <div>
                    Bank: {selectedVendor.bankName} —{' '}
                    {selectedVendor.bankAccountNo}
                  </div>
                )}
                {selectedVendor.taxId && (
                  <div>Tax ID: {selectedVendor.taxId}</div>
                )}
              </div>
            )}
            {errors.vendor && <p className={errCls}>{errors.vendor}</p>}
          </div>
          )}

          {isOneTimeVendor && (
            <div className='space-y-4 p-4 rounded-xl border border-dashed border-border bg-muted/20'>
              <div>
                <label className={labelCls}>
                  Vendor / Payee Name <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  className={`${inputCls} ${errors.vendor ? 'border-red-400' : ''}`}
                  placeholder="e.g. Mama's Kitchen, Roadside Vulcanizer"
                  value={vendorSearch}
                  onChange={e => setVSearch(e.target.value)}
                />
                {errors.vendor && <p className={errCls}>{errors.vendor}</p>}
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type='text'
                  className={inputCls}
                  placeholder='+234 800 000 0000'
                  value={oneTimeVendorPhone}
                  onChange={e => setOTVPhone(e.target.value)}
                />
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                <div>
                  <label className={labelCls}>Bank Name</label>
                  <input
                    type='text'
                    className={inputCls}
                    value={oneTimeVendorBankName}
                    onChange={e => setOTVBankName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Account Number</label>
                  <input
                    type='text'
                    inputMode='numeric'
                    maxLength={10}
                    className={inputCls}
                    value={oneTimeVendorBankAccountNo}
                    onChange={e =>
                      setOTVBankAccountNo(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Account Name</label>
                  <input
                    type='text'
                    className={inputCls}
                    value={oneTimeVendorBankAccountName}
                    onChange={e => setOTVBankAccountName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  Reason for One-Time Payment <span className='text-red-500'>*</span>
                </label>
                <textarea
                  rows={2}
                  className={`${inputCls} ${errors.oneTimeVendorReason ? 'border-red-400' : ''}`}
                  placeholder='e.g. Emergency roadside tyre repair during official assignment'
                  value={oneTimeVendorReason}
                  onChange={e => setOTVReason(e.target.value)}
                />
                {errors.oneTimeVendorReason && (
                  <p className={errCls}>{errors.oneTimeVendorReason}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>
              Description / Purpose <span className='text-red-500'>*</span>
            </label>
            <textarea
              className={`${inputCls} ${
                errors.description ? 'border-red-400' : ''
              }`}
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this invoice covers and why it's needed…"
              required
            />
            {errors.description && (
              <p className={errCls}>{errors.description}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>
              GL Account <span className='text-red-500'>*</span>
              <span className='normal-case font-normal text-muted-foreground ml-1'>
                (OPEX & CAPEX)
              </span>
            </label>
            <div className='relative' ref={glRef}>
              <div className='relative flex items-center'>
                <input
                  type='text'
                  className={`${inputCls} pr-10 ${
                    errors.glAccount ? 'border-red-400' : ''
                  }`}
                  placeholder='Search by code, name or category…'
                  value={
                    glOpen
                      ? glSearch
                      : selectedGL
                      ? `${selectedGL.code} — ${selectedGL.name}`
                      : ''
                  }
                  onChange={e => {
                    setGlSearch(e.target.value)
                    setGlId('')
                    setGlOpen(true)
                  }}
                  onFocus={() => {
                    setGlSearch('')
                    setGlOpen(true)
                  }}
                  autoComplete='off'
                />

                {glSearch && (
                  <button
                    type='button'
                    onClick={() => {
                      setGlSearch('')
                      setGlId('')
                      setSelectedGLType('')
                      setGlOpen(false)
                    }}
                    className='absolute right-3 p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all'
                    title='Clear selection'
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {glOpen && (
                <div className='absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                  {filteredGL.length === 0 ? (
                    <div className='px-4 py-3 text-sm text-muted-foreground'>
                      No accounts match "{glSearch}"
                    </div>
                  ) : (
                    filteredGL.slice(0, 30).map(gl => (
                      <button
                        key={gl.id}
                        type='button'
                        className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between'
                        onClick={() =>
                          handleGLSelectionChange(
                            gl.id,
                            `${gl.code} — ${gl.name}`
                          )
                        }
                      >
                        <span>
                          <code className='text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-1.5 py-0.5 rounded mr-2'>
                            {gl.code}
                          </code>
                          {gl.name}
                        </span>
                        <span className='text-xs text-muted-foreground ml-4 shrink-0'>
                          {gl.category}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedGL && (
              <p className='text-xs text-green-600 dark:text-green-400 mt-1 font-medium'>
                ✓ {selectedGL.code} — {selectedGL.name} ({selectedGL.category})
              </p>
            )}

            {selectedGLType && (
              <div
                className={`mt-2.5 text-xs font-semibold px-3 py-2 rounded-xl w-fit flex items-center gap-2 border shadow-sm transition-all ${
                  selectedGLType === 'CAPEX'
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                <span className='text-sm'>
                  {selectedGLType === 'CAPEX' ? '🏢' : '⚙️'}
                </span>
                <div>
                  This account maps to an approved{' '}
                  <strong className='underline tracking-wide'>
                    {selectedGLType}
                  </strong>{' '}
                  allocation (
                  {selectedGLType === 'CAPEX'
                    ? 'Capital Expenditure — Long-term physical assets or procurement investments'
                    : 'Operating Expenditure — Ongoing operational running costs'}
                  ) for financial year {new Date().getFullYear()}.
                </div>
              </div>
            )}

            {errors.glAccount && <p className={errCls}>{errors.glAccount}</p>}
          </div>
        </div>

        {invoiceType === 'ASSET_RELATED' && (
          <div className='bg-card border border-border rounded-2xl p-6 space-y-4'>
            <h2 className='font-bold text-foreground'>Linked Asset</h2>
            <div>
              <label className={labelCls}>
                Search Asset <span className='text-red-500'>*</span>
              </label>
              <div className='relative' ref={assetRef}>
                <input
                  type='text'
                  className={`${inputCls} ${
                    errors.asset ? 'border-red-400' : ''
                  }`}
                  placeholder='Search by asset number or name…'
                  value={assetSearch}
                  onChange={e => {
                    setAssetSearch(e.target.value)
                    setAssetId('')
                    setSelAsset(null)
                    setMaintenance([])
                    setAssetOpen(true)
                  }}
                  onFocus={() => setAssetOpen(true)}
                  autoComplete='off'
                  disabled={assetLoading}
                />
                {assetOpen && filteredAssets.length > 0 && (
                  <div className='absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-card border border-border rounded-xl shadow-xl'>
                    {filteredAssets.slice(0, 15).map(a => (
                      <button
                        key={a.id}
                        type='button'
                        className='w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors'
                        onClick={() => {
                          setAssetId(a.id)
                          setAssetSearch(`${a.assetNo} — ${a.name}`)
                          setSelAsset(a)
                          setAssetOpen(false)
                          loadMaintenance(a.id)
                        }}
                      >
                        <code className='text-xs font-bold bg-muted px-1.5 py-0.5 rounded mr-2 text-[#1B2A8A] dark:text-blue-300'>
                          {a.assetNo}
                        </code>
                        <span className='font-medium text-foreground'>
                          {a.name}
                        </span>
                        {a.branchName && (
                          <span className='text-xs text-muted-foreground ml-2'>
                            · {a.branchName}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.asset && <p className={errCls}>{errors.asset}</p>}
            </div>

            {selectedAsset && (
              <div className='border border-border rounded-xl overflow-hidden'>
                <button
                  type='button'
                  onClick={() => setMtcOpen(o => !o)}
                  className='w-full flex items-center justify-between px-4 py-3 bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors'
                >
                  <span>
                    🔧 Repair / Maintenance History — {selectedAsset.name}
                  </span>
                  {maintenanceOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {maintenanceOpen && (
                  <div className='divide-y divide-border'>
                    {maintenance.length === 0 ? (
                      <div className='px-4 py-6 text-center text-sm text-muted-foreground'>
                        No maintenance records found for this asset
                      </div>
                    ) : (
                      maintenance.map(m => (
                        <div
                          key={m.id}
                          className='px-4 py-3 flex items-center justify-between'
                        >
                          <div>
                            <div className='text-sm font-medium text-foreground'>
                              {m.type.replace('_', ' ')}
                            </div>
                            {m.description && (
                              <div className='text-xs text-muted-foreground mt-0.5'>
                                {m.description}
                              </div>
                            )}
                          </div>
                          <div className='text-right'>
                            <div className='text-sm font-semibold text-foreground'>
                              {fmt(m.cost)}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {new Date(m.performedAt).toLocaleDateString(
                                'en-NG'
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {invoiceType === 'ASSET_PURCHASE' && (
          <div className='bg-card border border-border rounded-2xl p-6 space-y-4'>
            <h2 className='font-bold text-foreground'>New Asset Details</h2>
            <p className='text-sm text-muted-foreground'>
              After approval, a new asset record will be created from this
              invoice.
            </p>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className={labelCls}>Asset Name *</label>
                <input
                  type='text'
                  className={inputCls}
                  value={newAssetName}
                  onChange={e => setNewAssetName(e.target.value)}
                  placeholder='e.g. Dell Laptop'
                />
              </div>
              <div>
                <label className={labelCls}>
                  Serial Number{' '}
                  <span className='normal-case font-normal text-muted-foreground'>
                    (optional)
                  </span>
                </label>
                <input
                  type='text'
                  className={inputCls}
                  value={newAssetSerial}
                  onChange={e => setNewAssetSerial(e.target.value)}
                  placeholder='e.g. SN-12345'
                />
              </div>
            </div>
          </div>
        )}

        <div className='bg-card border border-border rounded-2xl p-6'>
          <InvoiceLineItems
            initialItems={lineItems}
            onChange={(items, t) => {
              setLineItems(items)
              setTotals(t)
            }}
          />
          {errors.lineItems && (
            <p className={`${errCls} mt-2`}>{errors.lineItems}</p>
          )}
        </div>

        {isExceptional && budgetData && (
          <div className='bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-5 space-y-3'>
            <div className='flex items-start gap-2'>
              <AlertTriangle
                size={18}
                className='text-amber-600 mt-0.5 flex-shrink-0'
              />
              <div className='flex-1'>
                <div className='font-bold text-amber-800 dark:text-amber-300 text-sm'>
                  Monthly Budget Warning — {selectedGL?.name ?? 'this GL account'}
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-amber-700 dark:text-amber-400 mt-2'>
                  <div>Entity: <strong>{entities.find(e => e.id === (budgetEntityId || entityId))?.code ?? '—'}</strong></div>
                  <div>GL Account: <strong>{selectedGL?.code ?? '—'}</strong></div>
                  <div>Budget Year: <strong>{budgetData.financialYear}</strong></div>
                  <div>Current Month: <strong>{new Date(budgetData.financialYear, budgetData.currentMonth - 1).toLocaleString('en-NG', { month: 'long' })}</strong></div>
                  <div>Annual Budget: <strong>{fmt(budgetData.annualBudget)}</strong></div>
                  <div>Current Month Budget: <strong>{fmt(budgetData.monthlyBudget)}</strong></div>
                  <div>Already Expensed: <strong>{fmt(budgetData.monthlyCommitted)}</strong></div>
                  <div>Current Available Balance: <strong>{fmt(budgetData.monthlyAvailable)}</strong></div>
                  <div>Current Invoice Total + VAT: <strong>{fmt(totals.totalPlusVat)}</strong></div>
                  <div className='font-bold text-red-700 dark:text-red-400'>
                    Projected Monthly Variance: {fmt(budgetData.monthlyAvailable - totals.totalPlusVat)}
                  </div>
                </div>
                <div className='text-xs text-amber-700 dark:text-amber-400 mt-2'>
                  This invoice will exceed the available budget for the
                  selected month by{' '}
                  <strong>{fmt(Math.max(0, totals.totalPlusVat - budgetData.monthlyAvailable))}</strong>.
                  It will require sign-off from an approver specifically
                  configured with Exceptional Approval Workflow permission
                  (see the approver selection below), and a negative
                  variance will be recorded in the budget dashboard.
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Budget Exception Justification{' '}
                <span className='text-red-500'>*</span>
              </label>
              <textarea
                className={inputCls}
                rows={3}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                placeholder='Please provide justification for exceeding the available monthly budget.'
              />
              {errors.justification && (
                <p className={errCls}>{errors.justification}</p>
              )}
            </div>
          </div>
        )}

        <div className='bg-card border border-border rounded-2xl p-6 space-y-4'>
          <div>
            <h2 className='font-bold text-foreground'>
              Approvers <span className='text-red-500'>*</span>
            </h2>
            <p className='text-xs text-muted-foreground mt-0.5'>
              Select the approver for each step of this entity's approval
              workflow, in sequence. Only approvers configured by your
              Administrator are shown.
              {isExceptional &&
                ' Since this invoice exceeds the available GL budget, only approvers with Exceptional Approval Workflow permission are shown.'}
            </p>
          </div>

          {approverLoading && (
            <p className='text-sm text-muted-foreground'>Loading eligible approvers…</p>
          )}

          {!approverLoading && approverError && (
            <div className='bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300'>
              {approverError}
            </div>
          )}

          {!approverLoading && approverSteps.length > 0 && (
            <div className='space-y-3'>
              {approverSteps.map(step => {
                const selectedId = selectedApprovers[step.stepNumber]
                const selected = step.approvers.find(a => a.userId === selectedId)
                const search = (approverSearch[step.stepNumber] ?? '').toLowerCase()
                const filtered = step.approvers.filter(
                  a =>
                    a.name.toLowerCase().includes(search) ||
                    a.email.toLowerCase().includes(search)
                )
                const isOpen = approverOpenStep === step.stepNumber
                return (
                  <div key={step.stepNumber} className='relative'>
                    <label className={labelCls}>
                      Step {step.stepNumber} — {step.label}
                    </label>
                    <button
                      type='button'
                      onClick={() =>
                        setApproverOpenStep(isOpen ? null : step.stepNumber)
                      }
                      className={`${inputCls} text-left flex items-center justify-between`}
                    >
                      {selected ? (
                        <span>
                          {selected.name}{' '}
                          <span className='text-muted-foreground'>
                            ({selected.email}) —{' '}
                            {selected.approvalLimitAmount
                              ? fmt(selected.approvalLimitAmount)
                              : 'No Limit'}
                          </span>
                        </span>
                      ) : (
                        <span className='text-muted-foreground'>
                          Select approver…
                        </span>
                      )}
                      <ChevronDown size={14} className='text-muted-foreground flex-shrink-0' />
                    </button>

                    {selected &&
                      selected.approvalLimitAmount != null &&
                      selected.approvalLimitAmount < totals.totalPlusVat && (
                        <p className='text-xs text-red-600 dark:text-red-400 font-medium mt-1.5 flex items-start gap-1'>
                          <span>⚠</span>
                          <span>
                            {selected.name}'s approval limit ({fmt(selected.approvalLimitAmount)}) is
                            below this invoice's Total + VAT ({fmt(totals.totalPlusVat)}). Please select
                            a different approver with a higher limit for this step to submit.
                          </span>
                        </p>
                      )}

                    {isOpen && (
                      <div className='absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto'>
                        <div className='p-2 border-b border-border sticky top-0 bg-card'>
                          <input
                            autoFocus
                            type='text'
                            placeholder='Search name or email…'
                            className={inputCls}
                            value={approverSearch[step.stepNumber] ?? ''}
                            onChange={e =>
                              setApproverSearch(prev => ({
                                ...prev,
                                [step.stepNumber]: e.target.value
                              }))
                            }
                          />
                        </div>
                        {filtered.length === 0 && (
                          <div className='p-3 text-sm text-muted-foreground'>
                            No matching approvers
                          </div>
                        )}
                        {filtered.map(a => {
                          const insufficientLimit =
                            a.approvalLimitAmount != null &&
                            a.approvalLimitAmount < totals.totalPlusVat
                          return (
                          <button
                            key={a.userId}
                            type='button'
                            onClick={() => {
                              setSelectedApprovers(prev => ({
                                ...prev,
                                [step.stepNumber]: a.userId
                              }))
                              setApproverOpenStep(null)
                            }}
                            className='w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex flex-col'
                          >
                            <span className='font-medium text-foreground flex items-center gap-1.5'>
                              {a.name}
                              {insufficientLimit && (
                                <span className='text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded'>
                                  ⚠ Limit too low
                                </span>
                              )}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                              {a.email} ·{' '}
                              {a.approvalLimitAmount
                                ? `Limit: ${fmt(a.approvalLimitAmount)}`
                                : 'No Limit'}
                              {a.isExceptionalApprover && ' · Exceptional Approver'}
                            </span>
                          </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {errors.approvers && <p className={errCls}>{errors.approvers}</p>}
        </div>

        <div className='bg-card border border-border rounded-2xl p-6 space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='font-bold text-foreground'>
                Attachments <span className='text-red-500'>*</span>
              </h2>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Required before submission. PDF, Excel, Word, HTML, images
                accepted. All approvers can view and download.
              </p>
            </div>
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles}
              className='flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-border bg-background hover:bg-accent transition-colors disabled:opacity-60'
            >
              <Upload size={14} /> {uploadingFiles ? 'Uploading…' : 'Add Files'}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type='file'
            accept={ALLOWED_EXTS}
            multiple
            className='hidden'
            onChange={handleFileSelect}
          />

          {attachments.length > 0 ? (
            <div className='divide-y divide-border border border-border rounded-xl overflow-hidden'>
              {attachments.map(att => (
                <div
                  key={att.id}
                  className='flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors'
                >
                  <FileText
                    size={16}
                    className='text-muted-foreground flex-shrink-0'
                  />
                  <div className='flex-1 min-w-0'>
                    <div className='text-sm font-medium text-foreground truncate'>
                      {att.name}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      {fmtSize(att.size)}
                    </div>
                  </div>
                  <div className='flex items-center gap-2 flex-shrink-0'>
                    <button
                      type='button'
                      onClick={() => downloadAttachment(att)}
                      className='flex items-center gap-1 text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline'
                    >
                      <Download size={12} /> Download
                    </button>
                    <button
                      type='button'
                      onClick={() => removeAttachment(att.id)}
                      className='p-1 rounded text-muted-foreground hover:text-red-500 transition-colors'
                      title='Remove'
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-[#FFB800] transition-colors ${
                errors.attachments ? 'border-red-400' : 'border-border'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload
                size={24}
                className='mx-auto mb-2 text-muted-foreground'
              />
              <div className='text-sm font-medium text-foreground'>
                Click to upload or drag & drop
              </div>
              <div className='text-xs text-muted-foreground mt-1'>
                PDF, Excel, Word, HTML, images
              </div>
            </div>
          )}
          {errors.attachments && <p className={errCls}>{errors.attachments}</p>}
        </div>

        <div className='flex gap-3'>
          <button
            type='submit'
            disabled={loading}
            className='px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-60 transition-all'
            style={{ background: '#FFB800', color: '#1B2A8A' }}
          >
            {loading ? 'Saving…' : 'Save Invoice Requisition'}
          </button>
          <button
            type='button'
            onClick={() => router.back()}
            className='px-8 py-3 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent'
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
