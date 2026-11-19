import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth, requireGranularPermission, userHasEntityAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/shared/Badge";
import ApprovalActionButtons from "@/components/assets/ApprovalActionButtons";
import { FileText, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "GL Entry" };

const STATUS_VARIANT: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  APPROVED: "blue",
  POSTED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

async function loadApprovalInstance(approvalInstanceId: string | null) {
  if (!approvalInstanceId) return null;
  return prisma.approvalInstance.findUnique({
    where: { id: approvalInstanceId },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" },
        include: {
          actionedBy: { select: { name: true, email: true } },
          assignedUser: { select: { name: true, email: true } },
        },
      },
    },
  });
}

function ApprovalSection({ instance, userId, userRoleId }: { instance: any; userId: string; userRoleId: string | null }) {
  if (!instance) return null;
  const myPendingStep = instance.steps.find(
    (s: any) => s.status === "PENDING" && (s.userId ? s.userId === userId : s.roleId === userRoleId)
  );
  return (
    <>
      {myPendingStep && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold text-foreground mb-4">Your Approval Decision</h2>
          <ApprovalActionButtons instanceId={instance.id} stepNumber={myPendingStep.stepNumber} roleName={myPendingStep.roleName} />
        </div>
      )}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4">Approval History</h2>
        <div className="space-y-3">
          {instance.steps.map((s: any) => (
            <div key={s.id} className="flex items-start justify-between text-sm border-b border-border last:border-0 pb-3 last:pb-0">
              <div>
                <div className="font-semibold text-foreground">Step {s.stepNumber} — {s.userName || s.roleName}</div>
                {s.comment && <div className="text-xs text-muted-foreground italic mt-0.5">"{s.comment}"</div>}
              </div>
              <div className="text-right">
                <Badge variant={s.status === "APPROVED" ? "green" : s.status === "REJECTED" ? "red" : "yellow"}>{s.status}</Badge>
                {s.actionedAt && <div className="text-xs text-muted-foreground mt-1">{fmtDate(s.actionedAt)}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default async function GLEntryDetailPage({ params }: { params: { id: string } }) {
  await requireGranularPermission("finance", "gl_journal", "view");
  const user = await requireAuth();

  const journalEntry = await prisma.gLJournalEntry.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        include: {
          entity: { select: { code: true, name: true } },
          glAccount: { select: { code: true, name: true } },
        },
      },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
    },
  });

  if (journalEntry) {
    for (const line of journalEntry.lines) {
      if (!(await userHasEntityAccess(line.entityId))) notFound();
    }
    const instance = await loadApprovalInstance(journalEntry.approvalInstanceId);
    const debitLines = journalEntry.lines.filter((l) => l.entryType === "DEBIT");
    const creditLines = journalEntry.lines.filter((l) => l.entryType === "CREDIT");

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/finance/gl-entries" className="hover:text-foreground">GL Entries</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Journal Entry</span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">GL Journal Entry</h1>
            <p className="text-muted-foreground text-sm mt-1">{journalEntry.description}</p>
          </div>
          <Badge variant={STATUS_VARIANT[journalEntry.status]}>{journalEntry.status}</Badge>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Debit</div>
              {debitLines.map((l) => (
                <div key={l.id} className="p-3 rounded-xl border border-border bg-accent/20 mb-2">
                  <div className="font-semibold text-sm text-foreground">{l.glAccount.name}</div>
                  <code className="text-xs text-muted-foreground">{l.glAccount.code} · {l.entity.code}</code>
                  <div className="text-lg font-extrabold text-foreground mt-1">₦{Number(l.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Credit</div>
              {creditLines.map((l) => (
                <div key={l.id} className="p-3 rounded-xl border border-border bg-accent/20 mb-2">
                  <div className="font-semibold text-sm text-foreground">{l.glAccount.name}</div>
                  <code className="text-xs text-muted-foreground">{l.glAccount.code} · {l.entity.code}</code>
                  <div className="text-lg font-extrabold text-foreground mt-1">₦{Number(l.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Transaction Date</div>
              <div className="text-sm text-foreground">{new Date(journalEntry.transactionDate).toLocaleDateString("en-NG", { dateStyle: "long" })}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Created By</div>
              <div className="text-sm text-foreground">{journalEntry.createdBy?.name ?? "—"}</div>
            </div>
          </div>
          {journalEntry.referenceNo && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Reference</div>
              <div className="text-sm text-foreground">{journalEntry.referenceNo}</div>
            </div>
          )}
          {journalEntry.status === "POSTED" && (
            <div className="pt-4 border-t border-border text-sm text-green-700 dark:text-green-400 font-semibold">
              Posted {fmtDate(journalEntry.postedAt)} — reflected in both GL account balances.
            </div>
          )}
        </div>

        <ApprovalSection instance={instance} userId={user.id} userRoleId={user.roleId} />
      </div>
    );
  }

  const txn = await prisma.gLTransaction.findUnique({
    where: { id: params.id },
    include: {
      entity: { select: { name: true, code: true } },
      glAccount: { select: { code: true, name: true, category: true } },
      createdBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
    },
  });
  if (!txn || txn.entryType !== "CREDIT") notFound();
  if (!(await userHasEntityAccess(txn.entityId))) notFound();

  const instance = await loadApprovalInstance(txn.approvalInstanceId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/finance/gl-entries" className="hover:text-foreground">GL Entries</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{txn.glAccount.code}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">GL Credit Entry <span className="text-xs font-normal text-muted-foreground">(legacy single-sided)</span></h1>
          <p className="text-muted-foreground text-sm mt-1">{txn.glAccount.name} ({txn.glAccount.code}) — {txn.entity.code}</p>
        </div>
        <Badge variant={STATUS_VARIANT[txn.status]}>{txn.status}</Badge>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Amount</div>
            <div className="text-2xl font-extrabold text-red-600">−₦{Number(txn.amount).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Transaction Date</div>
            <div className="text-sm text-foreground">{new Date(txn.transactionDate).toLocaleDateString("en-NG", { dateStyle: "long" })}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Created By</div>
            <div className="text-sm text-foreground">{txn.createdBy?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Reference</div>
            <div className="text-sm text-foreground">{txn.referenceNo ?? "—"}</div>
          </div>
        </div>
        {txn.description && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Narration</div>
            <div className="text-sm text-foreground">{txn.description}</div>
          </div>
        )}
        {txn.attachmentUrl && (
          <a href={txn.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-[#1B2A8A] hover:underline">
            <FileText size={14} /> View Supporting Document
          </a>
        )}
        {txn.status === "POSTED" && (
          <div className="mt-4 pt-4 border-t border-border text-sm text-green-700 dark:text-green-400 font-semibold">
            Posted {fmtDate(txn.postedAt)} — reflected in the GL Account balance.
          </div>
        )}
      </div>

      <ApprovalSection instance={instance} userId={user.id} userRoleId={user.roleId} />
    </div>
  );
}
