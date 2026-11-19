"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelAssetRevisionButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/${assetId}/cancel-revision`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not cancel this update.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
          Withdraw this update? The approver will be notified there's nothing left to review.
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
        >
          {cancelling ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={cancelling}
          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50"
        >
          Never mind
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
      >
        Cancel Update
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}
