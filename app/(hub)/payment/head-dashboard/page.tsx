"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface Stats {
  queueCount: number;
  assignedCount: number;
  processingCount: number;
  completedThisMonth: number;
  pendingApprovals: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HeadDashboardPage() {
  const user = useCurrentUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/dashboard/head");
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned an unexpected response (status ${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load dashboard");
      setStats(data);
    } catch (e: any) {
      setError(e.message || "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {greeting()}, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Payment processing overview — {user?.roleName ?? ""}
          </p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl border border-border hover:bg-accent transition-colors text-muted-foreground">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-20 bg-card border border-red-200 dark:border-red-800 rounded-2xl text-center">
          <AlertCircle size={36} className="text-red-500" />
          <p className="font-bold text-foreground">Could not load dashboard</p>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 rounded-xl bg-[#FFB800] text-[#1B2A8A] text-sm font-bold">
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Awaiting Assignment", value: stats.queueCount, icon: "💳", href: "/payment" },
              { label: "Assigned (not started)", value: stats.assignedCount, icon: "📌", href: "/payment/assigned" },
              { label: "In Progress", value: stats.processingCount, icon: "⚙️", href: "/payment/assigned" },
              { label: "Awaiting Your Approval", value: stats.pendingApprovals, icon: "✅", href: "/payment/approvals" },
              { label: "Completed This Month", value: stats.completedThisMonth, icon: "🎉", href: "/payment/history" },
            ].map((tile) => (
              <Link key={tile.label} href={tile.href} className="bg-card border border-border rounded-2xl p-5 hover:border-[#FFB800] transition-colors">
                <div className="text-2xl mb-2">{tile.icon}</div>
                <div className="text-2xl font-extrabold text-foreground">{tile.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{tile.label}</div>
              </Link>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/payment" className="bg-[#1B2A8A] text-white rounded-2xl p-5 hover:opacity-90 transition-opacity">
              <p className="font-bold">Payment Queue →</p>
              <p className="text-sm text-white/70 mt-1">Assign Tellers to fully approved invoices</p>
            </Link>
            <Link href="/payment/assigned" className="bg-card border border-border rounded-2xl p-5 hover:border-[#FFB800] transition-colors">
              <p className="font-bold text-foreground">Assigned Tasks →</p>
              <p className="text-sm text-muted-foreground mt-1">Review or reassign active payments</p>
            </Link>
            <Link href="/payment/approvals" className="bg-card border border-border rounded-2xl p-5 hover:border-[#FFB800] transition-colors">
              <p className="font-bold text-foreground">Approval Queue →</p>
              <p className="text-sm text-muted-foreground mt-1">Verify Teller-submitted payments</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
