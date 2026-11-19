<<<<<<< HEAD
import { Metadata } from 'next'
import Link from 'next/link'
import { requireGranularPermission, requireAuth, hasGranularPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { formatCompact } from '@/lib/utils'
import { Badge } from '@/components/shared/Badge'
import { StatCard } from '@/components/shared/StatCard'
import InvoiceListClient from '@/components/invoice/InvoiceListClient'

export const metadata: Metadata = { title: 'Invoice Processing' }

export const dynamic = 'force-dynamic'

export default async function InvoicePage ({
  searchParams
}: {
  searchParams: { status?: string; q?: string }
}) {
  await requireGranularPermission('invoice', 'invoices', 'view')

  const user = await requireAuth()

  const allowedEntities = user.allowedEntityIds?.length
    ? user.allowedEntityIds
    : [user.entityId]

  const isSuperUser = user.isSystem === true || user.roleName === 'Super Admin'

  const hasApproveAccess = await hasGranularPermission('invoice', 'approvals', 'approve')

  const shouldHideCreateButton = hasApproveAccess && !isSuperUser

  const statusFilter = searchParams.status
  const q = searchParams.q?.trim()

  const activeApprovalSteps = await prisma.approvalInstance.findMany({
    where: {
      resourceType: 'Invoice',
      status: 'IN_PROGRESS',
      steps: {
        some: {
          userId: user.id,
          status: 'PENDING'
        }
      }
    },
    select: { resourceId: true }
  })

  const actionableInvoiceIds = activeApprovalSteps.map(step => step.resourceId)

  const myPendingApprovalCount = actionableInvoiceIds.length

  const where: any = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q, mode: 'insensitive' } },
            { vendorName: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        }
      : {}),

    ...(user.isSystem
      ? {}
      : {
          AND: [
            {
              entityId: {
                in: allowedEntities
              }
            },

            {
              OR: [
                {
                  status: {
                    notIn: ['DRAFT', 'RECALLED']
                  }
                },
                { submittedById: user.id }
              ]
            }
          ]
        })
  }

  const [invoices, kpis] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        entity: { select: { name: true, code: true } },
        vendor: { select: { name: true } },
        submittedBy: { select: { name: true, email: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        glAccount: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),

    prisma.invoice.groupBy({
      by: ['status'],
      where: user.isSystem
        ? {}
        : {
            entityId: {
              in: allowedEntities
            }
          },
      _count: true,
      _sum: {
        amountPayable: true
      }
    })
  ])

  const pending = kpis.find(k => k.status === 'PENDING')?._count ?? 0
  const approved = kpis.find(k => k.status === 'APPROVED')?._count ?? 0
  const paid = kpis.find(k => k.status === 'PAID')?._count ?? 0
  const totalPayable = kpis.reduce(
    (s, k) => s + Number(k._sum.amountPayable ?? 0),
    0
  )

  const pendingInvoiceIds = invoices
    .filter(inv => inv.status === 'PENDING')
    .map(inv => inv.id)

  const approvalInstanceMap: Record<string, boolean> = {}
  if (pendingInvoiceIds.length > 0) {
    const instances = await prisma.approvalInstance.findMany({
      where: { resourceId: { in: pendingInvoiceIds } },
      include: { steps: { select: { status: true } } }
    })
    for (const inst of instances) {

      const noActioned = inst.steps.every(s =>
        ['PENDING', 'WAITING'].includes(s.status)
      )

      approvalInstanceMap[inst.resourceId] = noActioned
    }
  }

  const enrichedInvoices = invoices.map(inv => ({
    ...inv,
    noStepActioned: approvalInstanceMap[inv.id] ?? true
  }))

  const canApproveInvoice = await import('@/lib/permissions')
    .then(m => m.hasGranularPermission('invoice', 'approvals', 'approve'))
    .catch(() => false)

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between flex-wrap gap-4'>
        <div>
          <h1 className='text-2xl font-extrabold text-foreground'>
            Invoice Processing
          </h1>
          <p className='text-muted-foreground text-sm mt-1'>
            Full lifecycle — creation, approval, payment and reporting
          </p>
        </div>
        {!shouldHideCreateButton && (
          <Link
            href='/invoice/new'
            className='px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90'
            style={{ background: '#FFB800', color: '#1B2A8A' }}
          >
            ＋ New Invoice
          </Link>
        )}
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <StatCard
          label='Pending Approval'
          value={pending}
          icon='⏳'
          color='#d97706'
        />

        <StatCard
          label='Awaiting My Action'
          value={myPendingApprovalCount}
          icon='📥'
          color='#dc2626'
        />
        <StatCard label='Approved' value={approved} icon='✅' color='#16a34a' />
        <StatCard label='Paid' value={paid} icon='💳' color='#1B2A8A' />
        <StatCard
          label='Total Payable'
          value={formatCompact(totalPayable)}
          icon='💰'
          color='#7c3aed'
        />
      </div>

      <InvoiceListClient
        initialInvoices={enrichedInvoices as any}
        currentUserId={user.id}
        canApprove={canApproveInvoice}
      />
    </div>
  )
=======
import { Metadata } from "next";
import Link from "next/link";
import { requirePermission, requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatCompact } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { StatCard } from "@/components/shared/StatCard";

export const metadata: Metadata = { title: "Invoice Processing" };

export default async function InvoicePage() {
  await requirePermission("invoice", "canView");
  const user = await requireAuth();

  const invoices = await prisma.invoice.findMany({
    where: user.isSystem ? {} : { entityId: user.entityId },
    include: {
      entity: { select: { name: true, code: true } },
      submittedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const pending = invoices.filter((i) => i.status === "PENDING").length;
  const approved = invoices.filter((i) => i.status === "APPROVED").length;
  const totalPending = invoices.filter((i) => i.status === "PENDING").reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.totalAmount), 0);

  const statusVariant: Record<string, "yellow" | "blue" | "green" | "red" | "gray"> = {
    PENDING: "yellow", UNDER_REVIEW: "blue", APPROVED: "green", PAID: "green", REJECTED: "red", OVERDUE: "red",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Invoice Processing</h1>
          <p className="text-muted-foreground text-sm mt-1">Submit, review and approve vendor invoices</p>
        </div>
        <Link href="/invoice/new" className="px-5 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#FFB800", color: "#1B2A8A" }}>
          ＋ Submit Invoice
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Approval" value={pending} sub={formatCompact(totalPending) + " value"} icon="⏳" color="#d97706" theme={undefined as any} />
        <StatCard label="Approved" value={approved} icon="✅" color="#16a34a" theme={undefined as any} />
        <StatCard label="Total Paid (YTD)" value={formatCompact(totalPaid)} icon="💳" color="#1B2A8A" theme={undefined as any} />
        <StatCard label="Total Invoices" value={invoices.length} icon="🧾" color="#7c3aed" theme={undefined as any} />
      </div>

      {/* Invoice Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Recent Invoices</h2>
          <span className="text-xs text-muted-foreground">{invoices.length} records</span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <span className="text-5xl">🧾</span>
            <span className="font-semibold">No invoices submitted yet</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Invoice No.", "Vendor", "Entity", "Amount", "GL Account", "Due Date", "Status", "Submitted By", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded">{inv.invoiceNo}</code>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm text-foreground">{inv.vendorName}</div>
                      {inv.vendorEmail && <div className="text-xs text-muted-foreground">{inv.vendorEmail}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{inv.entity.code}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm text-foreground">{formatCompact(Number(inv.totalAmount))}</div>
                      {inv.tax && Number(inv.tax) > 0 && (
                        <div className="text-xs text-muted-foreground">Incl. VAT {formatCompact(Number(inv.tax))}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{inv.glAccountCode ?? "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-NG") : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusVariant[inv.status] ?? "gray"}>{inv.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{inv.submittedBy.name}</td>
                    <td className="px-4 py-3.5">
                      <button className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">View ›</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}
