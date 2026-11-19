"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, X, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { invoiceTypeLabel, INVOICE_TYPE_BADGE_CLASS } from "@/lib/invoice-type-labels";

function naira(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "₦0.00";
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (isNaN(n)) return "₦0.00";
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

interface Entity { id: string; name: string; code: string; }
interface HistoryRow {
  id: string;
  label: string | null;
  plannedAmount: string;
  status: string;
  transactionRef: string | null;
  paidAt: string | null;
  paymentBatch: {
    id: string;
    invoice: {
      invoiceNo: string;
      invoiceType: string;
      vendor: { name: string } | null;
      vendorName: string;
      entity: { name: string; code: string };
    };
    teller: { name: string } | null;
  };
  approvals: { approvedBy: { name: string }; action: string }[];
}

const STATUSES = ["", "PENDING", "SUBMITTED", "PAID", "REJECTED"];

function statusClass(s: string): string {
  const m: Record<string, string> = {
    PAID:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    REJECTED:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    PENDING:   "bg-muted text-muted-foreground",
  };
  return m[s] ?? "bg-muted text-muted-foreground";
}

const BLANK = { entityId: "ALL", invoiceNo: "", vendorName: "", transactionRef: "", status: "", dateFrom: "", dateTo: "" };

export default function PaymentHistoryPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [rows, setRows]         = useState<HistoryRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [form, setForm]         = useState(BLANK);

  useEffect(() => {
    fetch("/api/payment/entities-lookup")
      .then(async (r) => {
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) return;
        const d = await r.json();
        setEntities(d.entities ?? []);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (params: typeof BLANK) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (params.entityId && params.entityId !== "ALL") q.set("entityId", params.entityId);
      if (params.invoiceNo.trim())     q.set("invoiceNo", params.invoiceNo.trim());
      if (params.vendorName.trim())    q.set("vendorName", params.vendorName.trim());
      if (params.transactionRef.trim()) q.set("transactionRef", params.transactionRef.trim());
      if (params.status)               q.set("status", params.status);
      if (params.dateFrom)             q.set("dateFrom", params.dateFrom);
      if (params.dateTo)               q.set("dateTo", params.dateTo);

      const res = await fetch(`/api/payment/history?${q.toString()}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load");
      setRows(d.tranches ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(BLANK); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(form);
  }

  function handleClear() {
    setForm(BLANK);
    load(BLANK);
  }

  const hasFilters = Object.entries(form).some(([k, v]) => v && v !== "ALL");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Payment History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search across all processed payments — {rows.length} record{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => load(form)}
          className="p-2.5 rounded-xl border border-border hover:bg-accent transition-colors text-muted-foreground"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        className="bg-card border border-border rounded-2xl p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <select
            value={form.entityId}
            onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          >
            <option value="ALL">All Entities</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
            ))}
          </select>

          <input
            value={form.invoiceNo}
            onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))}
            placeholder="Invoice No."
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          />

          <input
            value={form.vendorName}
            onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
            placeholder="Vendor name"
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          />

          <input
            value={form.transactionRef}
            onChange={(e) => setForm((f) => ({ ...f, transactionRef: e.target.value }))}
            placeholder="Transaction ref"
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          />

          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s || "Any Status"}</option>)}
          </select>

          <input
            type="date"
            value={form.dateFrom}
            onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          />

          <input
            type="date"
            value={form.dateTo}
            onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold hover:bg-yellow-500 transition-colors"
            >
              <Search size={14} /> Search
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!hasFilters}
              title="Clear all filters and reload all records"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <X size={14} /> Clear
            </button>
          </div>
        </div>

        {hasFilters && (
          <p className="text-xs text-[#FFB800] font-semibold">
            Filters active — showing filtered results. Click Clear to see all records.
          </p>
        )}
      </form>

      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading payment history…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="text-5xl">📋</span>
          <p className="font-bold text-foreground">No payment records match your search</p>
          {hasFilters && (
            <button onClick={handleClear} className="text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline">
              Clear filters to see all records
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              {rows.length} record{rows.length !== 1 ? "s" : ""}
              {hasFilters && <span className="text-muted-foreground font-normal ml-1">(filtered)</span>}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Vendor</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">Teller</th>
                  <th className="text-left px-4 py-3">Ref</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300">
                        {r.paymentBatch.invoice.invoiceNo}
                      </code>
                      {r.label && r.label !== "Full Payment" && (
                        <div className="text-xs text-muted-foreground mt-0.5">{r.label}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${INVOICE_TYPE_BADGE_CLASS[r.paymentBatch.invoice.invoiceType as keyof typeof INVOICE_TYPE_BADGE_CLASS] ?? 'bg-muted text-muted-foreground'}`}>
                        {invoiceTypeLabel(r.paymentBatch.invoice.invoiceType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {r.paymentBatch.invoice.vendor?.name ?? r.paymentBatch.invoice.vendorName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.paymentBatch.invoice.entity.code}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.paymentBatch.teller?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                      {r.transactionRef ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {naira(r.plannedAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {fmtDate(r.paidAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/payment/${r.paymentBatch.id}`}
                        className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
