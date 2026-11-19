'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck,
  Users,
  MapPin,
  ClipboardList,
  Fuel,
  TrendingUp,
  TrendingDown,
  Bell,
  ChevronRight,
  Building2,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { PermissionGuard } from '@/components/shared/PermissionGuard'

const fmtNgn = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')
const fmtDT = (d: string) =>
  new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date(d))

interface EntityStat {
  id: string
  name: string
  code: string
  annualBudget: number
  totalVehicles: number
  activeVehicles: number
  vehiclesInMaintenance: number
  totalDrivers: number
  activeDrivers: number
  ongoingTrips: number
  pendingApprovals: number
  fuelSpendMonth: number
  fuelSpendYTD: number
  maintenanceCostMonth: number
  maintenanceCostYTD: number
  budgetUsed: number
  budgetPct: number
}

interface Grand {
  totalVehicles: number
  activeVehicles: number
  totalDrivers: number
  ongoingTrips: number
  pendingApprovals: number
  fuelSpendMonth: number
  fuelSpendYTD: number
  maintenanceCostMonth: number
  maintenanceCostYTD: number
}

function ProgressBar ({ pct, danger }: { pct: number; danger?: boolean }) {
  const colour =
    danger && pct > 90
      ? 'bg-red-500'
      : danger && pct > 70
      ? 'bg-amber-500'
      : 'bg-brand-navy dark:bg-brand-gold'
  return (
    <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
      <div
        className={`h-full rounded-full transition-all ${colour}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

function KpiCard ({
  label,
  value,
  sub,
  icon: Icon,
  accent
}: {
  label: string
  value: string
  sub?: string
  icon: any
  accent?: string
}) {
  return (
    <div className='bg-card border border-border rounded-xl p-4'>
      <div className='flex items-start justify-between mb-3'>
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            accent ?? 'bg-brand-navy/[0.08] dark:bg-brand-gold/10'
          }`}
        >
          <Icon
            size={18}
            className={
              accent ? 'text-white' : 'text-brand-navy dark:text-brand-gold'
            }
          />
        </div>
      </div>
      <p className='text-[22px] font-bold text-foreground leading-tight'>
        {value}
      </p>
      <p className='text-[12px] font-medium text-foreground mt-0.5'>{label}</p>
      {sub && <p className='text-[11px] text-muted-foreground mt-0.5'>{sub}</p>}
    </div>
  )
}

function EntityCard ({ e }: { e: EntityStat }) {
  const router = useRouter()
  const budgetWarning = e.annualBudget > 0 && e.budgetPct > 80

  return (
    <div
      className={`bg-card border rounded-xl p-5 transition-shadow hover:shadow-md ${
        budgetWarning
          ? 'border-amber-200 dark:border-amber-800'
          : 'border-border'
      }`}
    >
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-center gap-2.5'>
          <div className='h-9 w-9 rounded-xl bg-brand-navy/[0.08] dark:bg-brand-gold/10 flex items-center justify-center flex-shrink-0'>
            <Building2
              size={17}
              className='text-brand-navy dark:text-brand-gold'
            />
          </div>
          <div>
            <p className='text-[14px] font-bold text-foreground'>{e.name}</p>
            <p className='text-[10.5px] text-muted-foreground font-mono'>
              {e.code}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {e.pendingApprovals > 0 && (
            <span className='inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5'>
              <AlertTriangle size={9} /> {e.pendingApprovals} pending
            </span>
          )}
          {budgetWarning && (
            <span className='inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px] font-bold px-2 py-0.5'>
              <TrendingUp size={9} /> Budget Alert
            </span>
          )}
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3 mb-4'>
        <div className='rounded-lg bg-muted/30 p-3'>
          <div className='flex items-center gap-1.5 mb-1'>
            <Truck size={12} className='text-muted-foreground' />
            <p className='text-[10.5px] text-muted-foreground font-medium'>
              Vehicles
            </p>
          </div>
          <p className='text-[18px] font-bold text-foreground'>
            {e.totalVehicles}
          </p>
          <p className='text-[10.5px] text-muted-foreground'>
            {e.activeVehicles} active · {e.vehiclesInMaintenance} in maintenance
          </p>
        </div>
        <div className='rounded-lg bg-muted/30 p-3'>
          <div className='flex items-center gap-1.5 mb-1'>
            <Users size={12} className='text-muted-foreground' />
            <p className='text-[10.5px] text-muted-foreground font-medium'>
              Drivers
            </p>
          </div>
          <p className='text-[18px] font-bold text-foreground'>
            {e.totalDrivers}
          </p>
          <p className='text-[10.5px] text-muted-foreground'>
            {e.activeDrivers} active · {e.ongoingTrips} on trip
          </p>
        </div>
      </div>

      <div className='space-y-3'>
        <div>
          <div className='flex items-center justify-between mb-1'>
            <div className='flex items-center gap-1.5'>
              <Fuel size={11} className='text-amber-500' />
              <p className='text-[11.5px] font-semibold text-foreground'>
                Fuel Spend
              </p>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-2 text-[11px]'>
            <div>
              <p className='text-muted-foreground'>This Month</p>
              <p className='font-bold text-foreground'>
                {fmtNgn(e.fuelSpendMonth)}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground'>Year to Date</p>
              <p className='font-bold text-foreground'>
                {fmtNgn(e.fuelSpendYTD)}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className='flex items-center gap-1.5 mb-1'>
            <ClipboardList size={11} className='text-blue-500' />
            <p className='text-[11.5px] font-semibold text-foreground'>
              Maintenance Cost (incl. VAT)
            </p>
          </div>
          <div className='grid grid-cols-2 gap-2 text-[11px]'>
            <div>
              <p className='text-muted-foreground'>This Month</p>
              <p className='font-bold text-foreground'>
                {fmtNgn(e.maintenanceCostMonth)}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground'>Year to Date</p>
              <p className='font-bold text-foreground'>
                {fmtNgn(e.maintenanceCostYTD)}
              </p>
            </div>
          </div>
        </div>

        {e.annualBudget > 0 && (
          <div>
            <div className='flex items-center justify-between mb-1'>
              <div className='flex items-center gap-1.5'>
                <BarChart3 size={11} className='text-purple-500' />
                <p className='text-[11.5px] font-semibold text-foreground'>
                  Annual Budget Utilisation
                </p>
              </div>
              <span
                className={`text-[11px] font-bold ${
                  e.budgetPct > 90
                    ? 'text-red-600'
                    : e.budgetPct > 70
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {e.budgetPct.toFixed(1)}%
              </span>
            </div>
            <ProgressBar pct={e.budgetPct} danger />
            <div className='flex justify-between text-[10px] text-muted-foreground mt-1'>
              <span>Used: {fmtNgn(e.budgetUsed)}</span>
              <span>Budget: {fmtNgn(e.annualBudget)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardContent () {
  const { user } = useAuth()
  const router = useRouter()

  const [entityData, setEntityData] = useState<{
    entities: EntityStat[]
    grand: Grand
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentTrips, setRecentTrips] = useState<any[]>([])
  const [pendingWOs, setPendingWOs] = useState<any[]>([])

  const today = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  useEffect(() => {
    fetch('/api/fleet/dashboard/entity', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setEntityData(d.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/fleet/trips?limit=5', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setRecentTrips(d.data?.items ?? []))
      .catch(() => {})

    fetch('/api/work-orders?status=pending_approval&limit=4', {
      credentials: 'include'
    })
      .then(r => r.json())
      .then(d => setPendingWOs(d.data?.items ?? []))
      .catch(() => {})
  }, [])

  const g = entityData?.grand
  const entities = entityData?.entities ?? []

  return (
    <div className='animate-fade-in'>
      <div className='mb-6'>
        <h1 className='text-[22px] font-bold text-foreground'>
          Good{' '}
          {new Date().getHours() < 12
            ? 'morning'
            : new Date().getHours() < 17
            ? 'afternoon'
            : 'evening'}
          , {user?.name?.split(' ')[0]}
        </h1>
        <p className='text-[12.5px] text-muted-foreground mt-0.5'>
          {today} · Addosser Fleet Manager
        </p>
      </div>

      {loading ? (
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8'>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className='bg-card border border-border rounded-xl h-28 animate-pulse'
            />
          ))}
        </div>
      ) : g ? (
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8'>
          <KpiCard
            label='Total Vehicles'
            value={String(g.totalVehicles)}
            sub={`${g.activeVehicles} active`}
            icon={Truck}
          />
          <KpiCard
            label='Total Drivers'
            value={String(g.totalDrivers)}
            sub={`${g.ongoingTrips} on trip now`}
            icon={Users}
          />
          <KpiCard
            label='Pending Approvals'
            value={String(g.pendingApprovals)}
            sub='Work orders awaiting'
            icon={ClipboardList}
          />
          <KpiCard
            label='Fuel Spend — Month'
            value={fmtNgn(g.fuelSpendMonth)}
            sub={`YTD: ${fmtNgn(g.fuelSpendYTD)}`}
            icon={Fuel}
          />
        </div>
      ) : null}

      {g && (g.maintenanceCostMonth > 0 || g.maintenanceCostYTD > 0) && (
        <div className='bg-brand-navy dark:bg-brand-navy/80 text-brand-gold rounded-xl p-4 flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <ClipboardList size={20} />
            <div>
              <p className='text-[13px] font-bold'>
                Fleet Maintenance Cost (incl. VAT)
              </p>
              <p className='text-[11.5px] opacity-70'>
                Approved + In Progress + Completed work orders
              </p>
            </div>
          </div>
          <div className='text-right'>
            <p className='text-[11px] opacity-70'>This Month</p>
            <p className='text-[20px] font-bold'>
              {fmtNgn(g.maintenanceCostMonth)}
            </p>
            <p className='text-[11px] opacity-70'>
              YTD: {fmtNgn(g.maintenanceCostYTD)}
            </p>
          </div>
        </div>
      )}

      <div className='mb-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Building2
              size={16}
              className='text-brand-navy dark:text-brand-gold'
            />
            <h2 className='text-[15px] font-bold text-foreground'>
              Entity Performance Dashboard
            </h2>
          </div>
          <p className='text-[11.5px] text-muted-foreground'>
            {entities.length} enti{entities.length !== 1 ? 'ties' : 'ty'}
          </p>
        </div>
        {loading ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className='bg-card border border-border rounded-xl h-64 animate-pulse'
              />
            ))}
          </div>
        ) : entities.length === 0 ? (
          <div className='bg-card border border-border rounded-xl p-12 text-center'>
            <Building2
              size={36}
              className='mx-auto text-muted-foreground mb-3'
            />
            <p className='text-[13px] font-semibold text-foreground mb-1'>
              No entities found
            </p>
            <p className='text-[12px] text-muted-foreground'>
              Create entities in the Entities module to see their dashboards.
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
            {entities.map(e => (
              <EntityCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-3.5 border-b border-border'>
            <div className='flex items-center gap-2'>
              <MapPin
                size={14}
                className='text-brand-navy dark:text-brand-gold'
              />
              <p className='text-[13px] font-semibold text-foreground'>
                Recent Trips
              </p>
            </div>
            <button
              onClick={() => router.push('/fleet/trips')}
              className='inline-flex items-center gap-1 text-[11.5px] text-brand-navy dark:text-brand-gold hover:underline'
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {recentTrips.length === 0 ? (
            <div className='px-5 py-8 text-center text-[12.5px] text-muted-foreground'>
              No recent trips
            </div>
          ) : (
            <div className='divide-y divide-border/50'>
              {recentTrips.map(t => (
                <div
                  key={t.id}
                  className='flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <p className='text-[12px] font-mono font-semibold text-foreground'>
                        {t.vehicle?.plateNumber}
                      </p>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className='text-[11px] text-muted-foreground truncate mt-0.5'>
                      {t.startLocation} → {t.endLocation}
                    </p>
                    <p className='text-[10.5px] text-muted-foreground'>
                      {fmtDT(t.startTime)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='bg-card border border-border rounded-xl overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-3.5 border-b border-border'>
            <div className='flex items-center gap-2'>
              <ClipboardList
                size={14}
                className='text-brand-navy dark:text-brand-gold'
              />
              <p className='text-[13px] font-semibold text-foreground'>
                Pending Approvals
              </p>
              {pendingWOs.length > 0 && (
                <span className='rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5'>
                  {pendingWOs.length}
                </span>
              )}
            </div>
            <button
              onClick={() =>
                router.push('/work-orders?status=pending_approval')
              }
              className='inline-flex items-center gap-1 text-[11.5px] text-brand-navy dark:text-brand-gold hover:underline'
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {pendingWOs.length === 0 ? (
            <div className='px-5 py-8 text-center'>
              <CheckCircle
                size={28}
                className='mx-auto text-emerald-500 mb-2'
              />
              <p className='text-[12.5px] text-muted-foreground'>
                No pending approvals
              </p>
            </div>
          ) : (
            <div className='divide-y divide-border/50'>
              {pendingWOs.map(wo => (
                <button
                  key={wo.id}
                  onClick={() => router.push(`/work-orders/${wo.id}`)}
                  className='w-full flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors text-left'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <p className='text-[12px] font-mono font-semibold text-foreground'>
                        {wo.workOrderNumber}
                      </p>
                    </div>
                    <p className='text-[11px] text-muted-foreground'>
                      {wo.vehicle?.plateNumber} · {wo.vendor?.name}
                    </p>
                    <p className='text-[10.5px] text-muted-foreground'>
                      ₦
                      {Math.round(
                        wo.amountPayableNgn ?? wo.totalCostNgn
                      ).toLocaleString('en-NG')}
                    </p>
                  </div>
                  <ChevronRight
                    size={13}
                    className='text-muted-foreground flex-shrink-0'
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage () {
  return (
    <PermissionGuard module='dashboard' action='canView'>
      <DashboardContent />
    </PermissionGuard>
  )
}
