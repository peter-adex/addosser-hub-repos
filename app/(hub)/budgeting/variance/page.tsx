"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { MONTHS } from "@/lib/utils";

interface EntityOpt { id: string; name: string; code: string; isActive: boolean; }
interface MonthRow { month: number; budget: number; actual: number; cumBudget: number; cumActual: number; variance: number; variancePct?: number; }
interface GLRow {
  budgetId: string; glCode: string; glName: string; category: string;
  annualBudget: number; ytdBudget: number; ytdActual: number; ytdVariance: number; ytdVariancePct: number;
  status: "FAVORABLE" | "UNFAVORABLE"; monthly: MonthRow[];
}
interface VarianceData {
  financialYear: number; budgetType: string; asOfMonth: number;
  rows: GLRow[];
  totals: { annualBudget: number; ytdBudget: number; ytdActual: number; ytdVariance: number; ytdVariancePct: number; monthly: MonthRow[] };
}

const fmt = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const inputCls = "px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";

export default function BudgetVarianceReportPage() {
  const [entities, setEntities] = useState<EntityOpt[]>([]);
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [budgetType, setBudgetType] = useState<"OPEX" | "CAPEX">("OPEX");
  const [data, setData] = useState<VarianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then((d) => {
      const list: EntityOpt[] = d.data ?? [];
      setEntities(list);
      if (list.length) setEntityId((prev) => prev || list.find((e) => e.isActive)?.id || list[0].id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/budgets/variance?entityId=${entityId}&financialYear=${year}&budgetType=${budgetType}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load variance report");
      setData(d.data);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally { setLoading(false); }
  }, [entityId, year, budgetType]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/budgeting" className="hover:text-foreground">Budgeting</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Budget vs Actual Variance</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Budget vs Actual Variance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cumulative (year-to-date) monthly budget vs committed/actual spend, per GL account.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-card border border-border rounded-2xl p-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Entity</label>
          <select className={inputCls} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Financial Year</label>
          <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Budget Type</label>
          <select className={inputCls} value={budgetType} onChange={(e) => setBudgetType(e.target.value as any)}>
            <option value="OPEX">OPEX</option>
            <option value="CAPEX">CAPEX</option>
          </select>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading variance report…</div>
      ) : data && data.rows.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ["YTD Budget", fmt(data.totals.ytdBudget)],
              ["YTD Actual (Committed)", fmt(data.totals.ytdActual)],
              ["YTD Variance", fmt(data.totals.ytdVariance)],
              ["Variance %", `${data.totals.ytdVariancePct}%`],
            ].map(([label, val]) => (
              <div key={label} className="p-4 rounded-xl bg-card border border-border">
                <div className={`text-lg font-extrabold ${data.totals.ytdVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{val}</div>
                <div className="text-xs text-muted-foreground">{label} (through {MONTHS[data.asOfMonth - 1]})</div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    {["", "GL Account", "Annual Budget", "YTD Budget", "YTD Actual", "YTD Variance", "Var %", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <Fragment key={r.budgetId}>
                      <tr className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => toggle(r.budgetId)}>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expanded.has(r.budgetId) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{r.glName}</div>
                          <code className="text-xs text-muted-foreground">{r.glCode}</code>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmt(r.annualBudget)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmt(r.ytdBudget)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmt(r.ytdActual)}</td>
                        <td className={`px-4 py-3 font-semibold ${r.ytdVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {r.ytdVariance >= 0 ? <TrendingUp size={14} className="inline mr-1" /> : <TrendingDown size={14} className="inline mr-1" />}
                          {fmt(r.ytdVariance)}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${r.ytdVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{r.ytdVariancePct}%</td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === "FAVORABLE" ? "green" : "red"}>{r.status === "FAVORABLE" ? "Favorable" : "Unfavorable"}</Badge>
                        </td>
                      </tr>
                      {expanded.has(r.budgetId) && (
                        <tr className="border-t border-border bg-muted/20">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr>
                                    <th className="text-left px-2 py-1 text-muted-foreground font-bold uppercase">Month</th>
                                    {r.monthly.map((m) => <th key={m.month} className="text-right px-2 py-1 text-muted-foreground font-bold">{MONTHS[m.month - 1].slice(0, 3)}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">Budget</td>
                                    {r.monthly.map((m) => <td key={m.month} className="text-right px-2 py-1">{m.budget ? fmt(m.budget) : "—"}</td>)}
                                  </tr>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">Actual</td>
                                    {r.monthly.map((m) => <td key={m.month} className="text-right px-2 py-1">{m.actual ? fmt(m.actual) : "—"}</td>)}
                                  </tr>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground font-semibold">Cum. Variance</td>
                                    {r.monthly.map((m) => (
                                      <td key={m.month} className={`text-right px-2 py-1 font-semibold ${m.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {fmt(m.variance)}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-foreground">All GL Accounts</td>
                    <td className="px-4 py-3 text-foreground">{fmt(data.totals.annualBudget)}</td>
                    <td className="px-4 py-3 text-foreground">{fmt(data.totals.ytdBudget)}</td>
                    <td className="px-4 py-3 text-foreground">{fmt(data.totals.ytdActual)}</td>
                    <td className={`px-4 py-3 ${data.totals.ytdVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(data.totals.ytdVariance)}</td>
                    <td className={`px-4 py-3 ${data.totals.ytdVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{data.totals.ytdVariancePct}%</td>
                    <td className="px-4 py-3">
                      <Badge variant={data.totals.ytdVariance >= 0 ? "green" : "red"}>{data.totals.ytdVariance >= 0 ? "Favorable" : "Unfavorable"}</Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-muted-foreground">
          No {budgetType} budgets found for this entity/year yet.
        </div>
      )}
    </div>
  );
}
