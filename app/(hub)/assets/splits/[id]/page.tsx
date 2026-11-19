import { Metadata }                       from "next";
import Link                               from "next/link";
import { notFound }                       from "next/navigation";
import { requireAuth, requireGranularPermission } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { Badge }                          from "@/components/shared/Badge";
import ApprovalActionButtons              from "@/components/assets/ApprovalActionButtons";
import CancelSplitButton                  from "@/components/assets/CancelSplitButton";
import { CheckCircle2, Clock, FileText } from "lucide-react";

export const metadata: Metadata = { title: "Asset Split Request" };

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "blue" | "gray"> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  APPROVED: "blue",
  REJECTED: "red",
  CANCELLED: "gray",
  COMPLETED: "green",
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}
function fmtNaira(n: number | string | null | undefined) {
  return `₦${Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SplitDetailPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("assets", "split", "view");
  const user = await requireAuth();

  const split = await prisma.assetSplit.findUnique({
    where: { id: params.id },
    include: {
      parentAsset: {
        select: { id: true, assetNo: true, name: true, entity: { select: { name: true, code: true } }, branch: { select: { name: true } } },
      },
      requestedBy: { select: { name: true, email: true } },
      children:    { select: { id: true, assetNo: true, name: true, serialNo: true, barcodeTag: true, assignedTo: { select: { name: true } } } },
    },
  });
  if (!split) notFound();

  const instance = split.approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: split.approvalInstanceId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: {
              actionedBy:   { select: { name: true, email: true } },
              assignedUser: { select: { name: true, email: true } },
            },
          },
        },
      })
    : null;

  const myPendingStep = instance?.steps.find(
    (s) => s.status === "PENDING" && (s.userId ? s.userId === user.id : s.roleId === user.roleId)
  );

  const canCancel =
    (split.requestedById === user.id || user.isSystem) &&
    ["DRAFT", "PENDING_APPROVAL"].includes(split.status);

  const childSpecs = Array.isArray(split.childSpecs) ? (split.childSpecs as any[]) : [];

  const timeline: { label: string; done: boolean; date?: Date | null; detail?: string }[] = [
    { label: "Split Request Created", done: true, date: split.createdAt },
    { label: "Submitted", done: !!split.submittedAt, date: split.submittedAt },
  ];
  if (instance) {
    for (const step of instance.steps) {
      timeline.push({
        label: `${step.userName || step.roleName || "Approver"} — ${step.status}`,
        done: step.status === "APPROVED" || step.status === "REJECTED",
        date: step.actionedAt,
        detail: step.comment ?? undefined,
      });
    }
  }
  if (split.status === "COMPLETED") {
    timeline.push({ label: `${split.children.length} New Asset(s) Created`, done: true, date: split.completedAt });
  } else if (split.status === "REJECTED") {
    timeline.push({ label: "Split Rejected", done: true });
  } else if (split.status === "CANCELLED") {
    timeline.push({ label: "Split Cancelled", done: true });
  }

  const stuckNoWorkflow = split.status === "DRAFT" && !!split.submittedAt;

  return (
    <div className="space-y-6 max-w-4xl">
      {stuckNoWorkflow && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>This split was submitted, but nothing is configured to approve it yet.</strong>
          <p className="mt-1">
            There's no active "Split" approval workflow for the Assets module. Ask an administrator to
            create one under <strong>Admin → Approvals → Workflows</strong> (Module: Asset, Action: Split)
            — once it exists, resubmit this split from the parent asset's page.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/assets/${split.parentAsset.id}`} className="hover:text-foreground">{split.parentAsset.assetNo}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Split Request</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Asset Split Request</h1>
          <p className="text-muted-foreground text-sm mt-1">{split.parentAsset.name} ({split.parentAsset.assetNo})</p>
        </div>
        <Badge variant={STATUS_VARIANT[split.status] ?? "gray"}>{split.status}</Badge>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4">Split Summary</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Quantity Split</div>
            <div className="text-sm font-semibold text-foreground">{split.quantitySplit} of {split.quantityBefore} (remaining: {split.quantityAfter})</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Requested By</div>
            <div className="text-sm text-foreground">{split.requestedBy.name}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Cost Before / After</div>
            <div className="text-sm font-semibold text-foreground">{fmtNaira(Number(split.totalCostBefore))} / {fmtNaira(Number(split.totalCostAfter))} <span className="text-xs text-green-600 dark:text-green-400 font-normal">(unchanged)</span></div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Effective Date</div>
            <div className="text-sm text-foreground">{fmtDate(split.effectiveDate)}</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
          <div className="text-sm text-foreground">{split.reason}</div>
        </div>
        {split.attachmentUrl && (
          <a
            href={`/api/download?url=${encodeURIComponent(split.attachmentUrl)}&name=${encodeURIComponent(split.parentAsset.assetNo + "-split-document")}`}
            className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-[#1B2A8A] hover:underline"
          >
            <FileText size={14} /> Supporting Document
          </a>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4">{split.status === "COMPLETED" ? "New Assets Created" : "New Assets (as requested)"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Asset Code</th>
                <th className="pb-2 pr-4">Serial No.</th>
                <th className="pb-2 pr-4">Tag</th>
                <th className="pb-2">Custodian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {split.status === "COMPLETED"
                ? split.children.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-4 font-medium text-foreground">
                        <Link href={`/assets/${c.id}`} className="text-[#1B2A8A] hover:underline">{c.assetNo}</Link>
                      </td>
                      <td className="py-2 pr-4 text-foreground">{c.serialNo ?? "—"}</td>
                      <td className="py-2 pr-4 text-foreground">{c.barcodeTag ?? "—"}</td>
                      <td className="py-2 text-foreground">{c.assignedTo?.name ?? "—"}</td>
                    </tr>
                  ))
                : childSpecs.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium text-foreground">{split.parentAsset.assetNo}-{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-2 pr-4 text-foreground">{c.serialNo ?? "—"}</td>
                      <td className="py-2 pr-4 text-foreground">{c.barcodeTag ?? "—"}</td>
                      <td className="py-2 text-foreground">—</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {instance && myPendingStep && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold text-foreground mb-4">Your Approval Decision</h2>
          <ApprovalActionButtons instanceId={instance.id} stepNumber={myPendingStep.stepNumber} roleName={myPendingStep.roleName} />
        </div>
      )}

      {canCancel && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <CancelSplitButton splitId={split.id} />
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4">Lifecycle</h2>
        <div className="space-y-4">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5">
                {t.done ? <CheckCircle2 size={18} className="text-green-600" /> : <Clock size={18} className="text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{t.label}</div>
                {t.date && <div className="text-xs text-muted-foreground">{fmtDate(t.date)}</div>}
                {t.detail && <div className="text-xs text-muted-foreground italic mt-0.5">"{t.detail}"</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
