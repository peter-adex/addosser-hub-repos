"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export default function CancelSplitButton({ splitId }: { splitId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cancel = async () => {
    if (!confirm("Cancel this split request? This cannot be undone.")) return;
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/asset-splits/${splitId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel request");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <button
        onClick={cancel}
        disabled={submitting}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
      >
        <XCircle size={16} /> {submitting ? "Cancelling…" : "Cancel Request"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </div>
  );
}
