'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

export interface VendorFormData {
  name: string
  email: string
  phone: string
  address: string
  website: string
  taxId: string
  rcNumber: string
  contactPerson: string
  contactEmail: string
  contactPhone: string
  bankName: string
  bankAccountNo: string
  bankAccountName: string
  bankSortCode: string
  notes: string
  contractFileUrl: string
  contractFileName: string
  isApproved: boolean
}

async function fetchJSON (url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json'))
    throw new Error(`Server error (${res.status})`)
  const d = await res.json()
  if (!res.ok) throw new Error(d.error ?? 'Request failed')
  return d
}

const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition'
const labelCls = 'block text-sm font-bold text-foreground mb-1.5'
const sectionCls = 'bg-card border border-border rounded-2xl p-6 space-y-4'
const sectionTitleCls = 'text-sm font-extrabold text-foreground uppercase tracking-wide mb-1'

interface Props {
  mode: 'create' | 'edit'
  vendorId?: string
  initial: VendorFormData
}

export default function VendorForm ({ mode, vendorId, initial }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<VendorFormData>(initial)
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof VendorFormData> (key: K, value: VendorFormData[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit () {
    setErr('')
    if (!form.name.trim()) {
      setErr('Vendor name is required.')
      return
    }
    if (form.bankAccountNo && !/^\d{1,10}$/.test(form.bankAccountNo)) {
      setErr('Account Number must contain digits only and must not exceed 10 digits.')
      return
    }
    setSaving(true)
    try {
      const payload: any = { ...form }

      if (contractFile) {
        const allowed = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png',
          'image/jpeg',
          'image/webp'
        ]
        if (
          !allowed.includes(contractFile.type) &&
          !contractFile.name.match(/\.(pdf|doc|docx|png|jpg|jpeg|webp)$/i)
        ) {
          setErr('Contract file must be a PDF, Word document or image.')
          setSaving(false)
          return
        }
        if (contractFile.size > 10 * 1024 * 1024) {
          setErr('Contract file must be under 10 MB.')
          setSaving(false)
          return
        }
        const reader = new FileReader()
        const base64 = await new Promise<string>(res => {
          reader.onload = () => res(reader.result as string)
          reader.readAsDataURL(contractFile)
        })
        const uploadData = await fetchJSON('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64, folder: 'vendor-contracts' })
        })
        payload.contractFileUrl = uploadData.data.url
        payload.contractFileName = contractFile.name
      }

      if (mode === 'edit' && vendorId) {
        await fetchJSON(`/api/vendors/${vendorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        router.push(`/vendor/${vendorId}`)
      } else {
        const d = await fetchJSON('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        router.push(`/vendor/${d.vendor.id}`)
      }
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
      setSaving(false)
    }
  }

  const backHref = mode === 'edit' && vendorId ? `/vendor/${vendorId}` : '/vendor'

  return (
    <div className='max-w-3xl mx-auto space-y-6 pb-16'>
      <Link
        href={backHref}
        className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft size={14} /> {mode === 'edit' ? 'Back to vendor' : 'Back to vendors'}
      </Link>

      <div>
        <h1 className='text-2xl font-extrabold text-foreground'>
          {mode === 'edit' ? `Edit ${initial.name || 'Vendor'}` : 'New Vendor'}
        </h1>
        <p className='text-muted-foreground text-sm mt-1'>
          {mode === 'edit'
            ? "Update this vendor's details."
            : 'Register a new vendor. Any entity can use any vendor — vendors are not tied to a single entity.'}
        </p>
      </div>

      {err && (
        <div className='flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400'>
          <AlertCircle size={15} /> {err}
        </div>
      )}

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Company Details</h2>
        <div className='grid sm:grid-cols-2 gap-4'>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Vendor Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder='Acme Supplies Ltd' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder='vendor@email.com' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder='+234 800 000 0000' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input value={form.website} onChange={e => set('website', e.target.value)} placeholder='https://…' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>RC Number</label>
            <input value={form.rcNumber} onChange={e => set('rcNumber', e.target.value)} placeholder='CAC registration number' className={inputCls} />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Address</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder='123 Business Road, Lagos' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>TIN (Tax ID)</label>
            <input value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder='Tax identification number' className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Contact Person</h2>
        <div className='grid sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Name</label>
            <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder='Full name' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder='+234…' className={inputCls} />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Email</label>
            <input value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder='contact@vendor.com' className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Bank Details</h2>
        <p className='text-xs text-muted-foreground -mt-2'>
          Used by Payment when disbursing to this vendor.
        </p>
        <div className='grid sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Bank Name</label>
            <input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder='GTBank' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sort Code</label>
            <input value={form.bankSortCode} onChange={e => set('bankSortCode', e.target.value)} placeholder='Bank sort code' className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Account Number</label>
            <input
              value={form.bankAccountNo}
              inputMode='numeric'
              pattern='[0-9]*'
              maxLength={10}
              onChange={e => set('bankAccountNo', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder='0123456789'
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Account Name</label>
            <input value={form.bankAccountName} onChange={e => set('bankAccountName', e.target.value)} placeholder='Acme Supplies Limited' className={inputCls} />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Contract & Notes</h2>
        <div>
          <label className={labelCls}>
            Contract Agreement File{' '}
            <span className='font-normal text-muted-foreground'>(optional — PDF, Word or image)</span>
          </label>
          {form.contractFileUrl && !contractFile && (
            <div className='mb-2 flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border text-sm'>
              <span>📎</span>
              <a
                href={form.contractFileUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline truncate'
              >
                {form.contractFileName ?? 'View Contract'}
              </a>
              <span className='text-xs text-muted-foreground ml-auto'>Existing file</span>
            </div>
          )}
          <input
            type='file'
            accept='.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp'
            onChange={e => setContractFile(e.target.files?.[0] ?? null)}
            className='w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#FFB800] file:text-[#1B2A8A] cursor-pointer'
          />
          <p className='text-xs text-muted-foreground mt-1'>Accepted: PDF, Word (.doc/.docx), images. Max 10 MB.</p>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder='Any additional notes about this vendor'
            className={inputCls}
          />
        </div>

        <div className='flex items-center gap-3 pt-1'>
          <input
            type='checkbox'
            id='vendor-vetted'
            checked={form.isApproved}
            onChange={e => set('isApproved', e.target.checked)}
            className='accent-[#FFB800] w-4 h-4'
          />
          <label htmlFor='vendor-vetted' className='text-sm text-foreground cursor-pointer'>
            Mark as Admin-vetted / Approved vendor
          </label>
        </div>
      </section>

      <div className='flex gap-3'>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className='flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] font-extrabold text-sm disabled:opacity-50'
        >
          {saving && <Loader2 size={14} className='animate-spin' />}
          {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Vendor'}
        </button>
        <Link
          href={backHref}
          className='px-6 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent flex items-center'
        >
          Cancel
        </Link>
      </div>
    </div>
  )
}
