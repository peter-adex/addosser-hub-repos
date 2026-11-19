"use client";

import { useState }         from "react";
import { useRouter, useParams } from "next/navigation";
import Link                 from "next/link";

const MAINTENANCE_TYPES = ["PREVENTIVE","CORRECTIVE","INSPECTION","CALIBRATION","UPGRADE"] as const;

export default function MaintenanceLogPage() {
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();

  const [form, setForm] = useState({
    type:         "PREVENTIVE",
    description:  "",
    cost:         "",
    glAccountCode:"",
    vendor:       "",
    performedAt:  new Date().toISOString().split("T")[0],
    nextDueAt:    "",
    status:       "Completed",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/assets/${id}/maintenance`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          cost:    form.cost ? parseFloat(form.cost) : undefined,
          nextDueAt: form.nextDueAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save maintenance log");
      router.push(`/assets/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets" className="hover:text-foreground">Assets</Link>
        <span>/</span>
        <Link href={`/assets/${id}`} className="hover:text-foreground">Asset</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Log Maintenance</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Log Maintenance</h1>
        <p className="text-muted-foreground text-sm mt-1">Record a maintenance event for this asset</p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">

          <div>
            <label className={labelCls}>Maintenance Type</label>
            <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)} required>
              {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={3} value={form.description}
              onChange={(e) => set("description", e.target.value)} placeholder="Describe what was done…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cost (₦)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.cost}
                onChange={(e) => set("cost", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>GL Account Code</label>
              <input type="text" className={inputCls} value={form.glAccountCode}
                onChange={(e) => set("glAccountCode", e.target.value)} placeholder="e.g. 5101" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Vendor / Technician</label>
            <input type="text" className={inputCls} value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)} placeholder="Who performed this?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date Performed</label>
              <input type="date" className={inputCls} value={form.performedAt}
                onChange={(e) => set("performedAt", e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Next Due Date <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
              <input type="date" className={inputCls} value={form.nextDueAt}
                onChange={(e) => set("nextDueAt", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={loading}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
            style={{ background: "#FFB800", color: "#1B2A8A" }}>
            {loading ? "Saving…" : "Save Maintenance Log"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-8 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
