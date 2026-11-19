import { Metadata }                        from "next";
import Link                                from "next/link";
import { requireGranularPermission, requireAuth }  from "@/lib/permissions";
import { prisma }                          from "@/lib/prisma";
import { formatCompact }                   from "@/lib/utils";
import { Badge }                           from "@/components/shared/Badge";
import ApprovalActionButtons               from "@/components/assets/ApprovalActionButtons";

export const metadata: Metadata = { title: "Invoice Approvals" };

export default async function InvoiceApprovalsPage() {
  await requireGranularPermission("invoice", "approvals", "approve");
  const user = await requireAuth();

  const pendingSteps = await prisma.approvalInstanceStep.findMany({
    where: {
      OR: [
        { userId: user.id },
        { userId: null, roleId: user.roleId },
      ],
      status: "PENDING",
      instance: {
        status:   "IN_PROGRESS",
        workflow: { module: "invoice" },
      },
    },
    include: {
      instance: {
        include: {
          workflow:    { select: { name: true, module: true } },
          entity:      { select: { name: true, code: true } },
          steps: {
            include: { actionedBy: { select: { name: true } } },
            orderBy: { stepNumber: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const instanceIds = pendingSteps.map((s) => s.instanceId);
  const instances   = pendingSteps.map((s) => s.instance);

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: instances.map((i) => i.resourceId) } },
    include: {
      vendor:      { select: { name: true } },
      lineItems:   { select: { totalCost: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });

  const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

  const totalPending  = pendingSteps.length;
  const totalValue    = invoices.reduce((s, inv) => s + Number(inv.amountPayable), 0);
  const exceptional   = invoices.filter((inv) => inv.isExceptionalApproval).length;

  const statusVariant: Record<string, "green"|"yellow"|"red"|"blue"|"gray"> = {
    DRAFT:            "gray",
    PENDING_APPROVAL: "yellow",
    IN_APPROVAL:      "blue",
    APPROVED:         "green",
    REJECTED:         "red",
    RECALLED:         "gray",
    PAID:             "green",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Invoice Approvals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Invoices pending your review — {user.roleName}
          </p>
        </div>
        <Link href="/invoice" className="text-sm font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">
          ← All Invoices
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-2xl">⏳</div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{totalPending}</div>
            <div className="text-xs text-muted-foreground">Awaiting Your Approval</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1B2A8A]/10 flex items-center justify-center text-2xl">💰</div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{formatCompact(totalValue)}</div>
            <div className="text-xs text-muted-foreground">Total Value Pending</div>
          </div>
        </div>
        {exceptional > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl">⚠️</div>
            <div>
              <div className="text-2xl font-extrabold text-red-700 dark:text-red-400">{exceptional}</div>
              <div className="text-xs text-red-600 dark:text-red-400">Exceptional (Over Budget)</div>
            </div>
          </div>
        )}
      </div>

      {pendingSteps.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="text-5xl">✅</span>
          <span className="font-bold text-foreground">No invoices pending your approval</span>
          <p className="text-sm">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSteps.map((step) => {
            const instance  = step.instance;
            const invoice   = invoiceMap.get(instance.resourceId);
            if (!invoice) return null;

            return (
              <div key={step.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded">
                          {invoice.invoiceNo}
                        </code>
                        <Badge variant={statusVariant[invoice.status] ?? "gray"}>{invoice.status.replace("_"," ")}</Badge>
                        {invoice.isExceptionalApproval && (
                          <Badge variant="red">⚠️ Over Budget — Exceptional</Badge>
                        )}
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                          Step {step.stepNumber} of {instance.totalSteps}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground">
                        {invoice.vendor?.name ?? invoice.vendorName}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {instance.entity.name} · Submitted by {invoice.submittedBy.name} ({invoice.submittedBy.email})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold" style={{ color: "#FFB800" }}>
                        {formatCompact(Number(invoice.amountPayable))}
                      </div>
                      <div className="text-xs text-muted-foreground">Amount Payable to Vendor</div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 bg-muted/30 grid grid-cols-4 gap-4 text-sm">
                  {[
                    { label: "Subtotal",    value: formatCompact(Number(invoice.subtotal)) },
                    { label: "VAT (7.5%)",  value: formatCompact(Number(invoice.vatAmount)) },
                    { label: "WHT (2%)",    value: `-${formatCompact(Number(invoice.whtAmount))}`, red: true },
                    { label: "GL Account",  value: invoice.glAccountCode },
                  ].map(({ label, value, red }) => (
                    <div key={label}>
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className={`font-semibold ${red ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{value}</div>
                    </div>
                  ))}
                </div>

                {invoice.isExceptionalApproval && invoice.isBudgetExceeded && (
                  <div className="px-6 py-3 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800 space-y-2">
                    {invoice.budgetMonth && invoice.budgetYear && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-red-700 dark:text-red-400">
                        <div>Entity: <strong>{instance.entity.code ?? instance.entity.name}</strong></div>
                        <div>GL Account: <strong>{invoice.glAccountCode}</strong></div>
                        <div>Budget Year: <strong>{invoice.budgetYear}</strong></div>
                        <div>Budget Month: <strong>{new Date(invoice.budgetYear, invoice.budgetMonth - 1).toLocaleString('en-NG', { month: 'long' })}</strong></div>
                        <div>Annual Budget: <strong>{formatCompact(Number(invoice.annualBudgetAmount ?? 0))}</strong></div>
                        <div>Current Month Budget: <strong>{formatCompact(Number(invoice.monthlyBudgetAmount ?? 0))}</strong></div>
                        <div>Already Expensed: <strong>{formatCompact(Number(invoice.monthlyExpensedAmount ?? 0))}</strong></div>
                        <div>Available Balance: <strong>{formatCompact(Number(invoice.monthlyAvailableAmount ?? 0))}</strong></div>
                        <div>Invoice Total + VAT: <strong>{formatCompact(Number(invoice.totalAmount))}</strong></div>
                        <div className="font-bold">Variance: <strong>-{formatCompact(Number(invoice.exceedanceAmount ?? 0))}</strong></div>
                      </div>
                    )}
                    {invoice.exceptionalJustification && (
                      <p className="text-xs text-red-700 dark:text-red-400">
                        <strong>Requester's Justification:</strong> {invoice.exceptionalJustification}
                      </p>
                    )}
                  </div>
                )}

                <div className="px-6 py-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    {instance.steps.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                          s.status === "APPROVED"  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                          : s.status === "PENDING" ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                          : "bg-muted border-border text-muted-foreground"
                        }`}>
                          {s.status === "APPROVED" ? "✓" : s.status === "PENDING" ? "⏳" : "○"}
                          <span>{s.userName || s.roleName}</span>
                          {s.actionedBy && <span className="opacity-70">({s.actionedBy.name})</span>}
                        </div>
                        {s.stepNumber < instance.totalSteps && (
                          <div className="w-6 h-px bg-border" />
                        )}
                      </div>
                    ))}
                  </div>

                  <ApprovalActionButtons
                    instanceId={instance.id}
                    stepNumber={step.stepNumber}
                    roleName={user.roleName}
                  />
                </div>

                <div className="px-6 py-3 border-t border-border bg-muted/20">
                  <Link href={`/invoice/${invoice.id}`}
                    className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                    View Full Invoice Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
