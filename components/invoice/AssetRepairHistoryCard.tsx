"use client";

import { useState, useEffect } from "react";
import { Wrench, Calendar, DollarSign, X } from "lucide-react";

interface MaintenanceLog {
  id:          string;
  type:        string;
  description: string | null;
  cost:        number | string | null;
  vendor:      string | null;
  performedAt: string;
}

interface AssetSummary {
  id:              string;
  assetNo:         string;
  name:            string;
  purchaseDate:    string | null;
  currentBookValue:number | string | null;
  classification:  { name: string } | null;
  branch:          { name: string } | null;
}

interface Props {
  asset:   AssetSummary | null;
  onClear: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  PREVENTIVE: "🔧", CORRECTIVE: "🛠️", INSPECTION: "🔍",
  CALIBRATION: "⚖️", UPGRADE: "⬆️",
};

function fmtNGN(n: number | string | null): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(Number(n));
}

export default function AssetRepairHistoryCard({ asset, onClear }: Props) {
  const [logs,    setLogs]    = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!asset?.id) { setLogs([]); return; }

    setLoading(true);
    fetch(`/api/assets/${asset.id}/maintenance`)
      .then((r) => r.json())
      .then((d) => setLogs(d.success ? d.data : []))
      .catch(()  => setLogs([]))
      .finally(() => setLoading(false));
  }, [asset?.id]);

  if (!asset) return null;

  const totalCost = logs.reduce((s, l) => s + Number(l.cost ?? 0), 0);
  const ageDays   = asset.purchaseDate
    ? Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / 86_400_000)
    : null;

  return (
    <div className="bg-card border border-[#d97706]/40 rounded-2xl overflow-hidden shadow-sm">
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ background: "#fef9c3", borderBottom: "1px solid #d97706/30" }}
      >
        <div className="flex items-center gap-2">
          <Wrench size={14} style={{ color: "#d97706" }} />
          <span className="font-bold text-sm" style={{ color: "#92400e" }}>
            Asset Repair History
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded-lg hover:bg-yellow-100 transition-colors"
          title="Remove asset link"
        >
          <X size={13} style={{ color: "#92400e" }} />
        </button>
      </div>

      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-extrabold flex-shrink-0"
            style={{ background: "#fef9c3", color: "#92400e" }}
          >
            {asset.classification?.name?.slice(0, 2).toUpperCase() ?? "AS"}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground text-sm truncate">{asset.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] mr-1">{asset.assetNo}</code>
              {asset.classification?.name ?? "—"}
              {asset.branch && <span className="ml-1.5">· {asset.branch.name}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-background rounded-xl p-2.5 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Book Value</div>
            <div className="text-xs font-bold text-foreground mt-0.5">{fmtNGN(asset.currentBookValue)}</div>
          </div>
          <div className="bg-background rounded-xl p-2.5 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Age</div>
            <div className="text-xs font-bold text-foreground mt-0.5">
              {ageDays !== null ? `${Math.floor(ageDays / 365)}y ${Math.floor((ageDays % 365) / 30)}m` : "—"}
            </div>
          </div>
          <div className="bg-background rounded-xl p-2.5 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Maint. Cost</div>
            <div className="text-xs font-bold text-foreground mt-0.5 truncate">{fmtNGN(totalCost)}</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
          Maintenance History ({logs.length})
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No maintenance records yet for this asset.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
                <span className="text-base flex-shrink-0">{TYPE_ICONS[log.type] ?? "📝"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{log.type}</span>
                    <span className="text-xs font-bold text-foreground flex-shrink-0">
                      {fmtNGN(log.cost)}
                    </span>
                  </div>
                  {log.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{log.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <Calendar size={9} />
                    {new Date(log.performedAt).toLocaleDateString("en-NG")}
                    {log.vendor && <span>· {log.vendor}</span>}
                  </div>
                </div>
              </div>
            ))}
            {logs.length > 8 && (
              <div className="text-[10px] text-muted-foreground text-center pt-1">
                +{logs.length - 8} more records
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
