import { Metadata }                       from "next";
import Link                               from "next/link";
import { notFound }                       from "next/navigation";
import { requireAuth, requireGranularPermission } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { Badge }                          from "@/components/shared/Badge";
import ApprovalActionButtons              from "@/components/assets/ApprovalActionButtons";
import CancelMovementButton               from "@/components/assets/CancelMovementButton";
import { CheckCircle2, XCircle, Clock, FileText, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "Asset Movement Request" };

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

export default async function MovementDetailPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("assets", "movement", "view");
  const user = await requireAuth();

  const movement = await prisma.assetMovement.findUnique({
    where: { id: params.id },
    include: {
      asset: {
        select: {
          id: true, assetNo: true, name: true, description: true, status: true,
          classification: { select: { name: true } },
        },
      },
      fromEntity:  { select: { name: true, code: true } },
      toEntity:    { select: { name: true, code: true } },
      requestedBy: { select: { name: true, email: true } },
    },
  });
  if (!movement || movement.requestStatus === null) notFound();

  const [fromBranch, toBranch, toAssignee] = await Promise.all([
    movement.fromBranchId ? prisma.branch.findUnique({ where: { id: movement.fromBranchId }, select: { name: true } }) : null,
    movement.toBranchId   ? prisma.branch.findUnique({ where: { id: movement.toBranchId },   select: { name: true } }) : null,
    movement.toAssigneeId ? prisma.user.findUnique({ where: { id: movement.toAssigneeId }, select: { name: true, email: true } }) : null,
  ]);

  const attachments: { name: string; url: string; mimeType?: string; size?: number }[] =
    movement.attachments ? JSON.parse(movement.attachments) : [];

  const instance = movement.approvalInstanceId
    ? await prisma.approvalInstance.findUnique({
        where: { id: movement.approvalInstanceId },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            include: {
              actionedBy:   { select: { name: true, email: true } },
              assignedUser: { select: { name: true, email: true } },
            },
          },
          workflow: { select: { name: true } },
        },
      })
    : null;

  const myPendingStep = instance?.steps.find(
    (s) => s.status === "PENDING" && (s.userId ? s.userId === user.id : s.roleId === user.roleId)
  );

  const canCancel =
    (movement.requestedById === user.id || user.isSystem) &&
    ["DRAFT", "PENDING_APPROVAL"].includes(movement.requestStatus ?? "");

  const timeline: { label: string; done: boolean; date?: Date | null; detail?: string }[] = [
    { label: "Request Created", done: true, date: movement.createdAt },
    { label: "Submitted", done: !!movement.submittedAt, date: movement.submittedAt },
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
  if (movement.requestStatus === "COMPLETED") {
    timeline.push({ label: "Asset Master Updated", done: true, date: movement.completedAt });
    timeline.push({ label: "Movement Completed", done: true, date: movement.completedAt });
  } else if (movement.requestStatus === "REJECTED") {
    timeline.push({ label: "Movement Rejected", done: true });
  } else if (movement.requestStatus === "CANCELLED") {
    timeline.push({ label: "Movement Cancelled", done: true });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets/movements" className="hover:text-foreground">Asset Movements</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{movement.assetCodeSnapshot ?? movement.asset.assetNo}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Asset Movement Request</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {movement.assetDescSnapshot ?? movement.asset.name} ({movement.assetCodeSnapshot ?? movement.asset.assetNo})
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[movement.requestStatus ?? "DRAFT"]}>{movement.requestStatus}</Badge>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4">Movement Summary</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">From</div>
            <div className="text-sm font-semibold text-foreground">{movement.fromEntity?.code} — {movement.fromEntity?.name}</div>
            <div className="text-sm text-muted-foreground">{fromBranch?.name}{movement.fromLocation ? ` (${movement.fromLocation})` : ""}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">To</div>
            <div className="text-sm font-semibold text-foreground">{movement.toEntity?.code} — {movement.toEntity?.name}</div>
            <div className="text-sm text-muted-foreground">{toBranch?.name}{movement.toLocation ? ` (${movement.toLocation})` : ""}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Requested By</div>
            <div className="text-sm text-foreground">{movement.requestedBy?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Movement Date</div>
            <div className="text-sm text-foreground">{fmtDate(movement.movementDate)}</div>
          </div>
          {toAssignee && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Assigned To</div>
              <div className="text-sm text-foreground">{toAssignee.name} <span className="text-muted-foreground">({toAssignee.email})</span></div>
            </div>
          )}
        </div>
        {movement.reason && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
            <div className="text-sm text-foreground">{movement.reason}</div>
          </div>
        )}
        {movement.remarks && (
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Remarks</div>
            <div className="text-sm text-foreground">{movement.remarks}</div>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Supporting Documents</div>
            <ul className="space-y-2">
              {attachments.map((a, i) => (
                <li key={i}>
                  <a
                    href={`/api/download?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B2A8A] hover:underline"
                  >
                    <FileText size={14} /> {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!attachments.length && movement.attachmentUrl && (
          <a href={movement.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-[#1B2A8A] hover:underline">
            <FileText size={14} /> View Supporting Document
          </a>
        )}
      </div>

      {instance && myPendingStep && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold text-foreground mb-4">Your Approval Decision</h2>
          <ApprovalActionButtons instanceId={instance.id} stepNumber={myPendingStep.stepNumber} roleName={myPendingStep.roleName} />
        </div>
      )}

      {canCancel && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <CancelMovementButton movementId={movement.id} />
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
              {i < timeline.length - 1 && <ArrowRight size={0} className="hidden" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
