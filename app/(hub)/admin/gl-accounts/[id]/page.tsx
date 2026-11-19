import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getGLAccountLedger } from "@/lib/gl-transactions";
import { Badge } from "@/components/shared/Badge";
import GLEntityFilterSelect from "@/components/admin/GLEntityFilterSelect";

export const metadata: Metadata = { title: "GL Account History" };

const STATUS_VARIANT: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  APPROVED: "blue",
  POSTED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default async function GLAccountHistoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { entityId?: string };
}) {
  const user = await requireAuth();
  if (!user.isSystem && user.roleName !== "Super Admin") redirect("/dashboard");

  const glAccount = await prisma.gLAccount.findUnique({
    where: { id: params.id },
    include: { entityAccounts: { include: { entity: { select: { id: true, code: true, name: true } } } } },
  });
  if (!glAccount) notFound();

  const entityFilter = searchParams.entityId || undefined;
  const ledger = await getGLAccountLedger(params.id, entityFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{glAccount.code}</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{glAccount.name}</h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">{glAccount.code} · {glAccount.category}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {glAccount.entityAccounts.length === 0 ? (
              <span className="text-xs text-muted-foreground">Not linked to any entity yet</span>
            ) : (
              glAccount.entityAccounts.map((ea) => (
                <span key={ea.id} className="px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-foreground border border-border">
                  {ea.entity.code}
                </span>
              ))
            )}
          </div>
        </div>
        <GLEntityFilterSelect
          glAccountId={params.id}
          entities={glAccount.entityAccounts.map((ea) => ea.entity)}
          currentEntityId={entityFilter}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ["Total Debit", `₦${ledger.totalDebit.toLocaleString()}`, "text-foreground"],
          ["Total Credit", `₦${ledger.totalCredit.toLocaleString()}`, "text-foreground"],
          ["Net Balance", `₦${ledger.netBalance.toLocaleString()}`, ledger.netBalance >= 0 ? "text-foreground" : "text-red-600"],
          ["Transactions", String(ledger.transactionCount), "text-foreground"],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="p-4 rounded-xl bg-card border border-border">
            <div className={`text-lg font-extrabold ${cls}`}>{val}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border font-bold text-foreground">Transaction History</div>
        {ledger.rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No transactions recorded yet for this GL account.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/40">
                  {["Date", "Entity", "Reference", "Description", "Debit", "Credit", "Status", "Balance"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.transactionDate).toLocaleDateString("en-NG")}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{(r as any).entity?.code}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.referenceNo ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground max-w-[240px] truncate">{r.description ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground font-semibold">{r.entryType === "DEBIT" ? `₦${Number(r.amount).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 text-red-600 font-semibold">{r.entryType === "CREDIT" ? `₦${Number(r.amount).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-foreground">{r.balance !== null ? `₦${r.balance.toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
