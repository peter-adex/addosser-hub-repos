"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface EntityOpt { id: string; name: string; code: string; isActive: boolean; }
interface GLOpt { glAccountId: string; code: string; name: string; category: string; }

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

function GLLinePicker({
  title, entities, entityId, setEntityId, glQuery, setGlQuery, glOptions, selectedGL, setSelectedGL,
}: {
  title: string; entities: EntityOpt[];
  entityId: string; setEntityId: (v: string) => void;
  glQuery: string; setGlQuery: (v: string) => void;
  glOptions: GLOpt[]; selectedGL: GLOpt | null; setSelectedGL: (g: GLOpt | null) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h2 className="font-bold text-foreground">{title}</h2>
      <div>
        <label className={labelCls}>Entity</label>
        <select className={inputCls} value={entityId} onChange={(e) => { setEntityId(e.target.value); setSelectedGL(null); }}>
          <option value="">— Select entity —</option>
          {entities.filter((e) => e.isActive).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>GL Account</label>
        {selectedGL ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-accent/30">
            <div>
              <div className="font-semibold text-sm text-foreground">{selectedGL.name}</div>
              <code className="text-xs text-muted-foreground">{selectedGL.code}</code>
            </div>
            <button type="button" onClick={() => setSelectedGL(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Change</button>
          </div>
        ) : (
          <>
            <input
              className={inputCls}
              placeholder={entityId ? "Search GL code or name…" : "Select an entity first"}
              value={glQuery}
              disabled={!entityId}
              onChange={(e) => setGlQuery(e.target.value)}
            />
            {glOptions.length > 0 && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden divide-y divide-border">
                {glOptions.map((g) => (
                  <button key={g.glAccountId} type="button" onClick={() => { setSelectedGL(g); setGlQuery(""); }} className="w-full text-left px-4 py-2.5 hover:bg-accent/50">
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
  );
}

export default function NewGLJournalEntryPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<EntityOpt[]>([]);

  const [debitEntityId, setDebitEntityId] = useState("");
  const [debitGLQuery, setDebitGLQuery] = useState("");
  const [debitGLOptions, setDebitGLOptions] = useState<GLOpt[]>([]);
  const [debitGL, setDebitGL] = useState<GLOpt | null>(null);

  const [creditEntityId, setCreditEntityId] = useState("");
  const [creditGLQuery, setCreditGLQuery] = useState("");
  const [creditGLOptions, setCreditGLOptions] = useState<GLOpt[]>([]);
  const [creditGL, setCreditGL] = useState<GLOpt | null>(null);

  const [form, setForm] = useState({
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
    description: "",
    referenceNo: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then((d) => setEntities(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!debitEntityId) { setDebitGLOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/gl-accounts/search?entityId=${debitEntityId}&q=${encodeURIComponent(debitGLQuery.trim())}&requireBudget=false`)
        .then((r) => r.json()).then((d) => { if (d.success) setDebitGLOptions(d.data); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [debitEntityId, debitGLQuery]);

  useEffect(() => {
    if (!creditEntityId) { setCreditGLOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/gl-accounts/search?entityId=${creditEntityId}&q=${encodeURIComponent(creditGLQuery.trim())}&requireBudget=false`)
        .then((r) => r.json()).then((d) => { if (d.success) setCreditGLOptions(d.data); }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [creditEntityId, creditGLQuery]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const isCrossEntity = debitEntityId && creditEntityId && debitEntityId !== creditEntityId;

  const submit = async (mode: "draft" | "submit") => {
    if (!debitEntityId || !debitGL || !creditEntityId || !creditGL) { setError("Select both a debit and a credit GL account."); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/finance/gl-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          referenceNo: form.referenceNo || undefined,
          transactionDate: form.transactionDate,
          submit: mode === "submit",
          lines: [
            { entityId: debitEntityId, glAccountCode: debitGL.code, entryType: "DEBIT", amount },
            { entityId: creditEntityId, glAccountCode: creditGL.code, entryType: "CREDIT", amount },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save journal entry");
      router.push(`/finance/gl-entries/${data.data.journalEntry.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/finance/gl-entries" className="hover:text-foreground">GL Entries</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Journal Entry</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">New GL Journal Entry</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Post a balanced Debit and Credit against GL accounts. Total debits must equal total credits.
        </p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      <GLLinePicker
        title="Debit"
        entities={entities} entityId={debitEntityId} setEntityId={setDebitEntityId}
        glQuery={debitGLQuery} setGlQuery={setDebitGLQuery} glOptions={debitGLOptions}
        selectedGL={debitGL} setSelectedGL={setDebitGL}
      />

      <div className="flex justify-center"><ArrowRight size={20} className="text-muted-foreground rotate-90" /></div>

      <GLLinePicker
        title="Credit"
        entities={entities} entityId={creditEntityId} setEntityId={setCreditEntityId}
        glQuery={creditGLQuery} setGlQuery={setCreditGLQuery} glOptions={creditGLOptions}
        selectedGL={creditGL} setSelectedGL={setCreditGL}
      />

      {isCrossEntity && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>This is a <strong>cross-entity</strong> posting — the debit and credit sides belong to different entities. Intercompany receivable/payable treatment is not yet enforced by the system; ensure this is an approved cross-entity transaction before submitting.</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-foreground">Entry Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount (₦)</label>
            <input type="number" min="0.01" step="0.01" className={inputCls} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Transaction Date</label>
            <input type="date" className={inputCls} value={form.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Description / Narration</label>
          <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Reclass of vehicle repair cost to correct GL account" />
        </div>
        <div>
          <label className={labelCls}>Reference Number <span className="normal-case font-normal">(optional)</span></label>
          <input className={inputCls} value={form.referenceNo} onChange={(e) => set("referenceNo", e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={saving || !debitGL || !creditGL || !form.amount || !form.description}
          onClick={() => submit("submit")}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit for Approval"}
        </button>
        <button
          disabled={saving || !debitGL || !creditGL || !form.amount || !form.description}
          onClick={() => submit("draft")}
          className="px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50"
        >
          Save as Draft
        </button>
      </div>
    </div>
  );
}
