"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { MONTHS } from "@/lib/utils";

interface Props {
  entities: { id: string; name: string; code: string }[];
  isAdmin:  boolean;
}

const ALL_FIELDS = [
  { key: "entity",        label: "Entity" },
  { key: "glCode",        label: "GL Code" },
  { key: "glName",        label: "GL Account Name" },
  { key: "category",      label: "Category" },
  { key: "budgetType",    label: "Budget Type (OPEX/CAPEX)" },
  { key: "annualBudget",  label: "Annual Budget (₦)" },
  { key: "monthlyBudget", label: "Period Budget (₦)" },
  { key: "actualSpend",   label: "Actual Spend (₦)" },
  { key: "balance",       label: "Balance (₦)" },
  { key: "utilisation",   label: "Utilisation (%)" },
  { key: "status",        label: "Approval Status" },
  { key: "financialYear", label: "Financial Year" },
] as const;

type FieldKey = typeof ALL_FIELDS[number]["key"];

export default function BudgetExport({ entities, isAdmin }: Props) {
  const [open, setOpen]                     = useState(false);
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(["entity", "glCode", "glName", "monthlyBudget", "actualSpend", "balance", "utilisation"]);
  const [year, setYear]                     = useState(new Date().getFullYear());
  const [fromMonth, setFromMonth]           = useState(1);
  const [toMonth, setToMonth]               = useState(new Date().getMonth() + 1);
  const [budgetType, setBudgetType]         = useState<"ALL" | "OPEX" | "CAPEX">("ALL");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [exporting, setExporting]           = useState(false);
  const [exportError, setExportError]       = useState("");

  const toggleField = (key: FieldKey) =>
    setSelectedFields((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const toggleEntity = (id: string) =>
    setSelectedEntities((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleExport = async () => {
    if (selectedFields.length === 0) { setExportError("Please select at least one field"); return; }
    if (fromMonth > toMonth) { setExportError("'From' month must be before 'To' month"); return; }

    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/budgets/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          financialYear: year,
          fromMonth,
          toMonth,
          budgetType,
          entityIds:  isAdmin && selectedEntities.length > 0 ? selectedEntities : undefined,
          fields:     selectedFields,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")?.split('filename="')[1]?.replace('"', '') ?? "budget_export.csv";
      const link     = document.createElement("a");
      link.href      = url;
      link.download  = filename;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent transition-all"
      >
        <Download size={14} /> Export Report
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-foreground text-lg">Export Budget Report</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Select fields, date range and filters</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-6">
              {exportError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 text-sm">{exportError}</div>
              )}

              <div>
                <h3 className="font-bold text-sm text-foreground mb-3">📅 Date Range</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Financial Year</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                      value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                      {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">From Month</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                      value={fromMonth} onChange={(e) => setFromMonth(parseInt(e.target.value))}>
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">To Month</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                      value={toMonth} onChange={(e) => setToMonth(parseInt(e.target.value))}>
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground mb-3">💼 Budget Type</h3>
                <div className="flex gap-3">
                  {(["ALL", "OPEX", "CAPEX"] as const).map((t) => (
                    <button key={t} onClick={() => setBudgetType(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${budgetType === t ? "bg-[#1B2A8A] text-white border-transparent" : "border-border text-muted-foreground hover:border-[#1B2A8A]/40"}`}>
                      {t === "ALL" ? "All Types" : t}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && entities.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-3">🏦 Entities <span className="font-normal text-muted-foreground text-xs">(leave unchecked for all)</span></h3>
                  <div className="grid grid-cols-2 gap-2">
                    {entities.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-accent transition-colors">
                        <input type="checkbox" checked={selectedEntities.includes(e.id)} onChange={() => toggleEntity(e.id)} className="w-4 h-4 accent-[#FFB800]" />
                        <div>
                          <div className="text-sm font-semibold text-foreground">{e.name}</div>
                          <div className="text-xs text-muted-foreground">{e.code}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-bold text-sm text-foreground mb-1">📋 Fields to Include in CSV</h3>
                <p className="text-xs text-muted-foreground mb-3">Click to toggle. Columns will appear in the order shown.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_FIELDS.map((f) => (
                    <button key={f.key} onClick={() => toggleField(f.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left border transition-all ${selectedFields.includes(f.key) ? "bg-[#1B2A8A]/10 border-[#1B2A8A] text-[#1B2A8A] dark:text-blue-300 font-semibold" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
                      <span className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 text-xs ${selectedFields.includes(f.key) ? "bg-[#1B2A8A] border-[#1B2A8A] text-white" : "border-border"}`}>
                        {selectedFields.includes(f.key) ? "✓" : ""}
                      </span>
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{selectedFields.length} of {ALL_FIELDS.length} fields selected</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">File will be downloaded as .CSV</p>
              <div className="flex gap-3">
                <button onClick={() => setOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                <button onClick={handleExport} disabled={exporting || selectedFields.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition-all"
                  style={{ background: "#FFB800", color: "#1B2A8A" }}>
                  <Download size={14} />
                  {exporting ? "Generating..." : "Download CSV"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
