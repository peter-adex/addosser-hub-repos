"use client";

import { useState }   from "react";
import { useRouter }  from "next/navigation";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";

interface Props {
  instanceId:   string;
  stepNumber:   number;
  roleName:     string;
}

export default function ApprovalActionButtons({ instanceId, stepNumber, roleName }: Props) {
  const router = useRouter();

  const [action,     setAction]     = useState<"APPROVED" | "REJECTED" | null>(null);
  const [comment,    setComment]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  const submit = async () => {
    if (!action) return;
    if (action === "REJECTED" && !comment.trim()) {
      setError("A reason is required when rejecting."); return;
    }

    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/approval-instances/${instanceId}/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to process approval");
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={`flex items-center gap-2 p-4 rounded-xl text-sm font-semibold border ${
        action === "APPROVED"
          ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
          : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
      }`}>
        {action === "APPROVED"
          ? <><CheckCircle2 size={16} /> Approved — next approver has been notified.</>
          : <><XCircle size={16} /> Rejected — the submitter has been notified.</>
        }
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-extrabold">
            {stepNumber}
          </span>
          Your Approval Required
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Approving as: <strong>{roleName}</strong>
        </p>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          <MessageSquare size={11} /> Comment
          {action === "REJECTED" && <span className="text-red-500">*</span>}
        </label>
        <textarea
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
          rows={3}
          placeholder={action === "REJECTED" ? "Reason for rejection (required)…" : "Add a note (optional)…"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">⚠️ {error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => { setAction("APPROVED"); }}
          disabled={submitting}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border disabled:opacity-60 ${
            action === "APPROVED"
              ? "bg-green-600 text-white border-green-600"
              : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
          }`}
        >
          <CheckCircle2 size={15} /> Approve
        </button>

        <button
          onClick={() => { setAction("REJECTED"); }}
          disabled={submitting}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border disabled:opacity-60 ${
            action === "REJECTED"
              ? "bg-red-600 text-white border-red-600"
              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
          }`}
        >
          <XCircle size={15} /> Reject
        </button>

        {action && (
          <button
            onClick={submit}
            disabled={submitting}
            className="ml-auto px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 transition-all"
            style={{ background: "#FFB800", color: "#1B2A8A" }}
          >
            {submitting
              ? "Processing…"
              : `Confirm ${action === "APPROVED" ? "Approval" : "Rejection"}`}
          </button>
        )}
      </div>
    </div>
  );
}
