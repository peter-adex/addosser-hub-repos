"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  assetId:     string;
  hasWorkflow: boolean;
  isRevision:  boolean;
}

export default function AssetPreviewClient({ assetId, hasWorkflow, isRevision }: Props) {
  const router = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error,    setError]    = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = isRevision ? `/api/assets/${assetId}/submit-revision` : `/api/assets/${assetId}/submit`;
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit for approval");

      setSubmitted(true);
      setTimeout(() => {
        router.push(`/assets/${assetId}`);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this pending update? Your edits will be discarded and the asset will keep its current approved data.")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/assets/${assetId}/cancel-revision`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel update");
      router.push(`/assets/${assetId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setCancelling(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-6 flex items-center gap-4">
        <CheckCircle2 size={32} className="text-green-600 dark:text-green-400 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-green-700 dark:text-green-300 text-lg">Submitted Successfully!</h3>
          <p className="text-green-600 dark:text-green-400 text-sm mt-1">
            {isRevision
              ? "Your update has been submitted for approval. The asset keeps its current data until approved — approvers have been notified by email and in-app notification."
              : "Your asset requisition has been submitted for approval. Approvers have been notified by email and in-app notification."}{" "}
            Redirecting to asset details…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">

      {!hasWorkflow && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 dark:text-amber-400 text-sm">
            <strong>No Asset Registration Approval workflow is configured for this entity.</strong>{" "}
            Contact your administrator to set one up before this asset can be submitted for approval.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={loading || cancelling || !hasWorkflow}
          title={!hasWorkflow ? "No approval workflow configured for this entity" : undefined}
          className="px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          {loading ? (
            <><span className="animate-spin">⟳</span> Submitting…</>
          ) : (
            <><CheckCircle2 size={16} /> Submit for Approval</>
          )}
        </button>

        {isRevision && (
          <button
            onClick={handleCancel}
            disabled={loading || cancelling}
            className="px-5 py-3 rounded-xl font-bold text-sm border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-60 flex items-center gap-2"
          >
            <XCircle size={16} />
            {cancelling ? "Cancelling…" : "Cancel Update"}
          </button>
        )}

        <p className="text-xs text-muted-foreground">
          {isRevision
            ? "Once submitted, approvers will be notified immediately. The asset keeps its current data until they approve."
            : "Once submitted, approvers will be notified immediately. You can track the approval status on the asset detail page."}
        </p>
      </div>
    </div>
  );
}
