'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

interface ApprovalStep {
  id: string
  stepNumber: number
  roleName: string
  userName?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  actionedAt: string | null
  comment: string | null
  actionedBy: { name: string; email?: string } | null
}

interface ApprovalInstance {
  id: string
  status: string
  totalSteps: number
  currentStep: number
  steps: ApprovalStep[]
  workflow: { name: string }
}

interface Props {
  invoiceId: string
  instance: ApprovalInstance | null
  myPendingStep: ApprovalStep | null
}

function StepIcon ({ status }: { status: string }) {
  if (status === 'APPROVED')
    return <CheckCircle2 size={18} className='text-green-600' />
  if (status === 'REJECTED')
    return <XCircle size={18} className='text-red-600' />
  if (status === 'PENDING')
    return <Clock size={18} className='text-amber-500' />
  return <AlertCircle size={18} className='text-muted-foreground' />
}

export default function InvoiceApprovalSection ({
  invoiceId,
  instance: initialInstance,
  myPendingStep: initialPending
}: Props) {
  const [instance, setInstance] = useState(initialInstance)
  const [myPendingStep, setMyPendingStep] = useState(initialPending)
  const [submitting, setSubmitting] = useState(false)
  const [action, setAction] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/approval-status`)
      const data = await res.json()
      if (data.success) {
        setInstance(data.data.instance)
        setMyPendingStep(data.data.myPendingStep)
      }
    } catch {
    }
  }, [invoiceId])

  useEffect(() => {
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const submit = async () => {
    if (!action || !instance) return
    if (action === 'REJECTED' && !comment.trim()) {
      setError('Please provide a reason for rejection.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(
        `/api/approval-instances/${instance.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, comment: comment.trim() || undefined })
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')
      setDone(true)
      await refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!instance) {
    return (
      <div className='bg-card border border-border rounded-2xl p-5'>
        <h2 className='font-bold text-foreground mb-3 flex items-center gap-2'>
          <Clock size={16} /> Approval Status
        </h2>
        <p className='text-sm text-muted-foreground'>
          No approval workflow has been started for this invoice.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='bg-card border border-border rounded-2xl p-5'>
        <h2 className='font-bold text-foreground mb-4 flex items-center gap-2'>
          <CheckCircle2 size={16} /> Approval Workflow
          <span className='ml-auto text-xs text-muted-foreground font-normal'>
            {instance.workflow.name}
          </span>
        </h2>

        <div className='relative'>
          {instance.steps.map((step, index) => (
            <div key={step.id} className='flex gap-3 mb-4 last:mb-0'>
              <div className='flex flex-col items-center'>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                    step.status === 'APPROVED'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : step.status === 'REJECTED'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                      : step.status === 'PENDING' &&
                        instance.currentStep === step.stepNumber
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 animate-pulse'
                      : 'border-border bg-muted'
                  }`}
                >
                  <StepIcon status={step.status} />
                </div>
                {index < instance.steps.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 mt-1 ${
                      step.status === 'APPROVED' ? 'bg-green-500' : 'bg-border'
                    }`}
                    style={{ minHeight: 24 }}
                  />
                )}
              </div>

              <div className='flex-1 pb-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-semibold text-foreground'>
                    Step {step.stepNumber}: {step.userName || step.roleName}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      step.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                        : step.status === 'REJECTED'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                        : step.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>

                {step.actionedBy && (
                  <div className='text-xs text-muted-foreground mt-1'>
                    By: {step.actionedBy.name}
                    {step.actionedAt &&
                      ` · ${new Date(step.actionedAt).toLocaleDateString(
                        'en-NG',
                        { dateStyle: 'medium' }
                      )}`}
                  </div>
                )}
                {step.status === 'PENDING' &&
                  instance.currentStep === step.stepNumber && (
                    <div className='text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium'>
                      ⏳ Awaiting approval
                    </div>
                  )}
                {step.comment && (
                  <div className='mt-2 text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-1.5'>
                    "{step.comment}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {instance.status === 'FULLY_APPROVED' && (
          <div className='mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 font-semibold flex items-center gap-2'>
            <CheckCircle2 size={14} /> Fully Approved — ready for payment
          </div>
        )}
        {instance.status === 'REJECTED' && (
          <div className='mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 font-semibold flex items-center gap-2'>
            <XCircle size={14} /> Rejected
          </div>
        )}
      </div>

      {myPendingStep && !done && (
        <div className='bg-card border border-[#FFB800]/40 rounded-2xl p-5 space-y-4'>
          <h3 className='font-bold text-foreground flex items-center gap-2'>
            <span className='w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-extrabold'>
              {myPendingStep.stepNumber}
            </span>
            Your Approval Required
          </h3>
          {myPendingStep.roleName ? (
            <p className='text-xs text-muted-foreground'>
              Approving as: <strong>{myPendingStep.roleName}</strong>
            </p>
          ) : (
            <p className='text-xs text-muted-foreground'>
              Step {myPendingStep.stepNumber} of {instance?.totalSteps}
            </p>
          )}

          <div>
            <label className='block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5'>
              Comment{' '}
              {action === 'REJECTED' && <span className='text-red-500'>*</span>}
            </label>
            <textarea
              className='w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]'
              rows={3}
              placeholder={
                action === 'REJECTED'
                  ? 'Reason for rejection (required)…'
                  : 'Add a note (optional)…'
              }
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          {error && (
            <p className='text-xs text-red-600 font-medium'>⚠️ {error}</p>
          )}

          <div className='flex gap-3'>
            <button
              onClick={() => setAction('APPROVED')}
              disabled={submitting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                action === 'APPROVED'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'text-green-700 border-green-200 bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800'
              }`}
            >
              <CheckCircle2 size={14} /> Approve
            </button>
            <button
              onClick={() => setAction('REJECTED')}
              disabled={submitting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                action === 'REJECTED'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'text-red-700 border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800'
              }`}
            >
              <XCircle size={14} /> Reject
            </button>
            {action && (
              <button
                onClick={submit}
                disabled={submitting}
                className='ml-auto px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60'
                style={{ background: '#FFB800', color: '#1B2A8A' }}
              >
                {submitting
                  ? 'Processing…'
                  : `Confirm ${
                      action === 'APPROVED' ? 'Approval' : 'Rejection'
                    }`}
              </button>
            )}
          </div>
        </div>
      )}

      {done && (
        <div className='bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-sm text-green-700 dark:text-green-400 font-semibold flex items-center gap-2'>
          <CheckCircle2 size={14} />
          {action === 'APPROVED'
            ? 'Approved — next approver notified.'
            : 'Rejected — submitter notified.'}
        </div>
      )}
    </div>
  )
}
