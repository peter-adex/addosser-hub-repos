"use client";

"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge }  from "@/components/shared/Badge";

const MODULE_COLORS: Record<string, string> = {
  budgeting: "#0284c7",
  assets:    "#7c3aed",
  fleet:     "#dc2626",
  facility:  "#d97706",
  invoice:   "#16a34a",
  admin:     "#1B2A8A",
  auth:      "#6b7280",
};

function actionVariant(action: string): "green"|"red"|"yellow"|"blue"|"gray" {
  if (action.includes("CREATED") || action.includes("APPROVED")) return "green";
  if (action.includes("DELETED") || action.includes("REJECTED")) return "red";
  if (action.includes("UPDATED") || action.includes("EDITED"))    return "yellow";
  if (action.includes("LOGIN") || action.includes("INVITED"))     return "blue";
  return "gray";
}

function parseUA(ua: string | null): string {
  if (!ua) return "Unknown";
  const browser = ua.includes("Chrome") ? "Chrome"
    : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari")  ? "Safari"
    : ua.includes("Edge")    ? "Edge"
    : "Browser";
  const os = ua.includes("Windows") ? "Windows"
    : ua.includes("Mac")     ? "macOS"
    : ua.includes("Linux")   ? "Linux"
    : ua.includes("Android") ? "Android"
    : ua.includes("iPhone")  ? "iOS"
    : "OS";
  return `${browser} / ${os}`;
}

function DetailModal({ log, onClose }: { log: any; onClose: () => void }) {
  if (!log) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-extrabold text-foreground">{log.action}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(log.createdAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "medium" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-xl font-light"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">

          <section>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">👤 User</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Name",  log.user?.name  ?? "—"],
                ["Email", log.user?.email ?? "—"],
                ["Role",  log.user?.role?.name ?? "—"],
                ["User ID", log.userId],
              ].map(([k, v]) => (
                <div key={k} className="bg-muted/40 rounded-xl px-4 py-3">
                  <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
                  <div className="text-sm font-semibold text-foreground break-all">{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">🖥️ System Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["IP Address",   log.ipAddress  ?? "Not captured"],
                ["Browser / OS", parseUA(log.userAgent)],
                ["Module",       log.module],
                ["Resource ID",  log.resourceId ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="bg-muted/40 rounded-xl px-4 py-3">
                  <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
                  <div className="text-sm font-semibold text-foreground break-all">{v}</div>
                </div>
              ))}
            </div>
          </section>

          {log.beforeData && (
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📋 Before</h3>
              <pre className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-xs text-red-800 dark:text-red-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(log.beforeData), null, 2)}
              </pre>
            </section>
          )}

          {log.afterData && (
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">✅ After</h3>
              <pre className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 text-xs text-green-800 dark:text-green-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(log.afterData), null, 2)}
              </pre>
            </section>
          )}

          {log.meta && (
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">📎 Context Data</h3>
              <pre className="bg-muted/60 rounded-xl p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(log.meta), null, 2)}
              </pre>
            </section>
          )}

          {log.userAgent && (
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔎 Raw User Agent</h3>
              <p className="text-xs text-muted-foreground break-all bg-muted/40 rounded-xl px-4 py-3">{log.userAgent}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditTrailClient() {
  const [logs,       setLogs]       = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<any>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [module,   setModule]   = useState("");
  const [search,   setSearch]   = useState("");

  const PAGE_SIZE = 30;

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:     String(p),
        pageSize: String(PAGE_SIZE),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo   ? { dateTo   } : {}),
        ...(module   ? { module   } : {}),
        ...(search   ? { q: search } : {}),
      });
      const res  = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(p);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, module, search]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const inputCls = "px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";

  return (
    <>
      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">From</label>
            <input type="date" className={inputCls + " w-full"} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">To</label>
            <input type="date" className={inputCls + " w-full"} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Module</label>
            <select className={inputCls + " w-full"} value={module} onChange={(e) => setModule(e.target.value)}>
              <option value="">All Modules</option>
              {["budgeting","assets","fleet","facility","invoice","admin","auth"].map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
              <input
                type="text"
                placeholder="Action, IP, metadata…"
                className={inputCls + " w-full pl-8"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          <span><strong className="text-foreground">{total.toLocaleString()}</strong> records found</span>
          {(dateFrom || dateTo || module || search) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setModule(""); setSearch(""); }}
              className="text-red-600 hover:underline font-medium">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {["Timestamp","User","Module","Action","IP Address","System","Details"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#FFB800] border-t-transparent rounded-full animate-spin" />
                      Loading audit logs…
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="font-semibold">No audit records match your filters</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="font-medium text-foreground">
                        {new Date(log.createdAt).toLocaleDateString("en-NG")}
                      </div>
                      <div>{new Date(log.createdAt).toLocaleTimeString("en-NG")}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-foreground">{log.user?.name ?? "System"}</div>
                      <div className="text-xs text-muted-foreground">{log.user?.role?.name ?? "—"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: MODULE_COLORS[log.module] ?? "#6b7280" }}
                      >
                        {log.module}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <Badge variant={actionVariant(log.action)}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {log.ipAddress ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {parseUA(log.userAgent)}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(log)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent transition-colors text-foreground"
                      >
                        View ›
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(page - 1)} disabled={page === 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => fetchLogs(page + 1)} disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
