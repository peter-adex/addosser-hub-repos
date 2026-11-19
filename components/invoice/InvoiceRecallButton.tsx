"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

interface Props { invoiceId: string; }

export default function InvoiceRecallButton({ invoiceId }: Props) {
  const router = useRouter();
  const [open,   setOpen]   = useState(false);
  const [reason, setReason] = useState("");
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState("");

  const handleRecall = async () => {
    if (!reason.trim()) { setError("Please provide a reason for recalling."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/invoices/${invoiceId}/recall`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recall failed");
      router.refresh();
      setOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400 transition-colors"
      >
        <RotateCcw size={14} /> Recall
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <RotateCcw size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Recall Invoice</h3>
                <p className="text-xs text-muted-foreground">This will return the invoice to Draft status.</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              You can only recall this invoice if no approver has opened or actioned it yet.
              Once recalled, the invoice returns to <strong>Draft</strong> and you can edit and resubmit.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Reason for Recall <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Wrong amount entered, need to correct vendor details…"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">⚠️ {error}</p>}

            <div className="flex gap-3">
              <button onClick={handleRecall} disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all"
                style={{ background: "#FFB800", color: "#1B2A8A" }}>
                {loading ? "Recalling…" : "Confirm Recall"}
              </button>
              <button onClick={() => setOpen(false)} disabled={loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-border text-muted-foreground hover:bg-accent transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
