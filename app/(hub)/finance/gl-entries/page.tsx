import { Metadata } from "next";
import Link from "next/link";
import { Plus, Eye } from "lucide-react";
import { requireGranularPermission, requireAuth } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/shared/Badge";

export const metadata: Metadata = { title: "GL Credit Entries" };

const STATUS_VARIANT: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  DRAFT: "gray",
  PENDING_APPROVAL: "yellow",
  APPROVED: "blue",
  POSTED: "green",
  REJECTED: "red",
  CANCELLED: "gray",
};

export default async function GLCreditEntriesPage() {
  await requireGranularPermission("finance", "gl_journal", "view");
  const user = await requireAuth();

  const accessRows = user.isSystem ? [] : await prisma.userEntity.findMany({ where: { userId: user.id }, select: { entityId: true } });
  const accessibleEntityIds = user.isSystem ? undefined : [user.entityId, ...accessRows.map((r) => r.entityId)].filter(Boolean);

  const entries = await prisma.gLTransaction.findMany({
    where: {
      entryType: "CREDIT",
      ...(accessibleEntityIds ? { entityId: { in: accessibleEntityIds } } : {}),
    },
    include: {
      entity: { select: { code: true } },
      glAccount: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">GL Credit Entries</h1>
          <p className="text-muted-foreground text-sm mt-1">Manual credits against GL accounts — e.g. third-party recoveries reducing prior expenses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/gl-history" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent">
            📊 GL Account History
          </Link>
          <Link href="/finance/gl-entries/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90">
            <Plus size={16} /> New Credit Entry
          </Link>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {entries.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="text-4xl mb-3">💰</div>
            <div className="font-semibold">No credit entries yet</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Entity", "GL Account", "Amount", "Date", "Created By", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3.5 text-sm text-foreground font-semibold">{e.entity.code}</td>
                    <td className="px-4 py-3.5">
                      <div className="text-sm font-semibold text-foreground">{e.glAccount.name}</div>
                      <code className="text-xs text-muted-foreground">{e.glAccount.code}</code>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-foreground font-semibold">₦{Number(e.amount).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{new Date(e.transactionDate).toLocaleDateString("en-NG")}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{e.createdBy?.name ?? "—"}</td>
                    <td className="px-4 py-3.5"><Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge></td>
                    <td className="px-4 py-3.5">
                      <Link href={`/finance/gl-entries/${e.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B2A8A] hover:underline">
                        <Eye size={14} /> View
                      </Link>
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
}
