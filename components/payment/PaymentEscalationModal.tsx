"use client";

import { useState } from "react";
import { usePaymentCaps } from "@/hooks/usePaymentCaps";
import { AlertTriangle, X, Send, Loader2 } from "lucide-react";

interface Props {
  batchId: string;
  invoiceNo: string;
  vendorName: string;
  amountPayable: string | number;
  onSuccess?: () => void;
}

export default function PaymentEscalationModal({
  batchId,
  invoiceNo,
  vendorName,
  amountPayable,
  onSuccess,
}: Props) {
  const caps = usePaymentCaps();
  const perms = { canApprove: caps.approve, canCreate: caps.assign };

  const canEscalate = perms.canCreate || perms.canApprove;

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!canEscalate) return null;

  function naira(v: string | number): string {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "₦0.00";
    return `₦${n.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function handleSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Please provide a detailed reason (minimum 10 characters).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/payment/${batchId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to escalate invoice");
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setReason("");
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
    setError(null);
    setReason("");
    setSuccess(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300
                   bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30
                   dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40
                   text-sm font-semibold transition-colors"
        title="Escalate invoice back to submitter"
      >
        <AlertTriangle size={15} />
        Escalate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative z-10 w-full max-w-lg bg-card border border-border
                          rounded-2xl shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5
                            border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40
                                flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    Escalate Invoice
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    This will route the invoice back to the submitter
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 bg-muted/30 border-b border-border">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Invoice</div>
                  <div className="font-bold text-foreground font-mono">{invoiceNo}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Vendor</div>
                  <div className="font-semibold text-foreground truncate">{vendorName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Amount Payable</div>
                  <div className="font-bold text-[#FFB800]">{naira(amountPayable)}</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {success ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/40
                                  flex items-center justify-center text-2xl">✅</div>
                  <p className="font-bold text-foreground">Escalation Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    The invoice submitter has been notified by email and in-app notification.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Reason for Escalation{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        setError(null);
                      }}
                      placeholder="Describe the issue clearly — this message will be sent directly to the invoice submitter with the full invoice details. Example: 'The invoice amount does not match the purchase order. Please correct and resubmit.'"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3
                                 text-sm text-foreground placeholder:text-muted-foreground
                                 focus:outline-none focus:ring-2 focus:ring-[#FFB800]
                                 resize-none transition"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        Minimum 10 characters
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          reason.trim().length < 10
                            ? "text-amber-500"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {reason.trim().length} chars
                      </span>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200
                                  dark:border-amber-800 rounded-xl p-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      <strong>What happens next:</strong> The invoice will be removed from the
                      payment queue and its status will change to <strong>ESCALATED</strong>.
                      The submitter will receive an email with the invoice details and your
                      reason. Once they resolve the issue, the Payment Head can re-queue it.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200
                                    dark:border-red-800 rounded-xl px-4 py-3">
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {!success && (
              <div className="px-6 py-4 border-t border-border flex items-center
                              justify-end gap-3">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl border border-border text-sm
                             font-semibold text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || reason.trim().length < 10}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                             bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                             disabled:cursor-not-allowed text-white text-sm
                             font-bold transition-colors"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {loading ? "Submitting…" : "Submit Escalation"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
