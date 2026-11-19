"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "assetNo", label: "Asset No." },
  { key: "barcodeTag", label: "Barcode Tag" },
  { key: "serialNo", label: "Serial No." },
  { key: "name", label: "Asset Name" },
  { key: "description", label: "Description" },
  { key: "classification", label: "Classification" },
  { key: "legacyCategory", label: "Legacy Category" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "entity", label: "Entity" },
  { key: "branch", label: "Branch" },
  { key: "location", label: "Location" },
  { key: "isMovable", label: "Movable" },
  { key: "acquisitionValue", label: "Acquisition Value" },
  { key: "residualValue", label: "Residual Value" },
  { key: "currentBookValue", label: "Current Book Value" },
  { key: "purchaseDate", label: "Purchase Date" },
  { key: "usefulLifeYrs", label: "Useful Life (Yrs)" },
  { key: "depreciationMethod", label: "Depreciation Method" },
  { key: "lastDepreciationDate", label: "Last Depreciation Date" },
  { key: "condition", label: "Condition" },
  { key: "status", label: "Status" },
  { key: "approvalStatus", label: "Approval Status" },
  { key: "supplier", label: "Supplier" },
  { key: "invoiceRef", label: "Invoice Ref." },
  { key: "warrantyExpiry", label: "Warranty Expiry" },
  { key: "insuranceExpiry", label: "Insurance Expiry" },
  { key: "glAccountCode", label: "GL Account" },
  { key: "budgetRef", label: "Linked CAPEX Budget ID" },
  { key: "tags", label: "Tags" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "createdBy", label: "Registered By" },
  { key: "createdAt", label: "Registered On" },
  { key: "updatedAt", label: "Last Updated" },
];

const DEFAULT_SELECTED = new Set([
  "assetNo", "name", "classification", "entity", "branch",
  "acquisitionValue", "currentBookValue", "condition", "status", "approvalStatus",
]);

interface Props {
  open: boolean;
  onClose: () => void;
  filters: { q?: string; status?: string; approval?: string; entity?: string; branch?: string };
}

export default function AssetExportModal({ open, onClose, filters }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = () => {
    if (selected.size === 0) return;
    setExporting(true);
    const params = new URLSearchParams();
    selected.forEach((c) => params.append("columns", c));
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.approval) params.set("approval", filters.approval);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.branch) params.set("branch", filters.branch);

    window.location.href = `/api/assets/export?${params.toString()}`;
    setTimeout(() => {
      setExporting(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground">Export Asset Register</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Choose which fields to include in the Excel file.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
          <button
            onClick={() => setSelected(new Set(ALL_COLUMNS.map((c) => c.key)))}
            className="text-xs font-bold text-[#1B2A8A] dark:text-blue-400 hover:underline"
          >
            Select All
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-bold text-muted-foreground hover:underline"
          >
            Select None
          </button>
          <span className="ml-auto text-xs text-muted-foreground">{selected.size} of {ALL_COLUMNS.length} selected</span>
        </div>

        <div className="px-6 py-4 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-2.5 flex-1">
          {ALL_COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(c.key)}
                onChange={() => toggle(c.key)}
                className="rounded border-border accent-[#FFB800]"
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="px-5 py-2 rounded-xl text-sm font-bold text-[#1B2A8A] disabled:opacity-60 flex items-center gap-2"
            style={{ background: "#FFB800" }}
          >
            <Download size={15} />
            {exporting ? "Preparing…" : "Export to Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}
