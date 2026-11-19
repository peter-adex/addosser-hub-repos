"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Search, X, RefreshCw, Loader2, AlertCircle } from "lucide-react";

function naira(v: string | number) {
  return `₦${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

interface Tranche { id: string; label: string | null; plannedAmount: string; status: string; trancheNumber: number; }
interface Batch {
  id: string; status: string; totalAmount: string; assignedAt: string; instructions: string | null;
  invoice: { invoiceNo: string; vendorName: string; vendor: { name: string } | null; entity: { name: string; code: string }; };
  tranches: Tranche[];
}

function TrancheStatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    PENDING:   "bg-muted text-muted-foreground",
    SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PAID:      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    REJECTED:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

export default function MyTasksPage() {
  const user = useCurrentUser();
  const [all,     setAll]     = useState<Batch[]>([]);
  const [shown,   setShown]   = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [invoiceNo,   setInvoiceNo]   = useState("");
  const [vendorName,  setVendorName]  = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/payment/my-tasks");
      const ct  = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) throw new Error(`Server error (${res.status})`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load");
      setAll(d.batches ?? []);
      setShown(d.batches ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function applySearch() {
    let filtered = all;
    if (invoiceNo.trim())
      filtered = filtered.filter((b) =>
        b.invoice.invoiceNo.toLowerCase().includes(invoiceNo.toLowerCase().trim())
      );
    if (vendorName.trim())
      filtered = filtered.filter((b) =>
        (b.invoice.vendor?.name ?? b.invoice.vendorName)
          .toLowerCase().includes(vendorName.toLowerCase().trim())
      );
    if (statusFilter)
      filtered = filtered.filter((b) =>
        b.tranches.some((t) => t.status === statusFilter)
      );
    setShown(filtered);
  }

  function clearSearch() {
    setInvoiceNo(""); setVendorName(""); setStatusFilter("");
    setShown(all);
  }

  const pendingCount  = all.reduce((s, b) => s + b.tranches.filter((t) => t.status === "PENDING").length, 0);
  const rejectedCount = all.reduce((s, b) => s + b.tranches.filter((t) => t.status === "REJECTED").length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">My Payment Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hello, {user?.name?.split(" ")[0]} — payments assigned to you
          </p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Assignments", value: all.length,    icon: "📌" },
            { label: "Pending Processing", value: pendingCount,  icon: "⏳" },
            { label: "Returned to You",    value: rejectedCount, icon: "⚠️",
              red: rejectedCount > 0 },
          ].map((t) => (
            <div key={t.label} className={`bg-card border rounded-2xl p-5 ${t.red ? "border-red-200 dark:border-red-800" : "border-border"}`}>
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className={`text-2xl font-extrabold ${t.red ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="Invoice No."
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]" />
        <input value={vendorName} onChange={(e) => setVendorName(e.target.value)}
          placeholder="Vendor name"
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FFB800]">
          <option value="">Any tranche status</option>
          {["PENDING", "SUBMITTED", "PAID", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={applySearch}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold">
            <Search size={14} /> Search
          </button>
          <button onClick={clearSearch} title="Clear search"
            className="px-3 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-accent transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading your tasks…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && shown.length === 0 && (
        <div className="bg-card border border-border rounded-2xl py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <span className="text-5xl">📭</span>
          <p className="font-bold text-foreground">No tasks match your search</p>
          <button onClick={clearSearch} className="text-sm text-[#1B2A8A] dark:text-blue-400 hover:underline">Clear search</button>
        </div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div className="space-y-4">
          {shown.map((b) => {
            const hasRejected = b.tranches.some((t) => t.status === "REJECTED");
            const hasPending  = b.tranches.some((t) => t.status === "PENDING");
            const actionable  = b.tranches.filter((t) => ["PENDING", "REJECTED"].includes(t.status));

            return (
              <div key={b.id} className={`bg-card border rounded-2xl overflow-hidden ${hasRejected ? "border-red-200 dark:border-red-800" : "border-border"}`}>
                <div className="px-6 py-4 flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded">
                        {b.invoice.invoiceNo}
                      </code>
                      {hasRejected && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          ⚠️ Returned for correction
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-foreground">{b.invoice.vendor?.name ?? b.invoice.vendorName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.invoice.entity.name} · Assigned {fmtDate(b.assignedAt)}
                    </p>
                    {b.instructions && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">📋 {b.instructions}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold font-mono text-[#FFB800]">{naira(b.totalAmount)}</div>
                    <div className="text-xs text-muted-foreground">{b.tranches.length} tranche{b.tranches.length > 1 ? "s" : ""}</div>
                  </div>
                </div>

                <div className="border-t border-border divide-y divide-border">
                  {b.tranches.map((t) => {
                    const canProcess = ["PENDING", "REJECTED"].includes(t.status);
                    return (
                      <div key={t.id} className="px-6 py-3 flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {t.trancheNumber}
                          </span>
                          <span className="text-foreground font-medium">{t.label ?? `Tranche ${t.trancheNumber}`}</span>
                          <TrancheStatusBadge status={t.status} />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-foreground">{naira(t.plannedAmount)}</span>
                          {canProcess && (
                            <Link href={`/payment/process/${t.id}`}
                              className="px-3 py-1.5 rounded-lg bg-[#1B2A8A] text-white text-xs font-bold hover:bg-[#121E6B] transition-colors">
                              {t.status === "REJECTED" ? "Correct & Resubmit" : "Process →"}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-6 py-3 border-t border-border">
                  <Link href={`/payment/${b.id}`} className="text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">
                    View Full Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
