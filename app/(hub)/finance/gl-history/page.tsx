"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, FileText, User as UserIcon, CheckCircle2, Truck } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

interface EntityOpt { id: string; name: string; code: string; isActive: boolean; }
interface GLOpt { glAccountId: string; code: string; name: string; category: string; }
interface LedgerRow {
  id: string; transactionDate: string; entryType: "DEBIT" | "CREDIT"; amount: string;
  description: string | null; referenceNo: string | null; sourceType: string; status: string;
  balance: number | null; entity: { code: string; name: string };
}
interface Ledger { rows: LedgerRow[]; totalDebit: number; totalCredit: number; netBalance: number; transactionCount: number; }

const fmt = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const inputCls = "px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

const STATUS_VARIANT: Record<string, "gray" | "yellow" | "blue" | "green" | "red"> = {
  DRAFT: "gray", PENDING_APPROVAL: "yellow", APPROVED: "blue", POSTED: "green", REJECTED: "red", CANCELLED: "gray",
};

export default function GLHistoryPage() {
  const [entities, setEntities] = useState<EntityOpt[]>([]);
  const [entityId, setEntityId] = useState("");
  const [glQuery, setGlQuery] = useState("");
  const [glOptions, setGlOptions] = useState<GLOpt[]>([]);
  const [selectedGL, setSelectedGL] = useState<GLOpt | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entryType, setEntryType] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [referenceNo, setReferenceNo] = useState("");

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then((d) => setEntities(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!entityId) { setGlOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/gl-accounts/search?entityId=${entityId}&q=${encodeURIComponent(glQuery.trim())}&requireBudget=false`)
        .then((r) => r.json())
        .then((d) => { if (d.success) setGlOptions(d.data); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [entityId, glQuery]);

  const load = useCallback(async () => {
    if (!selectedGL) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ glAccountId: selectedGL.glAccountId, entityId });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (entryType) params.set("entryType", entryType);
      if (sourceType) params.set("sourceType", sourceType);
      if (referenceNo) params.set("referenceNo", referenceNo);
      const res = await fetch(`/api/gl-transactions?${params.toString()}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load GL history");
      setLedger(d.data);
    } catch (err: any) {
      setError(err.message);
      setLedger(null);
    } finally { setLoading(false); }
  }, [selectedGL, entityId, dateFrom, dateTo, entryType, sourceType, referenceNo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/finance/gl-entries" className="hover:text-foreground">Finance</Link>
        <span>/</span>
        <span className="text-foreground font-medium">GL Account Expense History</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">GL Account Expense History</h1>
        <p className="text-muted-foreground text-sm mt-1">Select an entity, then a GL account, to view its complete posting history.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className={labelCls}>Entity</label>
          <select className={inputCls} value={entityId} onChange={(e) => { setEntityId(e.target.value); setSelectedGL(null); setLedger(null); }}>
            <option value="">— Select entity —</option>
            {entities.filter((e) => e.isActive).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
          </select>
        </div>

        <div className="relative flex-1 min-w-[240px]">
          <label className={labelCls}>GL Account</label>
          {selectedGL ? (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-accent/30">
              <div>
                <span className="text-sm font-semibold text-foreground">{selectedGL.name}</span>
                <code className="text-xs text-muted-foreground ml-2">{selectedGL.code}</code>
              </div>
              <button onClick={() => { setSelectedGL(null); setLedger(null); }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Change</button>
            </div>
          ) : (
            <>
              <input
                className={inputCls + " w-full"}
                placeholder={entityId ? "Search GL code or name…" : "Select an entity first"}
                value={glQuery}
                disabled={!entityId}
                onChange={(e) => setGlQuery(e.target.value)}
              />
              {glOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full border border-border rounded-xl overflow-hidden divide-y divide-border bg-card shadow-lg">
                  {glOptions.map((g) => (
                    <button key={g.glAccountId} type="button" onClick={() => { setSelectedGL(g); setGlQuery(""); setGlOptions([]); }} className="w-full text-left px-4 py-2.5 hover:bg-accent/50">
                      <div className="text-sm font-semibold text-foreground">{g.name}</div>
                      <code className="text-xs text-muted-foreground">{g.code}</code>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedGL && (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className={labelCls}>From</label>
              <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>To</label>
              <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                <option value="">All</option>
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select className={inputCls} value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                <option value="">All</option>
                <option value="INVOICE">Invoice</option>
                <option value="MANUAL_CREDIT">Manual Credit</option>
                <option value="MANUAL_JOURNAL">Manual Journal</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Reference No.</label>
              <input className={inputCls} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Search…" />
            </div>
          </div>

          {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">Loading…</div>
          ) : ledger ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ["Total Debit", fmt(ledger.totalDebit)],
                  ["Total Credit", fmt(ledger.totalCredit)],
                  ["Net Balance", fmt(ledger.netBalance)],
                  ["Transactions", String(ledger.transactionCount)],
                ].map(([label, val]) => (
                  <div key={label} className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-lg font-extrabold text-foreground">{val}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        {["Date", "Entity", "Reference", "Description", "Debit", "Credit", "Balance", "Status", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.rows.map((r) => (
                        <tr key={r.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => setDetailId(r.id)}>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(r.transactionDate).toLocaleDateString("en-NG")}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{r.entity.code}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.referenceNo ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground max-w-[220px] truncate">{r.description ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground font-semibold">{r.entryType === "DEBIT" ? fmt(Number(r.amount)) : "—"}</td>
                          <td className="px-4 py-3 text-red-600 font-semibold">{r.entryType === "CREDIT" ? fmt(Number(r.amount)) : "—"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{r.balance !== null ? fmt(r.balance) : "—"}</td>
                          <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[r.status] ?? "gray"}>{r.status}</Badge></td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#1B2A8A] dark:text-blue-400">View →</td>
                        </tr>
                      ))}
                      {ledger.rows.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No postings match these filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {detailId && <TransactionDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function TransactionDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/gl-transactions/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); else setError(d.error ?? "Failed to load"); })
      .catch(() => setError("Failed to load transaction"))
      .finally(() => setLoading(false));
  }, [id]);

  const txn = data?.transaction;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-background overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-foreground">Transaction Detail</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {loading && <div className="text-center text-muted-foreground py-10">Loading…</div>}
          {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 text-sm">⚠️ {error}</div>}

          {txn && (
            <>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Accounting Details</h3>
                <div className="grid grid-cols-2 gap-3 bg-card border border-border rounded-xl p-4 text-sm">
                  <div><span className="text-muted-foreground">Entity:</span> <span className="font-semibold text-foreground">{txn.entity.code}</span></div>
                  <div><span className="text-muted-foreground">GL Account:</span> <span className="font-semibold text-foreground">{txn.glAccount.code} — {txn.glAccount.name}</span></div>
                  <div><span className="text-muted-foreground">Type:</span> <span className={`font-semibold ${txn.entryType === "DEBIT" ? "text-foreground" : "text-red-600"}`}>{txn.entryType}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold text-foreground">{fmt(Number(txn.amount))}</span></div>
                  <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold text-foreground">{new Date(txn.transactionDate).toLocaleDateString("en-NG")}</span></div>
                  <div><span className="text-muted-foreground">Reference:</span> <span className="font-semibold text-foreground">{txn.referenceNo ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Source:</span> <span className="font-semibold text-foreground">{txn.sourceType}</span></div>
                  {txn.description && <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span className="text-foreground">{txn.description}</span></div>}
                </div>
              </section>

              {txn.invoice && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><FileText size={13} /> Invoice Details</h3>
                  <div className="grid grid-cols-2 gap-3 bg-card border border-border rounded-xl p-4 text-sm">
                    <div><span className="text-muted-foreground">Invoice No.:</span> <span className="font-semibold text-foreground">{txn.invoice.invoiceNo}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold text-foreground">{txn.invoice.invoiceType}</span></div>
                    <div><span className="text-muted-foreground">Vendor:</span> <span className="font-semibold text-foreground">{txn.invoice.vendorName ?? txn.invoice.vendor?.name ?? "—"}</span></div>
                    <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold text-foreground">{fmt(Number(txn.invoice.amountPayable))}</span></div>
                    <Link href={`/invoice/${txn.invoice.id}`} className="col-span-2 text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">View full invoice →</Link>
                  </div>
                </section>
              )}

              {txn.invoice?.submittedBy && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><UserIcon size={13} /> Requisitioner</h3>
                  <div className="grid grid-cols-2 gap-3 bg-card border border-border rounded-xl p-4 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold text-foreground">{txn.invoice.submittedBy.name}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-semibold text-foreground">{txn.invoice.submittedBy.email}</span></div>
                    {txn.invoice.submittedBy.jobTitle && <div><span className="text-muted-foreground">Job Title:</span> <span className="font-semibold text-foreground">{txn.invoice.submittedBy.jobTitle}</span></div>}
                    {txn.invoice.submittedBy.department && <div><span className="text-muted-foreground">Department:</span> <span className="font-semibold text-foreground">{txn.invoice.submittedBy.department}</span></div>}
                  </div>
                </section>
              )}

              {data.approvalInstance && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><CheckCircle2 size={13} /> Approval Details</h3>
                  <div className="space-y-2">
                    {data.approvalInstance.steps.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3 text-sm">
                        <div>
                          <div className="font-semibold text-foreground">Step {s.stepNumber} — {s.userName || s.roleName}</div>
                          {s.comment && <div className="text-xs text-muted-foreground italic">"{s.comment}"</div>}
                        </div>
                        <Badge variant={s.status === "APPROVED" ? "green" : s.status === "REJECTED" ? "red" : "yellow"}>{s.status}</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(txn.asset || txn.invoice?.asset) && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Truck size={13} /> Asset Details</h3>
                  <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-2">
                    {(() => {
                      const asset = txn.asset ?? txn.invoice.asset;
                      return (
                        <>
                          <div className="font-semibold text-foreground">{asset.name} ({asset.assetNo})</div>
                          <div className="text-xs text-muted-foreground">{asset.classification?.name ?? "—"} · Status: {asset.status}</div>
                          {data.assetHistorySummary && (
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border mt-2">
                              <div><span className="text-muted-foreground">All-time expenditure:</span> <span className="font-bold text-foreground">{fmt(data.assetHistorySummary.summary.totalAllTime)}</span></div>
                              <div><span className="text-muted-foreground">Transactions:</span> <span className="font-bold text-foreground">{data.assetHistorySummary.summary.transactionCount}</span></div>
                            </div>
                          )}
                          <Link href={`/assets/${asset.id}`} className="inline-block text-xs font-semibold text-[#1B2A8A] dark:text-blue-400 hover:underline">View asset profile →</Link>
                        </>
                      );
                    })()}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
