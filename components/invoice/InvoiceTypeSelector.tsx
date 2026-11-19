"use client";

import { CheckCircle2 } from "lucide-react";

export type InvoiceType = "GENERAL" | "ASSET_LINKED" | "ASSET_PURCHASE";

interface TypeOption {
  id:    InvoiceType;
  icon:  string;
  title: string;
  sub:   string;
  color: string;
  bg:    string;
}

const OPTIONS: TypeOption[] = [
  {
    id:    "GENERAL",
    icon:  "🧾",
    title: "General Expense",
    sub:   "Operational invoice with no asset attachment — utilities, consultancy, supplies, etc.",
    color: "#0284c7",
    bg:    "#e0f2fe",
  },
  {
    id:    "ASSET_LINKED",
    icon:  "🔧",
    title: "Asset-Related (Maintenance / Repair)",
    sub:   "Invoice linked to an existing asset — vehicle repair, IT service, equipment calibration.",
    color: "#d97706",
    bg:    "#fef9c3",
  },
  {
    id:    "ASSET_PURCHASE",
    icon:  "🏗️",
    title: "Asset Purchase (Capital Expenditure)",
    sub:   "Purchasing a new asset — creates an asset record from this invoice (CAPEX).",
    color: "#7c3aed",
    bg:    "#ede9fe",
  },
];

interface Props {
  value:    InvoiceType | null;
  onChange: (type: InvoiceType) => void;
}

export default function InvoiceTypeSelector({ value, onChange }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-bold text-foreground">Invoice Type <span className="text-red-500">*</span></h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select the type of invoice you are submitting. This determines which fields are required.
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className="text-left p-4 rounded-xl border-2 transition-all duration-150 relative"
              style={{
                borderColor: selected ? opt.color : "hsl(var(--border))",
                background:  selected ? opt.bg    : "transparent",
              }}
            >
              {selected && (
                <CheckCircle2
                  size={16}
                  className="absolute top-3 right-3"
                  style={{ color: opt.color }}
                />
              )}

              <div className="text-2xl mb-2">{opt.icon}</div>
              <div
                className="font-bold text-sm mb-1"
                style={{ color: selected ? opt.color : "hsl(var(--foreground))" }}
              >
                {opt.title}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{opt.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
