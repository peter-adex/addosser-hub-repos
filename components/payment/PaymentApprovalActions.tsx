"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";

export default function PaymentApprovalActions({ trancheId }: { trancheId: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "APPROVED" | "REJECTED") {
    if (action === "REJECTED" && !reason.trim()) {
      setShowReject(true);
      setError("Enter a reason for rejecting this payment.");
      return;
    }
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/payment/tranches/${trancheId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to action payment");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {showReject && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejecting this payment…"
          rows={2}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-400"
        />
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={() => act("APPROVED")}
          disabled={loading !== null}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          {loading === "APPROVED" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Approve Payment
        </button>
        <button
          onClick={() => (showReject ? act("REJECTED") : setShowReject(true))}
          disabled={loading !== null}
          className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 text-red-700 dark:text-red-400 text-sm font-bold px-5 py-2.5 rounded-xl border border-red-200 dark:border-red-800 transition-colors"
        >
          {loading === "REJECTED" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
          {showReject ? "Confirm Rejection" : "Reject"}
        </button>
      </div>
    </div>
  );
}
