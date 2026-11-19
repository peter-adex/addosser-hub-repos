"use client";

import { useState, useCallback } from "react";
import { Trash2, Plus }          from "lucide-react";

export interface LineItem {
  id:          string;
  description: string;
  quantity:    number;
  unitCost:    number;
  totalCost:   number;
}

export interface InvoiceTotals {
  subtotal:     number;
  vatAmount:    number;
  whtAmount:    number;
  totalAmount:  number;
  amountPayable:number;
  vatRate:      number;
  whtRate:      number;
}

interface Props {
  initialItems?: LineItem[];
  vatRate?:      number;
  whtRate?:      number;
  onChange?:     (items: LineItem[], totals: InvoiceTotals) => void;
  readOnly?:     boolean;
}

let _uid = 0;
const uid = () => `li_${Date.now()}_${_uid++}`;

const fmt = (n: number) =>
  "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function computeTotals(items: LineItem[], vatRate: number, whtRate: number): InvoiceTotals {
  const subtotal     = items.reduce((s, i) => s + i.totalCost, 0);
  const vatAmount    = subtotal * vatRate;
  const totalAmount  = subtotal + vatAmount;
  const whtAmount    = subtotal * whtRate;
  const amountPayable = totalAmount - whtAmount;
  return { subtotal, vatAmount, whtAmount, totalAmount, amountPayable, vatRate, whtRate };
}

export default function LineItemsEditor({
  initialItems = [{ id: uid(), description: "", quantity: 1, unitCost: 0, totalCost: 0 }],
  vatRate      = 0.075,
  whtRate      = 0.02,
  onChange,
  readOnly     = false,
}: Props) {
  const [items, setItems] = useState<LineItem[]>(initialItems);

  const notify = useCallback((updated: LineItem[]) => {
    if (onChange) onChange(updated, computeTotals(updated, vatRate, whtRate));
  }, [onChange, vatRate, whtRate]);

  const addLine = () => {
    const updated = [...items, { id: uid(), description: "", quantity: 1, unitCost: 0, totalCost: 0 }];
    setItems(updated);
    notify(updated);
  };

  const removeLine = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated.length ? updated : [{ id: uid(), description: "", quantity: 1, unitCost: 0, totalCost: 0 }]);
    notify(updated);
  };

  const updateLine = (id: string, field: keyof LineItem, raw: string) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      const numVal = parseFloat(raw) || 0;
      const patch: Partial<LineItem> = { [field]: field === "description" ? raw : numVal };

      const qty      = field === "quantity"  ? numVal : item.quantity;
      const unitCost = field === "unitCost"  ? numVal : item.unitCost;
      patch.totalCost = qty * unitCost;
      return { ...item, ...patch };
    });
    setItems(updated);
    notify(updated);
  };

  const totals = computeTotals(items, vatRate, whtRate);

  const cellInput = (
    type: "text" | "number",
    value: string | number,
    onChange: (v: string) => void,
    placeholder?: string,
    className?: string
  ) =>
    readOnly ? (
      <span className={className}>{value}</span>
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className={`bg-transparent border-none outline-none text-sm text-foreground w-full ${className ?? ""}`}
      />
    );

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "hsl(var(--card))" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-bold text-foreground text-sm">
          Line Items <span className="text-red-500 ml-0.5">*</span>
        </h3>
        {!readOnly && (
          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:bg-accent"
            style={{ color: "#FFB800" }}
          >
            <Plus size={13} /> Add Item
          </button>
        )}
      </div>

      <div className="grid px-5 py-2 bg-muted/40 border-b border-border"
        style={{ gridTemplateColumns: "1fr 80px 150px 120px 36px" }}>
        {["DESCRIPTION", "QTY", "UNIT COST (₦)", "TOTAL", ""].map((h) => (
          <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id}
            className="grid items-center gap-2 px-5 py-3 hover:bg-accent/20 transition-colors"
            style={{ gridTemplateColumns: "1fr 80px 150px 120px 36px" }}>

            <div className="border border-border rounded-xl px-3 py-2 bg-background">
              {cellInput("text", item.description, (v) => updateLine(item.id, "description", v), "Labour, part name…")}
            </div>

            <div className="border border-border rounded-xl px-3 py-2 bg-background text-center">
              {cellInput("number", item.quantity, (v) => updateLine(item.id, "quantity", v), "1", "text-center")}
            </div>

            <div className="border border-border rounded-xl px-3 py-2 bg-background">
              {cellInput("number", item.unitCost || "", (v) => updateLine(item.id, "unitCost", v), "0")}
            </div>

            <div className="text-sm font-semibold text-foreground px-1">
              {fmt(item.totalCost)}
            </div>

            <div className="flex justify-center">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeLine(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-4 space-y-2.5">
        <div className="flex justify-between text-sm text-foreground">
          <span className="font-medium">Subtotal (Line Items)</span>
          <span className="font-semibold">{fmt(totals.subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>VAT @ {(vatRate * 100).toFixed(1)}% of Subtotal</span>
          <span>{fmt(totals.vatAmount)}</span>
        </div>

        <div className="flex justify-between text-sm font-semibold text-foreground pt-1 border-t border-border">
          <span>Total + VAT</span>
          <span>{fmt(totals.totalAmount)}</span>
        </div>

        <div className="flex justify-between text-sm pt-0.5">
          <div>
            <span className="font-semibold" style={{ color: "#dc2626" }}>
              WHT — Withholding Tax @ {(whtRate * 100).toFixed(0)}% of Subtotal
            </span>
            <div className="text-xs text-muted-foreground mt-0.5">Deducted from vendor payment</div>
          </div>
          <span className="font-semibold" style={{ color: "#dc2626" }}>{fmt(totals.whtAmount)}</span>
        </div>

        <div className="flex justify-between items-start pt-3 border-t border-border">
          <div>
            <span className="font-extrabold text-base" style={{ color: "#FFB800" }}>
              Amount Payable to Vendor
            </span>
            <div className="text-xs text-muted-foreground mt-0.5">Subtotal − WHT</div>
          </div>
          <span className="font-extrabold text-lg" style={{ color: "#FFB800" }}>
            {fmt(totals.amountPayable)}
          </span>
        </div>
      </div>
    </div>
  );
}
