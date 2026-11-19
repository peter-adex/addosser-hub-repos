"use client";

import { useState, useCallback, useEffect } from "react";
import { Trash2, Plus }                      from "lucide-react";
import { genId }                             from "@/lib/utils";

export interface LineItem {
  id:          string;
  description: string;
  quantity:    number;
  unitCost:    number;
  totalCost:   number;
}

export interface InvoiceTotals {
  subtotal:       number;
  vatAmount:      number;
  totalPlusVat:   number;
  whtAmount:      number;
  amountPayable:  number;
}

interface Props {
  initialItems?: LineItem[];
  onChange:      (items: LineItem[], totals: InvoiceTotals) => void;
  vatRate?: number;
  whtRate?: number;
}

const DEFAULT_VAT_RATE = 0.075;
const DEFAULT_WHT_RATE = 0.020;

function newItem(): LineItem {
  return { id: genId(), description: "", quantity: 1, unitCost: 0, totalCost: 0 };
}

function computeTotals(items: LineItem[], vatRate: number, whtRate: number): InvoiceTotals {
  const subtotal      = items.reduce((s, i) => s + i.totalCost, 0);
  const vatAmount     = subtotal * vatRate;
  const totalPlusVat  = subtotal + vatAmount;
  const whtAmount     = subtotal * whtRate;
  const amountPayable = subtotal - whtAmount;
  return { subtotal, vatAmount, totalPlusVat, whtAmount, amountPayable };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(n);

export default function InvoiceLineItems({
  initialItems,
  onChange,
  vatRate = DEFAULT_VAT_RATE,
  whtRate = DEFAULT_WHT_RATE
}: Props) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems?.length ? initialItems : [newItem()]
  );

  const notify = useCallback((nextItems: LineItem[]) => {
    onChange(nextItems, computeTotals(nextItems, vatRate, whtRate));
  }, [onChange, vatRate, whtRate]);

  const update = useCallback((id: string, field: keyof LineItem, raw: string) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };

        if (field === "quantity") {
          updated.quantity  = Math.max(0, parseFloat(raw) || 0);
          updated.totalCost = updated.quantity * updated.unitCost;
        } else if (field === "unitCost") {
          updated.unitCost  = Math.max(0, parseFloat(raw) || 0);
          updated.totalCost = updated.quantity * updated.unitCost;
        } else if (field === "description") {
          updated.description = raw;
        }

        return updated;
      });
      notify(next);
      return next;
    });
  }, [notify]);

  const addItem = () => {
    setItems((prev) => { const next = [...prev, newItem()]; notify(next); return next; });
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.length > 1 ? prev.filter((i) => i.id !== id) : prev;
      notify(next);
      return next;
    });
  };

  useEffect(() => { notify(items); }, [vatRate, whtRate]);

  const totals = computeTotals(items, vatRate, whtRate);
  const noTax = vatRate === 0 && whtRate === 0;

  const inputCls = "bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground w-full";
  const cellCls  = "border border-border";

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-foreground">
          Line Items <span className="text-red-500">*</span>
        </span>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-sm font-bold hover:opacity-80 transition-opacity"
          style={{ color: "#FFB800" }}
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_140px_120px_36px] bg-muted/40 border-b border-border">
          {[
            { label: "DESCRIPTION",    cls: "px-3 py-2.5" },
            { label: "QTY",            cls: "px-2 py-2.5 text-center border-l border-border" },
            { label: "UNIT COST (₦)",  cls: "px-2 py-2.5 text-center border-l border-border" },
            { label: "TOTAL",          cls: "px-2 py-2.5 text-center border-l border-border" },
            { label: "",               cls: "border-l border-border" },
          ].map((h, i) => (
            <div key={i} className={`${h.cls} text-[10px] font-bold uppercase tracking-wider text-muted-foreground`}>
              {h.label}
            </div>
          ))}
        </div>

        {items.map((item, idx) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_80px_140px_120px_36px] border-b border-border last:border-0 hover:bg-accent/20 transition-colors"
          >
            <div className="px-3 py-2">
              <input
                type="text"
                className={inputCls}
                placeholder="Labour, part name…"
                value={item.description}
                onChange={(e) => update(item.id, "description", e.target.value)}
              />
            </div>

            <div className="px-2 py-2 border-l border-border">
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${inputCls} text-center`}
                value={item.quantity || ""}
                onChange={(e) => update(item.id, "quantity", e.target.value)}
              />
            </div>

            <div className="px-2 py-2 border-l border-border">
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${inputCls} text-right`}
                value={item.unitCost || ""}
                placeholder="0"
                onChange={(e) => update(item.id, "unitCost", e.target.value)}
              />
            </div>

            <div className="px-2 py-2 border-l border-border flex items-center justify-end">
              <span className="text-sm font-semibold text-foreground">
                {fmt(item.totalCost)}
              </span>
            </div>

            <div className="border-l border-border flex items-center justify-center">
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="p-1.5 rounded text-muted-foreground hover:text-red-500 disabled:opacity-30 transition-colors"
                title="Remove line"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        <div className="border-t border-border bg-muted/20">
          {[
            { label: "Subtotal (Line Items)",                  value: totals.subtotal,      cls: "text-foreground",              bold: false },
            { label: noTax ? "VAT (not applicable — fuel)" : "VAT @ 7.5% of Subtotal", value: totals.vatAmount, cls: "text-muted-foreground", bold: false },
            { label: "Total + VAT",                           value: totals.totalPlusVat,  cls: "text-foreground",              bold: false },
          ].map(({ label, value, cls, bold }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
              <span className={`text-sm ${cls}`}>{label}</span>
              <span className={`text-sm ${cls} ${bold ? "font-bold" : ""}`}>{fmt(value)}</span>
            </div>
          ))}

          <div className="flex items-start justify-between px-4 py-2.5 border-b border-border/50">
            <div>
              <div className={`text-sm font-semibold ${noTax ? "text-muted-foreground" : "text-red-500"}`}>
                {noTax ? "WHT (not applicable — fuel)" : "WHT — Withholding Tax @ 2% of Subtotal"}
              </div>
              {!noTax && <div className="text-xs text-muted-foreground">Deducted from vendor payment</div>}
            </div>
            <span className={`text-sm font-semibold ${noTax ? "text-muted-foreground" : "text-red-500"}`}>
              {noTax ? fmt(0) : `\u2212${fmt(totals.whtAmount)}`}
            </span>
          </div>

          <div className="flex items-start justify-between px-4 py-3">
            <div>
              <div className="text-base font-extrabold" style={{ color: "#FFB800" }}>
                Amount Payable to Vendor
              </div>
              <div className="text-xs text-muted-foreground">Subtotal − WHT</div>
            </div>
            <span className="text-base font-extrabold" style={{ color: "#FFB800" }}>
              {fmt(totals.amountPayable)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
