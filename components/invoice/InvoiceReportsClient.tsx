"use client";

import { useState, useMemo } from "react";
import { useRouter }         from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Filter }  from "lucide-react";
import { formatCompact }     from "@/lib/utils";
import { Badge }             from "@/components/shared/Badge";

type InvoiceRow = {
  id: string; invoiceNo: string; invoiceType: string; entityName: string; entityCode: string;
  vendorName: string; glCode: string; description: string; subtotal: number; vatAmount: number;
  whtAmount: number; totalAmount: number; amountPayable: number; status: string;
  dueDate: string | null; createdAt: string; submitterName: string; isExceptional: boolean;
};

interface Props {
  invoices:     InvoiceRow[];
  entities:     { id: string; name: string; code: string }[];
  glAccounts:   { id: string; code: string; name: string }[];
  monthlyTrend: { month: string; count: number; amount: number }[];
  filters:      { from: string; to: string; entity: string; status: string; type: string };
}

const STATUS_OPTS = ["", "DRAFT","PENDING_APPROVAL","APPROVED","PAID","REJECTED","RECALLED"];
const TYPE_OPTS   = ["", "GENERAL_EXPENSE","ASSET_RELATED","ASSET_PURCHASE"];

const EXPORT_FIELDS = [
  { key: "invoiceNo",     label: "Invoice ID" },
  { key: "invoiceType",   label: "Invoice Type" },
  { key: "entityName",    label: "Entity" },
  { key: "vendorName",    label: "Vendor" },
  { key: "glCode",        label: "GL Account" },
  { key: "description",   label: "Description" },
  { key: "subtotal",      label: "Subtotal" },
  { key: "vatAmount",     label: "VAT Amount" },
  { key: "whtAmount",     label: "WHT Amount" },
  { key: "totalAmount",   label: "Total Amount" },
  { key: "amountPayable", label: "Amount Payable" },
  { key: "status",        label: "Status" },
  { key: "dueDate",       label: "Due Date" },
  { key: "createdAt",     label: "Created At" },
  { key: "submitterName", label: "Submitted By" },
  { key: "isExceptional", label: "Exceptional" },
];

export default function InvoiceReportsClient({ invoices, entities, glAccounts, monthlyTrend, filters }: Props) {
  const router = useRouter();

  const [localQ,      setLocalQ]      = useState("");
  const [showExport,  setShowExport]  = useState(false);
  const [selectedFlds,setSelectedFlds]= useState<string[]>(
    EXPORT_FIELDS.filter((f) => !["description","whtAmount"].includes(f.key)).map((f) => f.key)
  );
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  const filtered = useMemo(() => invoices.filter((inv) => {
    if (!localQ) return true;
    const q = localQ.toLowerCase();
    return inv.invoiceNo.toLowerCase().includes(q) ||
           inv.vendorName.toLowerCase().includes(q) ||
           inv.entityName.toLowerCase().includes(q) ||
           inv.glCode.toLowerCase().includes(q) ||
           inv.description.toLowerCase().includes(q);
  }), [invoices, localQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const downloadCSV = () => {
    const header = EXPORT_FIELDS.filter((f) => selectedFlds.includes(f.key)).map((f) => f.label).join(",");
    const rows   = filtered.map((row) =>
      EXPORT_FIELDS.filter((f) => selectedFlds.includes(f.key))
        .map((f) => {
          const val = (row as any)[f.key];
          if (typeof val === "number") return val.toFixed(2);
          if (typeof val === "boolean") return val ? "Yes" : "No";
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        }).join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `invoices-${filters.from}-to-${filters.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusVariant: Record<string, "green"|"yellow"|"red"|"gray"|"blue"> = {
    PAID: "green", APPROVED: "green", PENDING_APPROVAL: "yellow",
    REJECTED: "red", DRAFT: "gray", RECALLED: "blue",
  };

  const typeLabel: Record<string, string> = {
    GENERAL_EXPENSE: "General Expense",
    ASSET_RELATED:   "Asset-Related",
    ASSET_PURCHASE:  "Asset Purchase",
  };

  return (
    <div className="space-y-6">
      {monthlyTrend.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="font-bold text-foreground mb-4 text-sm">Monthly Invoice Volume & Amount</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left"  dataKey="count"  name="# Invoices"    fill="#1B2A8A" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="amount" name="Total Amount"   fill="#FFB800" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Search invoices…" value={localQ} onChange={(e) => { setLocalQ(e.target.value); setPage(1); }}
              className="w-64 px-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]" />
            <span className="text-xs text-muted-foreground">{filtered.length} records</span>
          </div>
          <button onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-accent">
            <Download size={14} /> Export CSV
          </button>
        </div>

        {showExport && (
          <div className="px-6 py-4 bg-muted/30 border-b border-border">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Select Fields to Export</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {EXPORT_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground">
                  <input type="checkbox" checked={selectedFlds.includes(f.key)} className="accent-[#FFB800]"
                    onChange={(e) => setSelectedFlds((prev) => e.target.checked ? [...prev, f.key] : prev.filter((k) => k !== f.key))} />
                  {f.label}
                </label>
              ))}
            </div>
            <button onClick={downloadCSV}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: "#FFB800", color: "#1B2A8A" }}>
              <Download size={14} /> Download {filtered.length} records
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                {["Invoice ID","Type","Entity","Vendor","GL","Amount","Payable","Status","Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No invoices match your filters.</td></tr>
              ) : paginated.map((inv) => (
                <tr key={inv.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => router.push(`/invoice/${inv.id}`)}>
                  <td className="px-4 py-3">
                    <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-2 py-0.5 rounded">{inv.invoiceNo}</code>
                    {inv.isExceptional && <span className="ml-1 text-[10px] text-amber-600 font-bold">⚠️EXC</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{typeLabel[inv.invoiceType] ?? inv.invoiceType}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{inv.entityCode}</td>
                  <td className="px-4 py-3 text-xs text-foreground truncate max-w-[120px]">{inv.vendorName}</td>
                  <td className="px-4 py-3"><code className="text-xs font-bold text-muted-foreground">{inv.glCode || "—"}</code></td>
                  <td className="px-4 py-3 font-semibold text-foreground text-xs">{formatCompact(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{formatCompact(inv.amountPayable)}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant[inv.status] ?? "gray"}>{inv.status.replace(/_/g," ")}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("en-NG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">Page {page} of {totalPages} · {filtered.length} records</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-accent">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-accent">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
