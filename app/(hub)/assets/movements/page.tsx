import { Metadata }                       from "next";
import Link                               from "next/link";
import { Plus, Eye }                      from "lucide-react";
import { requireGranularPermission, requireAuth } from "@/lib/permissions";
import { prisma }                         from "@/lib/prisma";
import { Badge }                          from "@/components/shared/Badge";

export const metadata: Metadata = { title: "Asset Movements" };

const TYPE_VARIANT: Record<string, "blue"|"yellow"|"green"|"gray"> = {
  REALLOCATION:   "blue",
  TEMPORARY_LOAN: "yellow",
  RETURN:         "green",
  ASSIGNMENT:     "gray",
  UNASSIGNMENT:   "gray",
};

const REQUEST_STATUS_VARIANT: Record<string, "blue"|"yellow"|"green"|"gray"|"red"> = {
  DRAFT:             "gray",
  PENDING_APPROVAL:  "yellow",
  APPROVED:          "blue",
  REJECTED:          "red",
  CANCELLED:         "gray",
  COMPLETED:         "green",
};

export default async function MovementsPage() {
  await requireGranularPermission("assets", "movement", "view");
  const user = await requireAuth();

  const [requests, movements] = await Promise.all([
    prisma.assetMovement.findMany({
      where: {
        requestStatus: { not: null },
        ...(user.isSystem ? {} : { OR: [{ fromEntityId: user.entityId }, { toEntityId: user.entityId }] }),
      },
      include: {
        asset:       { select: { assetNo: true, name: true } },
        fromEntity:  { select: { code: true } },
        toEntity:    { select: { code: true } },
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.assetMovement.findMany({
      where: {
        requestStatus: null,
        ...(user.isSystem ? {} : { asset: { entityId: user.entityId } }),
      },
      include: {
        asset: {
          select: {
            assetNo: true, name: true,
            entity: { select: { code: true } },
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { movementDate: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Asset Movements</h1>
          <p className="text-muted-foreground text-sm mt-1">Entity and location movement requests, plus the full movement log</p>
        </div>
        <Link
          href="/assets/movements/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90"
        >
          <Plus size={16} /> New Movement Request
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <span className="font-bold text-foreground">Movement Requests</span>
          <span className="text-xs text-muted-foreground">{requests.length} records</span>
        </div>

        {requests.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-semibold">No movement requests yet</div>
            <Link href="/assets/movements/new" className="text-sm text-[#1B2A8A] font-semibold hover:underline mt-2 inline-block">Create the first request →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Asset","From","To","Requested By","Status","Date",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm text-foreground">{r.assetDescSnapshot ?? r.asset.name}</div>
                      <code className="text-xs text-muted-foreground">{r.assetCodeSnapshot ?? r.asset.assetNo}</code>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{r.fromEntity?.code}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{r.toEntity?.code}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{r.requestedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3.5"><Badge variant={REQUEST_STATUS_VARIANT[r.requestStatus ?? "DRAFT"]}>{r.requestStatus}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{new Date(r.movementDate).toLocaleDateString("en-NG")}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/assets/movements/${r.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B2A8A] hover:underline">
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

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <span className="font-bold text-foreground">Movement History</span>
          <span className="text-xs text-muted-foreground">{movements.length} records</span>
        </div>

        {movements.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-semibold">No asset movements recorded yet</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  {["Asset","Entity","Type","From Branch","To Branch","Reason","Date","Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm text-foreground">{m.asset.name}</div>
                      <code className="text-xs text-muted-foreground">{m.asset.assetNo}</code>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{m.asset.entity.code}</td>
                    <td className="px-4 py-3.5"><Badge variant={TYPE_VARIANT[m.movementType] ?? "gray"}>{m.movementType.replace("_"," ")}</Badge></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{m.fromLocation ?? "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{m.toLocation ?? "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground max-w-xs truncate">{m.reason ?? "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{new Date(m.movementDate).toLocaleDateString("en-NG")}</td>
                    <td className="px-4 py-3.5"><Badge variant="green">{m.status}</Badge></td>
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
