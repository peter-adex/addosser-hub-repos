"use client";
import { useEffect, useState, useCallback, Fragment } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import { usePaymentCaps } from "@/hooks/usePaymentCaps";

function naira(v: number | string | null | undefined): string {
  if (!v && v !== 0) return "₦0.00";
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ExpenseRow { glCode: string; glName: string; category: string; debit: number; count: number; }
interface SettlementRow { glCode: string; glName: string; debit: number; credit: number; count: number; }
interface Entity { id: string; name: string; code: string; }
interface DrillRow {
  id: string; ref: string; party: string; entityCode: string;
  amount: number; status: string; date: string; href: string; note?: string;
}

const STATUS_MODES = [
  { value: "APPROVED_PLUS", label: "Approved & Beyond (default)" },
  { value: "PAID_ONLY", label: "Paid Only" },
  { value: "ALL_NON_DRAFT", label: "All Submitted (incl. Pending/Rejected)" },
] as const;

const BLANK = { entityId: "ALL", dateFrom: "", dateTo: "", statusMode: "APPROVED_PLUS" };

async function fetchJSON(url: string) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "Failed");
  return d;
}

export default function TrialBalancePage() {
  const caps = usePaymentCaps();
  const perms = { canView: caps.canView("trial-balance") };

  const [entities, setEntities] = useState<Entity[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [settlementRows, setSettlementRows] = useState<SettlementRow[]>([]);
  const [settlementDebitTotal, setSettlementDebitTotal] = useState(0);
  const [settlementCreditTotal, setSettlementCreditTotal] = useState(0);
  const [isBalanced, setIsBalanced] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(BLANK);

  const [expanded, setExpanded] = useState<{ section: "expense" | "settlement"; glCode: string } | null>(null);
  const [drillRows, setDrillRows] = useState<DrillRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");

  async function toggleDrillDown(section: "expense" | "settlement", glCode: string) {
    if (expanded?.section === section && expanded?.glCode === glCode) {
      setExpanded(null);
      return;
    }
    setExpanded({ section, glCode });
    setDrillRows([]);
    setDrillError("");
    setDrillLoading(true);
    try {
      const p = new URLSearchParams();
      if (form.entityId !== "ALL") p.set("entityId", form.entityId);
      if (form.dateFrom) p.set("dateFrom", form.dateFrom);
      if (form.dateTo) p.set("dateTo", form.dateTo);
      p.set("statusMode", form.statusMode);
      p.set("drillSection", section);
      p.set("drillGlCode", glCode);
      const d = await fetchJSON(`/api/trial-balance?${p}`);
      setDrillRows(d.rows ?? []);
    } catch (e: any) {
      setDrillError(e.message);
    } finally {
      setDrillLoading(false);
    }
  }

  useEffect(() => {
    fetchJSON("/api/payment/entities-lookup")
      .then((d) => setEntities(d.entities ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (f = form) => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (f.entityId !== "ALL") p.set("entityId", f.entityId);
      if (f.dateFrom) p.set("dateFrom", f.dateFrom);
      if (f.dateTo) p.set("dateTo", f.dateTo);
      p.set("statusMode", f.statusMode);
      const d = await fetchJSON(`/api/trial-balance?${p}`);
      setExpenseRows(d.expense?.rows ?? []);
      setExpenseTotal(d.expense?.total ?? 0);
      setInvoiceCount(d.expense?.invoiceCount ?? 0);
      setSettlementRows(d.settlement?.rows ?? []);
      setSettlementDebitTotal(d.settlement?.debitTotal ?? 0);
      setSettlementCreditTotal(d.settlement?.creditTotal ?? 0);
      setIsBalanced(d.settlement?.isBalanced ?? true);
      setEntities((prev) => (d.entities?.length ? d.entities : prev));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { load(); }, []);

  function setF(key: keyof typeof BLANK, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setExpanded(null);
    load(form);
  }

  function handleClear() {
    setForm(BLANK);
    setExpanded(null);
    load(BLANK);
  }

  function handleExportCSV() {
    const lines: string[][] = [];
    lines.push(["EXPENSE RECOGNITION BY GL ACCOUNT"]);
    lines.push(["GL Code", "GL Name", "Category", "Invoice Count", "Amount"]);
    expenseRows.forEach((r) => lines.push([r.glCode, r.glName, r.category, String(r.count), r.debit.toFixed(2)]));
    lines.push(["", "", "", "TOTAL", expenseTotal.toFixed(2)]);
    lines.push([]);
    lines.push(["PAYMENT SETTLEMENT JOURNAL"]);
    lines.push(["GL Code", "GL Name", "Debit", "Credit"]);
    settlementRows.forEach((r) => lines.push([r.glCode, r.glName, r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : ""]));
    lines.push(["", "", "TOTAL", settlementDebitTotal.toFixed(2), settlementCreditTotal.toFixed(2)]);

    const csv = lines
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trial-balance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (!perms.canView) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertCircle size={40} className="text-red-500" />
        <p className="font-bold text-foreground">Access Denied</p>
        <p className="text-sm text-muted-foreground">You need Payment Processing view access.</p>
      </div>
    );
  }

  const inputCls = "rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const hasData = expenseRows.length > 0 || settlementRows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Trial Balance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            GL account totals — expense recognition and payment settlement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground">
            <RefreshCw size={14} />
          </button>
          {hasData && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-800 dark:text-blue-300">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <p>
          These two sections measure different things and <strong>won't sum to the same total</strong> —
          that's expected, not an error. <strong>Expense Recognition</strong> includes approved invoices
          regardless of payment status. <strong>Payment Settlement</strong> only includes what's actually
          been paid out.
        </p>
      </div>

      <form onSubmit={handleSearch} className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select value={form.entityId} onChange={(e) => setF("entityId", e.target.value)} className={inputCls}>
          <option value="ALL">All Entities</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
        </select>
        <input type="date" value={form.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} className={inputCls} />
        <input type="date" value={form.dateTo} onChange={(e) => setF("dateTo", e.target.value)} className={inputCls} />
        <select value={form.statusMode} onChange={(e) => setF("statusMode", e.target.value)} className={inputCls} title="Which invoice statuses count toward Expense Recognition">
          {STATUS_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="md:col-span-4 flex gap-2">
          <button type="submit" className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold">
            <Search size={13} /> Apply
          </button>
          <button type="button" onClick={handleClear} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent">
            <X size={13} /> Clear
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" /> Generating trial balance…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-foreground text-sm">Expense Recognition by GL Account</h2>
              <span className="text-xs text-muted-foreground">{invoiceCount} invoice{invoiceCount !== 1 ? "s" : ""}</span>
            </div>
            {expenseRows.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <span className="text-3xl">📄</span>
                <p className="text-sm font-semibold">No invoices match this filter</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">GL Code</th>
                      <th className="text-left px-4 py-3">GL Name</th>
                      <th className="text-left px-4 py-3">Category</th>
                      <th className="text-right px-4 py-3">Invoices</th>
                      <th className="text-right px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenseRows.map((r) => {
                      const isOpen = expanded?.section === "expense" && expanded?.glCode === r.glCode;
                      return (
                        <Fragment key={r.glCode}>
                          <tr
                            onClick={() => toggleDrillDown("expense", r.glCode)}
                            className={`cursor-pointer hover:bg-muted/20 transition-colors ${isOpen ? "bg-muted/20" : ""}`}
                            title="Click to see the individual invoices behind this total"
                          >
                            <td className="px-4 py-3"><code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300">{r.glCode}</code></td>
                            <td className="px-4 py-3 font-medium text-foreground">{r.glName}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{r.category}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{r.count}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{naira(r.debit)}</td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={5} className="p-0 bg-muted/10">
                                <DrillDownPanel loading={drillLoading} error={drillError} rows={drillRows} refLabel="Invoice" />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-xs font-bold text-muted-foreground text-right">TOTAL</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#FFB800]">{naira(expenseTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-foreground text-sm">Payment Settlement Journal</h2>
              {settlementRows.length > 0 && (
                <span
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                    isBalanced
                      ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                  }`}
                >
                  {isBalanced ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {isBalanced ? "Balanced" : "Out of balance"}
                </span>
              )}
            </div>
            {settlementRows.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <span className="text-3xl">💳</span>
                <p className="text-sm font-semibold">No payments posted for this filter</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">GL Code</th>
                      <th className="text-left px-4 py-3">GL Name</th>
                      <th className="text-right px-4 py-3">Debit</th>
                      <th className="text-right px-4 py-3">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {settlementRows.map((r, i) => {
                      const isOpen = expanded?.section === "settlement" && expanded?.glCode === r.glCode;
                      return (
                        <Fragment key={`${r.glCode}-${i}`}>
                          <tr
                            onClick={() => toggleDrillDown("settlement", r.glCode)}
                            className={`cursor-pointer hover:bg-muted/20 transition-colors ${isOpen ? "bg-muted/20" : ""}`}
                            title="Click to see the individual payment entries behind this total"
                          >
                            <td className="px-4 py-3"><code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300">{r.glCode}</code></td>
                            <td className="px-4 py-3 font-medium text-foreground">{r.glName}</td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {r.debit > 0 ? naira(r.debit) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground">
                              {r.credit > 0 ? naira(r.credit) : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={4} className="p-0 bg-muted/10">
                                <DrillDownPanel loading={drillLoading} error={drillError} rows={drillRows} refLabel="Journal Entry" />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-xs font-bold text-muted-foreground text-right">TOTALS</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{naira(settlementDebitTotal)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#FFB800]">{naira(settlementCreditTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DrillDownPanel({
  loading,
  error,
  rows,
  refLabel,
}: {
  loading: boolean;
  error: string;
  rows: { id: string; ref: string; party: string; entityCode: string; amount: number; status: string; date: string; href: string; note?: string }[];
  refLabel: string;
}) {
  if (loading) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Loading {refLabel.toLowerCase()} details…
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="px-6 py-5 text-sm text-muted-foreground">
        No underlying {refLabel.toLowerCase()} records found for this filter.
      </div>
    );
  }
  return (
    <div className="px-4 py-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground uppercase text-[10px]">
            <th className="text-left px-2 py-1.5">{refLabel}</th>
            <th className="text-left px-2 py-1.5">Party</th>
            <th className="text-left px-2 py-1.5">Entity</th>
            <th className="text-left px-2 py-1.5">Status / Leg</th>
            <th className="text-left px-2 py-1.5">Date</th>
            <th className="text-right px-2 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-1.5">
                <a href={r.href} className="font-bold text-[#1B2A8A] dark:text-blue-300 hover:underline">
                  {r.ref}
                </a>
                {r.note && <span className="text-muted-foreground ml-1">({r.note})</span>}
              </td>
              <td className="px-2 py-1.5 text-foreground">{r.party}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{r.entityCode}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{r.status}</td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {new Date(r.date).toLocaleDateString("en-NG", { dateStyle: "medium" })}
              </td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">{naira(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 200 && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Showing the first 200 records. Narrow the date range for a complete list.
        </p>
      )}
    </div>
  );
}
