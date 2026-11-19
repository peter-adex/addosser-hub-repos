"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UploadCloud, Download, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

interface EntityOpt { id: string; name: string; code: string; isActive: boolean; }
interface ImportRow { id: string; rowNumber: number; rawData: string; status: string; errors: string | null; }
interface ImportBatch { id: string; fileName: string; totalRows: number; validRows: number; invalidRows: number; rows: ImportRow[]; }

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

export default function BudgetImportPage() {
  const [entities, setEntities] = useState<EntityOpt[]>([]);
  const [entityId, setEntityId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [result, setResult] = useState<{ total: number; valid: number; invalid: number; imported: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then((d) => setEntities(d.data ?? []));
  }, []);

  const upload = async () => {
    if (!file || !entityId) { setError("Select entity and a file."); return; }
    setError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityId", entityId);
      const res = await fetch("/api/budgets/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setBatch(data.data);
    } catch (err: any) { setError(err.message); } finally { setUploading(false); }
  };

  const confirm = async () => {
    if (!batch) return;
    setConfirming(true); setError("");
    try {
      const res = await fetch(`/api/budgets/import/${batch.id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data.data);
    } catch (err: any) { setError(err.message); } finally { setConfirming(false); }
  };

  const reset = () => { setBatch(null); setResult(null); setFile(null); };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/budgeting" className="hover:text-foreground">Budgeting</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Import Existing Budgets</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Import Existing Budgets</h1>
          <p className="text-muted-foreground text-sm mt-1">Bulk-import existing entity budgets via Excel/CSV.</p>
        </div>
        <a href="/api/budgets/import/template" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent">
          <Download size={16} /> Download Template
        </a>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      {result ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
          <h2 className="text-xl font-bold text-foreground">Import Complete</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-2xl mx-auto text-left">
            {[["Total records", result.total], ["Valid records", result.valid], ["Invalid records", result.invalid], ["Imported", result.imported], ["Skipped", result.skipped]].map(([label, val]) => (
              <div key={label as string} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="text-xl font-extrabold text-foreground">{val}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {batch && result.skipped + result.invalid > 0 && (
              <a href={`/api/budgets/import/${batch.id}/rejected`} className="text-sm font-semibold text-[#1B2A8A] hover:underline">Download rejected rows</a>
            )}
            <button onClick={reset} className="px-4 py-2 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90">Import Another File</button>
          </div>
        </div>
      ) : batch ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[["Total records", batch.totalRows], ["Valid records", batch.validRows], ["Invalid records", batch.invalidRows], ["File", batch.fileName]].map(([label, val]) => (
              <div key={label as string} className="p-4 rounded-xl bg-card border border-border">
                <div className="text-lg font-extrabold text-foreground truncate">{val}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <span className="font-bold text-foreground">Preview & Validation Errors</span>
              <span className="text-xs text-muted-foreground">{batch.rows.length} rows</span>
            </div>
            <div className="overflow-auto max-h-[32rem]">
              <table className="w-full border-collapse text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                  <tr>
                    {["Row", "GL Code", "GL Name", "Entity", "Year", "Annual", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Status", "Errors"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((r) => {
                    const raw = JSON.parse(r.rawData);
                    const errs = r.errors ? JSON.parse(r.errors) as { field: string; error: string }[] : [];
                    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                    return (
                      <tr key={r.id} className={`border-t border-border ${r.status !== "VALID" ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                        <td className="px-3 py-2 text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2 font-mono font-semibold">{raw["GL Code"]}</td>
                        <td className="px-3 py-2">{raw["GL Name"]}</td>
                        <td className="px-3 py-2">{raw["Entity"]}</td>
                        <td className="px-3 py-2">{raw["Budget Year"]}</td>
                        <td className="px-3 py-2 font-semibold">{Number(raw["Annual Amount"] ?? 0).toLocaleString()}</td>
                        {months.map((m) => (
                          <td key={m} className="px-3 py-2 text-muted-foreground">{Number(raw[m] ?? 0).toLocaleString()}</td>
                        ))}
                        <td className="px-3 py-2"><Badge variant={r.status === "VALID" ? "green" : "red"}>{r.status}</Badge></td>
                        <td className="px-3 py-2 text-red-600 dark:text-red-400">{errs.map((e, i) => <div key={i}>{e.field}: {e.error}</div>)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={confirm} disabled={confirming || batch.validRows === 0} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90 disabled:opacity-50">
              {confirming ? "Importing…" : `Confirm Import (${batch.validRows} valid records)`}
            </button>
            <button onClick={reset} className="px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className={labelCls}>Entity</label>
            <select className={inputCls} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">— Select entity —</option>
              {entities.filter((e) => e.isActive).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>File</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:bg-accent/30">
              <UploadCloud size={28} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {file ? <><FileSpreadsheet size={14} className="inline mr-1" />{file.name}</> : "Click to browse or drag & drop"}
              </span>
              <span className="text-xs text-muted-foreground">CSV or Excel (.xlsx, .xls) · Max 10MB</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <button onClick={upload} disabled={uploading || !file || !entityId} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90 disabled:opacity-50">
            {uploading ? "Parsing & Validating…" : "Upload & Validate"}
          </button>
        </div>
      )}
    </div>
  );
}
