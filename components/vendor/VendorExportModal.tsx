"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";

const ALL_COLUMNS: { key: string; label: string }[] = [
  { key: "code", label: "Vendor Code" },
  { key: "name", label: "Vendor Name" },
  { key: "entity", label: "Entity" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "website", label: "Website" },
  { key: "taxId", label: "Tax ID (VAT/TIN)" },
  { key: "rcNumber", label: "RC Number" },
  { key: "contactPerson", label: "Contact Person" },
  { key: "contactEmail", label: "Contact Email" },
  { key: "contactPhone", label: "Contact Phone" },
  { key: "bankName", label: "Bank Name" },
  { key: "bankAccountNo", label: "Bank Account No." },
  { key: "bankAccountName", label: "Bank Account Name" },
  { key: "bankSortCode", label: "Bank Sort Code" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "isActive", label: "Status" },
  { key: "isApproved", label: "Admin-Approved" },
  { key: "notes", label: "Notes" },
  { key: "createdBy", label: "Added By" },
  { key: "createdAt", label: "Added On" },
];

const DEFAULT_SELECTED = new Set([
  "code", "name", "entity", "email", "phone", "contactPerson",
  "bankName", "bankAccountNo", "isActive",
]);

interface Props {
  open: boolean;
  onClose: () => void;
  filters: { search?: string; status?: string; entityId?: string };
}

export default function VendorExportModal({ open, onClose, filters }: Props) {
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
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.entityId) params.set("entityId", filters.entityId);

    window.location.href = `/api/vendors/export?${params.toString()}`;
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
            <h2 className="font-bold text-foreground">Export Vendor List</h2>
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
