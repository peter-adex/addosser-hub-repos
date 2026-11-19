'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Download,
  Eye,
  Star,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
import {
  PermissionGuard,
  usePagePermissions
} from '@/components/shared/PermissionGuard'
import { useAppraisals } from '@/lib/hooks/useApi'
import { getAppraisalGrade, APPRAISAL_GRADE_LABELS } from '@/types/fleet'
import type { AnyStatus } from '@/components/shared/StatusBadge'

function GradeBadge ({ score }: { score: number }) {
  const grade = getAppraisalGrade(score)
  const colors: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
    B: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
    C: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    E: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
        colors[grade] ?? ''
      }`}
    >
      {grade} · {score.toFixed(1)}%
    </span>
  )
}

function exportToExcel (appraisals: any[]) {
  const headers = [
    'Period',
    'Driver',
    'Supervisor',
    'Status',
    'Overall Score',
    'Grade',
    'Performance Level',
    'HR Reviewer',
    'HR Notes'
  ]
  const rows = appraisals.map(a => [
    a.period,
    a.driverName,
    a.supervisorName,
    a.status,
    a.overallScore.toFixed(1) + '%',
    a.grade,
    APPRAISAL_GRADE_LABELS[a.grade] ?? '',
    a.hrReviewerName ?? '',
    a.hrNotes ?? ''
  ])
  const csv =
    '\uFEFF' +
    [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `appraisals_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AppraisalsPage () {
  return (
    <PermissionGuard module='appraisals' action='canView'>
      <AppraisalsContent />
    </PermissionGuard>
  )
}

function AppraisalsContent () {
  const router = useRouter()
  const perms = usePagePermissions('appraisals')

  const defaultStatus = perms.canApprove ? '' : 'submitted'

  const [statusF, setStatusF] = useState(defaultStatus)

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...(perms.canApprove ? [{ value: 'draft', label: 'Draft' }] : []),
    { value: 'submitted', label: 'Submitted' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'acknowledged', label: 'Acknowledged' }
  ]

  const { data, loading, error } = useAppraisals({ status: statusF })
  const appraisals = data?.items ?? []

  const submitted = appraisals.filter(a => a.status === 'submitted').length
  const reviewed = appraisals.filter(a => a.status === 'reviewed').length
  const avgScore =
    appraisals.length > 0
      ? appraisals.reduce((s, a) => s + a.overallScore, 0) / appraisals.length
      : 0

  return (
    <div className='animate-fade-in'>
      <PageHeader
        title='Driver Appraisals'
        subtitle='Monthly performance evaluations'
        action={
          <div className='flex items-center gap-2'>
            {perms.canExport && appraisals.length > 0 && (
              <button
                onClick={() => exportToExcel(appraisals)}
                className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors'
              >
                <Download size={13} /> Export
              </button>
            )}
            {perms.canCreate && (
              <button
                onClick={() => router.push('/fleet/appraisals/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-medium text-brand-gold hover:bg-brand-navy-mid transition-colors'
              >
                <Plus size={14} /> New Appraisal
              </button>
            )}
          </div>
        }
      />

      {perms.canApprove && !perms.canCreate && (
        <div className='flex items-center gap-3 p-4 rounded-lg bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 mb-5'>
          <Star
            size={18}
            className='text-pink-600 dark:text-pink-400 flex-shrink-0'
          />
          <div>
            <p className='text-[13px] font-semibold text-pink-800 dark:text-pink-300'>
              Reviewer View
            </p>
            <p className='text-[12px] text-pink-700 dark:text-pink-400'>
              Review submitted appraisals, add notes, and export to Excel.
            </p>
          </div>
        </div>
      )}

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5'>
        {[
          {
            label: 'Total',
            value: appraisals.length,
            icon: <FileText size={15} />
          },
          {
            label: 'Pending Review',
            value: submitted,
            icon: <Clock size={15} />,
            alert: submitted > 0
          },
          {
            label: 'Reviewed',
            value: reviewed,
            icon: <CheckCircle2 size={15} />
          },
          {
            label: 'Average Score',
            value: `${avgScore.toFixed(1)}%`,
            icon: <TrendingUp size={15} />
          }
        ].map(s => (
          <div
            key={s.label}
            className={`bg-card border rounded-lg p-4 ${
              (s as any).alert
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-border'
            }`}
          >
            <div className='flex items-center gap-2 mb-1 text-muted-foreground'>
              {s.icon}
              <span className='text-[10.5px] font-medium uppercase tracking-wide'>
                {s.label}
              </span>
            </div>
            <p className='text-[22px] font-bold text-foreground'>{s.value}</p>
          </div>
        ))}
      </div>

      <div className='flex gap-3 mb-5'>
        <div className='w-52'>
          <SearchableSelect
            options={statusOptions}
            value={statusF}
            onChange={setStatusF}
            placeholder='Filter by status'
          />
        </div>
      </div>

      {error && (
        <div className='mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700'>
          {error}
        </div>
      )}

      {loading && (
        <div className='bg-card border border-border rounded-lg'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='h-14 border-b border-border/50 bg-muted/20 animate-pulse'
            />
          ))}
        </div>
      )}

      {!loading && appraisals.length === 0 && (
        <EmptyState
          title='No appraisals found'
          description={
            !perms.canApprove
              ? 'No submitted appraisals to review yet.'
              : 'Create appraisals from the button above.'
          }
          action={
            perms.canCreate ? (
              <button
                onClick={() => router.push('/fleet/appraisals/new')}
                className='inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-brand-gold'
              >
                <Plus size={14} /> New Appraisal
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && appraisals.length > 0 && (
        <div className='bg-card border border-border rounded-lg overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-[12px]'>
              <thead>
                <tr className='border-b border-border bg-muted/30'>
                  {[
                    'Driver',
                    'Period',
                    'Supervisor',
                    'Score',
                    'Grade',
                    'Status',
                    'HR Reviewer',
                    ''
                  ].map(h => (
                    <th
                      key={h}
                      className='text-left px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appraisals.map(a => (
                  <tr
                    key={a.id}
                    className='border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors'
                  >
                    <td className='px-4 py-3 font-semibold text-foreground'>
                      {a.driverName}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {a.period}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {a.supervisorName}
                    </td>
                    <td className='px-4 py-3'>
                      <GradeBadge score={a.overallScore} />
                    </td>
                    <td className='px-4 py-3 text-[14px] font-bold text-foreground'>
                      {a.grade}
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={a.status as AnyStatus} />
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {a.hrReviewerName ?? '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <button
                        onClick={() => router.push(`/fleet/appraisals/${a.id}`)}
                        className='inline-flex items-center gap-1 text-[11px] text-brand-navy dark:text-brand-gold hover:underline'
                      >
                        <Eye size={11} />
                        {perms.canApprove && a.status === 'submitted'
                          ? 'Review'
                          : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='px-4 py-2.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground'>
            {appraisals.length} appraisal{appraisals.length !== 1 ? 's' : ''} ·
            Avg: {avgScore.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  )
}
