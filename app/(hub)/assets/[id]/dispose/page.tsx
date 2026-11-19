"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const DISPOSAL_TYPES = [
  { value: "SALE",       label: "Sale",        desc: "Asset sold to a third party" },
  { value: "SCRAP",      label: "Scrap",       desc: "Scrapped — no recoverable value" },
  { value: "DONATION",   label: "Donation",    desc: "Donated to charity/institution" },
  { value: "WRITE_OFF",  label: "Write-Off",   desc: "Written down to zero book value" },
  { value: "THEFT_LOSS", label: "Theft/Loss",  desc: "Stolen or otherwise lost" },
] as const;

export default function DisposePage() {
  const router   = useRouter();
  const { id }   = useParams<{ id: string }>();
  const [asset,  setAsset]   = useState<any>(null);
  const [loading,setLoading] = useState(true);
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState("");

  const [form, setForm] = useState({
    disposalType: "SALE",
    disposalDate: new Date().toISOString().split("T")[0],
    salePrice:    "",
    recipient:    "",
    reason:       "",
  });

  useEffect(() => {
    fetch(`/api/assets/${id}`)
      .then((r) => r.json())
      .then((d) => { setAsset(d.data); setLoading(false); })
      .catch(() => { setError("Failed to load asset"); setLoading(false); });
  }, [id]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const nbv = asset?.currentBookValue ?? asset?.currentValue ?? 0;
  const salePrice = parseFloat(form.salePrice) || 0;
  const gainLoss  = form.disposalType === "SALE" ? salePrice - Number(nbv) : -Number(nbv);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await fetch(`/api/assets/${id}/dispose`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
          submit: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to record disposal");
      if (data.message && !/^Disposal recorded/i.test(data.message)) {
        alert(data.message);
      }
      router.push(`/assets/${id}`); router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
  const fmtN = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets" className="hover:text-foreground">Assets</Link>
        <span>/</span>
        <Link href={`/assets/${id}`} className="hover:text-foreground">{asset?.name}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Dispose</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Record Asset Disposal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {asset?.name} ({asset?.assetNo}) — Current Book Value: <strong className="text-foreground">{fmtN(Number(nbv))}</strong>
        </p>
      </div>

      {form.disposalType === "SALE" && salePrice > 0 && (
        <div className={`p-4 rounded-xl border text-sm font-medium ${gainLoss >= 0 ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"}`}>
          {gainLoss >= 0 ? "📈 Gain on Disposal:" : "📉 Loss on Disposal:"} <strong>{fmtN(Math.abs(gainLoss))}</strong>
          <span className="ml-2 opacity-70">(Sale {fmtN(salePrice)} − NBV {fmtN(Number(nbv))})</span>
        </div>
      )}

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-foreground">Disposal Details</h2>

          <div>
            <label className={labelCls}>Disposal Type</label>
            <div className="space-y-2 mt-1">
              {DISPOSAL_TYPES.map((t) => (
                <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.disposalType === t.value ? "border-[#FFB800] bg-[#FFB800]/10" : "border-border hover:bg-accent"}`}>
                  <input type="radio" name="disposalType" value={t.value} checked={form.disposalType === t.value}
                    onChange={() => set("disposalType", t.value)} className="accent-[#FFB800] mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Disposal Date</label>
            <input type="date" className={inputCls} value={form.disposalDate} onChange={(e) => set("disposalDate", e.target.value)} required />
          </div>

          {form.disposalType === "SALE" && (
            <div>
              <label className={labelCls}>Sale Price (₦)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="0.00" required />
            </div>
          )}

          {(form.disposalType === "SALE" || form.disposalType === "DONATION") && (
            <div>
              <label className={labelCls}>{form.disposalType === "SALE" ? "Buyer Name" : "Recipient Organisation"}</label>
              <input type="text" className={inputCls} value={form.recipient} onChange={(e) => set("recipient", e.target.value)} placeholder="Name of buyer / recipient" />
            </div>
          )}

          <div>
            <label className={labelCls}>Reason / Notes</label>
            <textarea className={inputCls} rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Explain why this asset is being disposed of…" required />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving}
            className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 bg-red-600 text-white hover:bg-red-700">
            {saving ? "Processing…" : "Confirm Disposal"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-8 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent">Cancel</button>
        </div>
      </form>
    </div>
  );
}
