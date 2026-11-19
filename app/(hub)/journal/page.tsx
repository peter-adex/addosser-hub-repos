"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, X, Loader2, AlertCircle, RefreshCw, Download } from "lucide-react";
import { usePaymentCaps } from "@/hooks/usePaymentCaps";

function naira(v: number | string | null | undefined): string {
  if (!v && v !== 0) return "₦0.00";
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

interface JournalEntry {
  id: string;
  entryRef: string;
  entryDate: string;
  invoiceNo: string;
  vendorName: string;
  description: string;
  debitGLCode: string;
  debitGLName: string;
  creditGLCode: string;
  creditGLName: string;
  grossAmount: string;
  vatAmount: string;
  whtAmount: string;
  netAmount: string;
  entity?: { name: string; code: string } | null;
}

interface Entity { id: string; name: string; code: string; }

const BLANK = {
  entryRef: "", invoiceNo: "", vendorName: "",
  entityId: "ALL", dateFrom: "", dateTo: "",
};

async function fetchJSON(url: string) {
  const res = await fetch(url);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
  const d = await res.json();
  if (!res.ok) throw new Error(d.error ?? "Failed");
  return d;
}

export default function JournalPage() {
  const caps = usePaymentCaps();
  const perms = { canView: caps.canView("journal") };
  const [entries,  setEntries]  = useState<JournalEntry[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [form,     setForm]     = useState(BLANK);

  useEffect(() => {
    fetchJSON("/api/payment/entities-lookup")
      .then((d) => setEntities(d.entities ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (f = form) => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams();
      if (f.entryRef.trim())   p.set("entryRef",   f.entryRef.trim());
      if (f.invoiceNo.trim())  p.set("invoiceNo",  f.invoiceNo.trim());
      if (f.vendorName.trim()) p.set("vendorName", f.vendorName.trim());
      if (f.entityId !== "ALL") p.set("entityId",  f.entityId);
      if (f.dateFrom)          p.set("dateFrom",   f.dateFrom);
      if (f.dateTo)            p.set("dateTo",     f.dateTo);
      const d = await fetchJSON(`/api/journal?${p}`);
      setEntries(d.entries ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [form]);

  useEffect(() => { load(); }, []);

  function setF(key: keyof typeof BLANK, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(form);
  }

  function handleClear() {
    const blank = BLANK;
    setForm(blank);
    load(blank);
  }

  function handleExportCSV() {
    const headers = ["Ref", "Date", "Invoice", "Vendor", "Debit GL", "Credit GL", "Gross", "VAT", "WHT", "Net Paid"];
    const rows = entries.map((e) => [
      e.entryRef, fmtDate(e.entryDate), e.invoiceNo, e.vendorName,
      `${e.debitGLCode} ${e.debitGLName}`,
      `${e.creditGLCode} ${e.creditGLName}`,
      e.grossAmount, e.vatAmount, e.whtAmount, e.netAmount,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journal-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const totalDebit  = entries.reduce((s, e) => s + parseFloat(e.grossAmount), 0);
  const totalCredit = entries.reduce((s, e) => s + parseFloat(e.netAmount), 0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Journal Entries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Double-entry payment accounting records — auto-posted on tranche approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground">
            <RefreshCw size={14} />
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-accent"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Entries", value: entries.length, plain: true },
            { label: "Total Debited (Gross)", value: naira(totalDebit), plain: false },
            { label: "Total Net Paid", value: naira(totalCredit), plain: false },
          ].map((t) => (
            <div key={t.label} className="bg-card border border-border rounded-2xl p-5">
              <div className={`text-xl font-extrabold font-mono ${t.plain ? "text-foreground" : "text-[#FFB800]"}`}>{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <input value={form.entryRef}   onChange={(e) => setF("entryRef",   e.target.value)} placeholder="Journal Ref (JRN-…)" className={inputCls} />
        <input value={form.invoiceNo}  onChange={(e) => setF("invoiceNo",  e.target.value)} placeholder="Invoice No."          className={inputCls} />
        <input value={form.vendorName} onChange={(e) => setF("vendorName", e.target.value)} placeholder="Vendor name"          className={inputCls} />
        <select value={form.entityId}  onChange={(e) => setF("entityId",   e.target.value)} className={inputCls}>
          <option value="ALL">All Entities</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
        </select>
        <input type="date" value={form.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} className={inputCls} />
        <input type="date" value={form.dateTo}   onChange={(e) => setF("dateTo",   e.target.value)} className={inputCls} />

        <div className="md:col-span-3 lg:col-span-6 flex gap-2">
          <button type="submit" className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold">
            <Search size={13} /> Search
          </button>
          <button type="button" onClick={handleClear} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent">
            <X size={13} /> Clear
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading journal entries…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="text-5xl">📒</span>
          <p className="font-bold text-foreground">No journal entries found</p>
          <p className="text-sm">Entries are auto-created when payment tranches are approved.</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3">Ref</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Vendor</th>
                <th className="text-left px-4 py-3">Debit GL</th>
                <th className="text-left px-4 py-3">Credit GL</th>
                <th className="text-right px-4 py-3">Gross</th>
                <th className="text-right px-4 py-3">VAT</th>
                <th className="text-right px-4 py-3">WHT</th>
                <th className="text-right px-4 py-3">Net Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300">{e.entryRef}</code>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(e.entryDate)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{e.invoiceNo}</td>
                  <td className="px-4 py-3 text-foreground max-w-[160px] truncate">{e.vendorName}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-red-700 dark:text-red-400">DR</div>
                    <div className="text-xs text-foreground">{e.debitGLCode} — {e.debitGLName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-green-700 dark:text-green-400">CR</div>
                    <div className="text-xs text-foreground">{e.creditGLCode} — {e.creditGLName}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{naira(e.grossAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">{naira(e.vatAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400 text-xs">−{naira(e.whtAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#FFB800]">{naira(e.netAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t border-border">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-xs font-bold text-muted-foreground text-right">TOTALS</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{naira(totalDebit)}</td>
                <td colSpan={2} className="px-4 py-3" />
                <td className="px-4 py-3 text-right font-mono font-bold text-[#FFB800]">{naira(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
