"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, BellRing, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface Props {
  assetId: string;
  assetName: string;
  approvalStatus: string;
  hasSubmittedRevision?: boolean;
  canManage: boolean;
}

export default function AssetDetailActions({ assetId, assetName, approvalStatus, hasSubmittedRevision, canManage }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancellingUpdate, setCancellingUpdate] = useState(false);

  if (!canManage) return null;

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${assetName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete asset");
      toast("Asset deleted.", "success");
      router.push("/assets");
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
      setDeleting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/resend-notification`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resend notification");
      toast(data.message ?? "Reminder sent.", "success");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setResending(false);
    }
  };

  const handleCancelUpdate = async () => {
    if (!window.confirm("Cancel this pending update? Your edits will be discarded and the asset will keep its current approved data.")) return;
    setCancellingUpdate(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/cancel-revision`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel update");
      toast(data.message ?? "Update cancelled.", "success");
      router.refresh();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setCancellingUpdate(false);
    }
  };

  return (
    <div className="flex gap-2">
      {approvalStatus === "PENDING_APPROVAL" && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2.5 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-60 flex items-center gap-1.5"
        >
          <Trash2 size={15} />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      )}
      {approvalStatus === "IN_APPROVAL" && (
        <button
          onClick={handleResend}
          disabled={resending}
          className="px-4 py-2.5 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-accent disabled:opacity-60 flex items-center gap-1.5"
        >
          <BellRing size={15} />
          {resending ? "Sending…" : "Resend Notification"}
        </button>
      )}
      {hasSubmittedRevision && (
        <button
          onClick={handleCancelUpdate}
          disabled={cancellingUpdate}
          className="px-4 py-2.5 rounded-xl text-sm font-bold border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-60 flex items-center gap-1.5"
        >
          <XCircle size={15} />
          {cancellingUpdate ? "Cancelling…" : "Cancel Pending Update"}
        </button>
      )}
    </div>
  );
}
