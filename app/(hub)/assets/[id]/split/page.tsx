"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import UserPicker from "@/components/shared/UserPicker";
import MultiFileUpload, { UploadedAttachment } from "@/components/shared/MultiFileUpload";

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

interface ChildRow {
  serialNo: string;
  barcodeTag: string;
  assignedToId: string;
  location: string;
}

function emptyRow(): ChildRow {
  return { serialNo: "", barcodeTag: "", assignedToId: "", location: "" };
}

function fmtNaira(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AssetSplitPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ineligibleReason, setIneligibleReason] = useState("");

  const [quantitySplit, setQuantitySplit] = useState(1);
  const [rows, setRows] = useState<ChildRow[]>([emptyRow()]);
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/assets/${id}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load asset"); setLoading(false); return; }
      setAsset(data.data);
      if (data.data.quantity <= 1) setIneligibleReason("This asset represents a single unit (quantity 1) and cannot be split.");
      else if (data.data.status !== "ACTIVE") setIneligibleReason(`Asset must be ACTIVE to be split (current status: ${data.data.status}).`);
      else if (data.data.approvalStatus !== "APPROVED") setIneligibleReason("Asset must be fully approved before it can be split.");
      setLoading(false);
    })();
  }, [id]);

  function regenerateRows(qty: number) {
    setQuantitySplit(qty);
    setRows((prev) => {
      const next = [...prev];
      while (next.length < qty) next.push(emptyRow());
      return next.slice(0, qty);
    });
  }

  function updateRow(i: number, patch: Partial<ChildRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} /> Loading…</div>;
  if (!asset) return <div className="p-8 text-center text-red-600">{error || "Asset not found"}</div>;

  const unitCost = Number(asset.unitCost ?? asset.acquisitionValue ?? 0);
  const bookValueBefore = Number(asset.currentBookValue ?? asset.acquisitionValue ?? 0);
  const totalCostBefore = Number(asset.acquisitionValue ?? 0);
  const perUnitBookValue = asset.quantity ? bookValueBefore / asset.quantity : 0;
  const quantityAfter = asset.quantity - quantitySplit;

  const serials = rows.map((r) => r.serialNo.trim()).filter(Boolean);
  const tags = rows.map((r) => r.barcodeTag.trim()).filter(Boolean);
  const hasDuplicateSerials = new Set(serials).size !== serials.length;
  const hasDuplicateTags = new Set(tags).size !== tags.length;

  const canSubmit =
    !ineligibleReason &&
    quantitySplit >= 1 &&
    quantitySplit <= asset.quantity &&
    reason.trim().length > 0 &&
    !hasDuplicateSerials &&
    !hasDuplicateTags;

  const submit = async (mode: "draft" | "submit") => {
    setError(""); setSaving(true);
    try {
      const res = await fetch(`/api/assets/${id}/split-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantitySplit,
          reason,
          effectiveDate,
          children: rows.map((r) => ({
            serialNo: r.serialNo.trim() || undefined,
            barcodeTag: r.barcodeTag.trim() || undefined,
            assignedToId: r.assignedToId || undefined,
            location: r.location.trim() || undefined,
          })),
          attachmentUrl: attachments[0]?.url,
          submit: mode === "submit",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save split request");
      router.push(`/assets/splits/${data.data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/assets/${id}`} className="hover:text-foreground">{asset.assetNo}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Split Asset</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Split Asset</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Divide this bulk asset into individually managed units, subject to approval.
        </p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      {ineligibleReason ? (
        <div className="p-6 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400 text-sm font-semibold">
          {ineligibleReason}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-bold text-foreground mb-4">Original Asset</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className={labelCls}>Asset Code</div><div className="font-semibold text-foreground">{asset.assetNo}</div></div>
              <div><div className={labelCls}>Description</div><div className="font-semibold text-foreground">{asset.name}</div></div>
              <div><div className={labelCls}>Quantity</div><div className="font-semibold text-foreground">{asset.quantity}</div></div>
              <div><div className={labelCls}>Unit Cost</div><div className="font-semibold text-foreground">{fmtNaira(unitCost)}</div></div>
              <div><div className={labelCls}>Total Acquisition Cost</div><div className="font-semibold text-foreground">{fmtNaira(totalCostBefore)}</div></div>
              <div><div className={labelCls}>Current Net Book Value</div><div className="font-semibold text-foreground">{fmtNaira(bookValueBefore)}</div></div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-foreground">Split Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Quantity to Split</label>
                <input
                  type="number" min={1} max={asset.quantity} className={inputCls}
                  value={quantitySplit}
                  onChange={(e) => regenerateRows(Math.max(1, Math.min(asset.quantity, Number(e.target.value) || 1)))}
                />
                <p className="text-xs text-muted-foreground mt-1">Up to {asset.quantity} available. {quantitySplit < asset.quantity ? `${quantityAfter} will remain on the original bulk asset.` : "This will fully consume the original asset."}</p>
              </div>
              <div>
                <label className={labelCls}>Effective Date</label>
                <input type="date" className={inputCls} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Reason for Split</label>
              <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this asset being split into individual units?" required />
            </div>
            <div>
              <label className={labelCls}>Supporting Document <span className="normal-case font-normal">(optional)</span></label>
              <MultiFileUpload folder="assets/movements" value={attachments} onChange={setAttachments} maxFiles={1} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-foreground">New Assets ({quantitySplit})</h2>
            {(hasDuplicateSerials || hasDuplicateTags) && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                {hasDuplicateSerials && "Duplicate serial numbers entered. "}
                {hasDuplicateTags && "Duplicate asset tags entered."}
              </p>
            )}
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-muted/30">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    {asset.assetNo}-{String(i + 1).padStart(2, "0")} <span className="font-normal normal-case">(code assigned automatically)</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Serial Number <span className="normal-case font-normal">(optional)</span></label>
                      <input className={inputCls} value={row.serialNo} onChange={(e) => updateRow(i, { serialNo: e.target.value })} placeholder="e.g. SN001" />
                    </div>
                    <div>
                      <label className={labelCls}>Asset Tag / Barcode <span className="normal-case font-normal">(optional)</span></label>
                      <input className={inputCls} value={row.barcodeTag} onChange={(e) => updateRow(i, { barcodeTag: e.target.value })} placeholder="e.g. TAG001" />
                    </div>
                    <div>
                      <label className={labelCls}>Custodian <span className="normal-case font-normal">(optional)</span></label>
                      <UserPicker
                        value={row.assignedToId}
                        onChange={(userId) => updateRow(i, { assignedToId: userId })}
                        inputClassName={inputCls}
                        placeholder="Search for a user…"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Location <span className="normal-case font-normal">(optional — defaults to current)</span></label>
                      <input className={inputCls} value={row.location} onChange={(e) => updateRow(i, { location: e.target.value })} placeholder={asset.location || "e.g. Floor 2, Room 201"} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-bold text-foreground mb-4">Financial Preview</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">Asset Code</th>
                    <th className="pb-2 pr-4">Quantity</th>
                    <th className="pb-2 pr-4 text-right">Unit Cost</th>
                    <th className="pb-2 text-right">Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: quantitySplit }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium text-foreground">{asset.assetNo}-{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-2 pr-4 text-foreground">1</td>
                      <td className="py-2 pr-4 text-right text-foreground">{fmtNaira(unitCost)}</td>
                      <td className="py-2 text-right text-foreground">{fmtNaira(perUnitBookValue)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="py-2 pr-4 font-bold text-foreground">{asset.assetNo} (remaining)</td>
                    <td className="py-2 pr-4 font-bold text-foreground">{quantityAfter}</td>
                    <td className="py-2 pr-4 text-right font-bold text-foreground">{fmtNaira(unitCost)}</td>
                    <td className="py-2 text-right font-bold text-foreground">{fmtNaira(bookValueBefore - perUnitBookValue * quantitySplit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Total cost before and after split: <strong className="text-foreground">{fmtNaira(totalCostBefore)}</strong> — unchanged, as required.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || !canSubmit}
              onClick={() => submit("submit")}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
            <button
              type="button"
              disabled={saving || !canSubmit}
              onClick={() => submit("draft")}
              className="px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50"
            >
              Save as Draft
            </button>
          </div>
        </>
      )}
    </div>
  );
}
