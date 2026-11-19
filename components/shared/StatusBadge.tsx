import { cn } from '@/lib/utils'
import type {
  VehicleStatus,
  TripStatus,
  WorkOrderStatus,
  ReminderStatus
} from '@/types/fleet'

export type AnyStatus =
  | VehicleStatus
  | TripStatus
  | WorkOrderStatus
  | ReminderStatus
  | 'active'
  | 'inactive'
  | 'submitted'
  | 'reviewed'
  | 'acknowledged'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  },
  idle: {
    label: 'Idle',
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
  },
  maintenance: {
    label: 'In Maintenance',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  },
  retired: {
    label: 'Retired',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  },
  ongoing: {
    label: 'Ongoing',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  },
  completed: {
    label: 'Completed',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
  },
  draft: {
    label: 'Draft',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  },
  pending_approval: {
    label: 'Pending Approval',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  },
  approved: {
    label: 'Approved',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
  },
  in_progress: {
    label: 'In Progress',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  },
  pending: {
    label: 'Pending',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  },
  acknowledged: {
    label: 'Acknowledged',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  },
  overdue: {
    label: 'Overdue',
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
  },
  inactive: {
    label: 'Inactive',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
  },
  submitted: {
    label: 'Submitted',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  },
  reviewed: {
    label: 'Reviewed',
    className:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  }
}

interface StatusBadgeProps {
  status: AnyStatus | string
  className?: string
}

export function StatusBadge ({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium',
        cfg.className,
        className
      )}
    >
      {cfg.label}
    </span>
  )
}
