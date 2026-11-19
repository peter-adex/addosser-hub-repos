"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface Props {
  invoiceId: string;
}

export default function InvoiceSubmitButton({ invoiceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      router.push(`/invoice/${invoiceId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">⚠️ {error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-60 transition-all"
        style={{ background: "#1B2A8A", color: "#fff" }}
      >
        <Send size={16} />
        {loading ? "Submitting…" : "Submit for Approval"}
      </button>
    </div>
  );
}
