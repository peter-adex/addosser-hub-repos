'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Star,
  CheckCircle2,
  Send,
  Loader2,
  TrendingUp,
  User,
  Calendar
} from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { AnyStatus } from '@/components/shared/StatusBadge'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import {
  getAppraisalGrade,
  APPRAISAL_GRADE_LABELS,
  APPRAISAL_RATING_LABELS,
  type AppraisalScore,
  type AppraisalRating
} from '@/types/fleet'

function fmtDate (d?: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(d))
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  E: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
}

function ScoreBar ({
  value,
  label,
  weight
}: {
  value: number
  label: string
  weight?: string
}) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className='flex items-center gap-3'>
      <div className='w-44 flex-shrink-0'>
        <p className='text-[12px] font-medium text-foreground leading-tight'>
          {label}
        </p>
        {weight && (
          <p className='text-[10.5px] text-muted-foreground'>
            Weight: {weight}
          </p>
        )}
      </div>
      <div className='flex-1 h-2 rounded-full bg-muted overflow-hidden'>
        <div
          className='h-full rounded-full bg-brand-navy dark:bg-brand-gold transition-all'
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className='text-[12px] font-semibold text-foreground w-14 text-right'>
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

export default function AppraisalDetailPage () {
  return (
    <PermissionGuard module='appraisals' action='canView'>
      <AppraisalDetailContent />
    </PermissionGuard>
  )
}

function AppraisalDetailContent () {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const perms = usePagePermissions('appraisals')

  const [appraisal, setAppraisal] = useState<any>(null)
  const [scores, setScores] = useState<AppraisalScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [hrNotes, setHrNotes] = useState('')
  const [actionErr, setActionErr] = useState('')

  useEffect(() => {
    fetch(`/api/fleet/appraisals/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setAppraisal(d.data)
        try {
          setScores(JSON.parse(d.data?.scoresJson ?? '{}'))
        } catch {
          setScores(null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function doAction (action: string, extra?: any) {
    setActing(true)
    setActionErr('')
    const res = await fetch(`/api/fleet/appraisals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ...extra })
    })
    const json = await res.json()
    setActing(false)
    if (!res.ok) {
      setActionErr(json.error ?? 'Action failed')
      return
    }
    setAppraisal(json.data)
  }

  if (loading)
    return (
      <div className='max-w-2xl space-y-4'>
        {[120, 250, 200].map((h, i) => (
          <div
            key={i}
            className='bg-card border border-border rounded-xl animate-pulse'
            style={{ height: h }}
          />
        ))}
      </div>
    )

  if (!appraisal)
    return (
      <div className='text-center py-16'>
        <Star size={40} className='mx-auto text-muted-foreground mb-3' />
        <p className='text-[14px] font-semibold text-foreground mb-1'>
          Appraisal not found
        </p>
        <button
          onClick={() => router.push('/fleet/appraisals')}
          className='text-[12.5px] text-brand-navy dark:text-brand-gold hover:underline'
        >
          ← Back to Appraisals
        </button>
      </div>
    )

  const grade = appraisal.grade ?? 'C'
  const overall = appraisal.overallScore ?? 0

  const canSubmit = appraisal.status === 'draft' && perms.canCreate
  const canReview = appraisal.status === 'submitted' && perms.canApprove

  return (
    <div className='animate-fade-in max-w-2xl'>
      <button
        onClick={() => router.push('/fleet/appraisals')}
        className='inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors'
      >
        <ChevronLeft size={14} /> Back to Appraisals
      </button>

      <div className='bg-card border border-border rounded-xl p-5 mb-4'>
        <div className='flex items-start justify-between gap-3 flex-wrap mb-4'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center flex-shrink-0'>
              <Star
                size={20}
                className='text-brand-navy dark:text-brand-gold'
              />
            </div>
            <div>
              <h1 className='text-[18px] font-bold text-foreground'>
                {appraisal.driverName}
              </h1>
              <p className='text-[12px] text-muted-foreground'>
                Period:{' '}
                <strong className='text-foreground'>{appraisal.period}</strong>
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <StatusBadge status={appraisal.status as AnyStatus} />
            <span
              className={`rounded-full px-3 py-0.5 text-[11.5px] font-bold ${GRADE_COLORS[grade]}`}
            >
              Grade {grade} · {overall.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-x-8 gap-y-2 text-[12.5px]'>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <User size={12} />
            Supervisor:{' '}
            <span className='text-foreground font-medium'>
              {appraisal.supervisorName}
            </span>
          </div>
          {appraisal.hrReviewerName && (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <CheckCircle2 size={12} className='text-emerald-500' />
              HR Reviewer:{' '}
              <span className='text-foreground font-medium'>
                {appraisal.hrReviewerName}
              </span>
            </div>
          )}
          {appraisal.submittedAt && (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Calendar size={12} />
              Submitted:{' '}
              <span className='text-foreground font-medium'>
                {fmtDate(appraisal.submittedAt)}
              </span>
            </div>
          )}
          {appraisal.hrReviewedAt && (
            <div className='flex items-center gap-2 text-muted-foreground'>
              <Calendar size={12} />
              Reviewed:{' '}
              <span className='text-foreground font-medium'>
                {fmtDate(appraisal.hrReviewedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {scores && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <div className='flex items-center gap-2 mb-4'>
            <TrendingUp
              size={15}
              className='text-brand-navy dark:text-brand-gold'
            />
            <p className='text-[13px] font-semibold text-foreground'>
              Score Breakdown
            </p>
          </div>
          <div className='space-y-3'>
            <ScoreBar
              value={scores.section1Contribution}
              label='Section 1 — Personal Attributes'
              weight='20%'
            />
            <ScoreBar
              value={(scores.vehicleMaintScore ?? 0) * 0.4}
              label='Vehicle Maintenance KPA'
              weight='40%'
            />
            <ScoreBar
              value={(scores.safetyScore ?? 0) * 0.1}
              label='Safety Standards KPA'
              weight='10%'
            />
            <ScoreBar
              value={(scores.processScore ?? 0) * 0.3}
              label='Process Controls KPA'
              weight='30%'
            />
            <div className='pt-2 border-t border-border'>
              <ScoreBar value={scores.overallScore} label='Overall Score' />
            </div>
          </div>
          <div className='mt-4 p-4 rounded-lg bg-muted/30 border border-border text-center'>
            <p className='text-[11px] text-muted-foreground mb-1'>
              Final Result
            </p>
            <div className='flex items-center justify-center gap-3'>
              <span
                className={`rounded-full px-4 py-1 text-[15px] font-bold ${GRADE_COLORS[grade]}`}
              >
                Grade {grade}
              </span>
              <span className='text-[14px] text-muted-foreground'>—</span>
              <span className='text-[14px] font-semibold text-foreground'>
                {APPRAISAL_GRADE_LABELS[grade]}
              </span>
            </div>
          </div>
        </div>
      )}

      {scores?.personalAttributes && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <p className='text-[13px] font-semibold text-foreground mb-3'>
            Section 1 — Personal Attributes
          </p>
          <div className='space-y-2'>
            {scores.personalAttributes.map((attr: any) => (
              <div
                key={attr.key}
                className='flex items-center justify-between py-2 border-b border-border/50 last:border-0'
              >
                <div>
                  <p className='text-[12.5px] font-medium text-foreground'>
                    {attr.label}
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    {attr.description}
                  </p>
                </div>
                {attr.rating !== null ? (
                  <span className='inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold bg-brand-navy/10 dark:bg-brand-gold/10 text-brand-navy dark:text-brand-gold flex-shrink-0 ml-3'>
                    {attr.rating} —{' '}
                    {APPRAISAL_RATING_LABELS[attr.rating as AppraisalRating]}
                  </span>
                ) : (
                  <span className='text-[11px] text-muted-foreground flex-shrink-0 ml-3 italic'>
                    Not rated
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {scores?.kpas && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <p className='text-[13px] font-semibold text-foreground mb-3'>
            Section 2 — Performance KPIs
          </p>
          <div className='space-y-4'>
            {scores.kpas.map((kpa: any) => {
              const kpaMax = kpa.kpis.reduce(
                (s: number, k: any) => s + k.maxWeight,
                0
              )
              const kpaAch = kpa.kpis.reduce(
                (s: number, k: any) => s + (k.achievement ?? 0),
                0
              )
              return (
                <div
                  key={kpa.key}
                  className='rounded-lg border border-border overflow-hidden'
                >
                  <div className='bg-muted/30 px-4 py-2.5 flex items-center justify-between'>
                    <p className='text-[12.5px] font-semibold text-foreground'>
                      {kpa.label}
                    </p>
                    <span className='text-[12px] font-bold text-foreground'>
                      {kpaAch}/{kpaMax} pts (
                      {kpaMax > 0 ? ((kpaAch / kpaMax) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className='divide-y divide-border/50'>
                    {kpa.kpis.map((kpi: any) => (
                      <div
                        key={kpi.key}
                        className='flex items-center justify-between px-4 py-2.5'
                      >
                        <p className='text-[12px] text-foreground flex-1 pr-4'>
                          {kpi.description}
                        </p>
                        <span className='text-[12px] font-semibold text-foreground flex-shrink-0'>
                          {kpi.achievement ?? 0}/{kpi.maxWeight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {appraisal.supervisorComments && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <p className='text-[13px] font-semibold text-foreground mb-2'>
            Supervisor Comments
          </p>
          <p className='text-[12.5px] text-muted-foreground leading-relaxed'>
            {appraisal.supervisorComments}
          </p>
        </div>
      )}
      {appraisal.hrNotes && (
        <div className='bg-card border border-border rounded-xl p-5 mb-4'>
          <p className='text-[13px] font-semibold text-foreground mb-2'>
            HR Notes
          </p>
          <p className='text-[12.5px] text-muted-foreground leading-relaxed'>
            {appraisal.hrNotes}
          </p>
        </div>
      )}

      {(canSubmit || canReview) && (
        <div className='bg-card border border-border rounded-xl p-5'>
          <p className='text-[13px] font-semibold text-foreground mb-3'>
            {canSubmit ? 'Submit to HR for Review' : 'HR Review'}
          </p>

          {canSubmit && (
            <>
              <p className='text-[12.5px] text-muted-foreground mb-3'>
                Once submitted, this appraisal will be sent for review. You
                cannot edit it after submission.
              </p>
              <button
                type='button'
                onClick={() => doAction('submit')}
                disabled={acting}
                className='inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-[13px] font-semibold text-brand-gold hover:bg-brand-navy-mid disabled:opacity-60 transition-colors'
              >
                {acting ? (
                  <Loader2 size={14} className='animate-spin' />
                ) : (
                  <Send size={14} />
                )}
                {acting ? 'Submitting…' : 'Submit to HR Advisor'}
              </button>
            </>
          )}

          {canReview && (
            <>
              <div className='flex flex-col gap-1.5 mb-4'>
                <label className='text-[12px] font-medium text-foreground'>
                  HR Review Notes{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                </label>
                <textarea
                  className='w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition'
                  rows={3}
                  placeholder='Add your notes or feedback on this appraisal…'
                  value={hrNotes}
                  onChange={e => setHrNotes(e.target.value)}
                />
              </div>
              <button
                type='button'
                onClick={() =>
                  doAction('review', { hrNotes: hrNotes || undefined })
                }
                disabled={acting}
                className='inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-[13px] font-semibold disabled:opacity-60 transition-colors'
              >
                {acting ? (
                  <Loader2 size={14} className='animate-spin' />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {acting ? 'Marking reviewed…' : 'Mark as Reviewed'}
              </button>
            </>
          )}

          {actionErr && (
            <p className='mt-3 text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2'>
              {actionErr}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
