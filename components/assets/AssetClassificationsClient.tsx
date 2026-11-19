"use client";

import { useState, useMemo } from "react";
import { Badge }             from "@/components/shared/Badge";

const DEPR_LABELS: Record<string, string> = {
  STRAIGHT_LINE:    "Straight-Line",
  REDUCING_BALANCE: "Reducing Balance",
  NONE:             "None",
};

interface Classification {
  id: string;
  name: string;
  code: string;
  description: string | null;
  glAccountCode: string | null;
  usefulLifeDefault: number;
  depreciationMethod: string;
  isActive: boolean;
  _count: { assets: number };
}

interface GLAccount { id: string; code: string; name: string; }

interface Props {
  classifications: Classification[];
  glAccounts:      GLAccount[];
}

const BLANK = {
  name: "", code: "", description: "", glAccountCode: "",
  usefulLifeDefault: 4, depreciationMethod: "STRAIGHT_LINE",
};

export default function AssetClassificationsClient({ classifications: initial, glAccounts }: Props) {
  const [items,    setItems]   = useState(initial);
  const [search,   setSearch]  = useState("");
  const [modal,    setModal]   = useState<{ open: boolean; mode: "create"|"edit"; data: any }>({ open: false, mode: "create", data: BLANK });
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const [msg,      setMsg]     = useState("");

  const filtered = useMemo(() =>
    items.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.glAccountCode ?? "").includes(search)
    ), [items, search]
  );

  const api = async (url: string, method: string, body?: any) => {
    setError(""); setMsg("");
    const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  };

  const save = async () => {
    setLoading(true);
    try {
      const { data } = modal.mode === "create"
        ? await api("/api/asset-classifications", "POST", modal.data)
        : await api(`/api/asset-classifications/${modal.data.id}`, "PATCH", modal.data);

      if (modal.mode === "create") {
        setItems((p) => [...p, { ...data, _count: { assets: 0 } }]);
        setMsg(`✅ Classification "${data.name}" created`);
      } else {
        setItems((p) => p.map((c) => c.id === data.id ? { ...c, ...data } : c));
        setMsg(`✅ Classification "${data.name}" updated`);
      }
      setModal({ open: false, mode: "create", data: BLANK });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (c: Classification) => {
    try {
      await api(`/api/asset-classifications/${c.id}`, "PATCH", { isActive: !c.isActive });
      setItems((p) => p.map((x) => x.id === c.id ? { ...x, isActive: !x.isActive } : x));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (c: Classification) => {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    try {
      const { message } = await api(`/api/asset-classifications/${c.id}`, "DELETE");
      if (message) { setMsg(message); setItems((p) => p.map((x) => x.id === c.id ? { ...x, isActive: false } : x)); }
      else          { setItems((p) => p.filter((x) => x.id !== c.id)); setMsg(`✅ "${c.name}" deleted`); }
    } catch (err: any) { setError(err.message); }
  };

  const setField = (k: string, v: any) => setModal((m) => ({ ...m, data: { ...m.data, [k]: v } }));
  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-4">
      {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}
      {msg   && <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">{msg}</div>}

      <div className="flex items-center justify-between gap-4">
        <input
          type="text" placeholder="Search classifications…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
        />
        <button
          onClick={() => setModal({ open: true, mode: "create", data: BLANK })}
          className="px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          ＋ New Classification
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40">
                {["Code","Classification Name","Default Life","Depr. Method","GL Account","Assets","Status","Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No classifications found</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-bold text-foreground">{c.code}</code>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-sm text-foreground">{c.name}</div>
                    {c.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{c.description}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-foreground">{c.usefulLifeDefault} yrs</td>
                  <td className="px-4 py-3.5"><Badge variant="blue">{DEPR_LABELS[c.depreciationMethod] ?? c.depreciationMethod}</Badge></td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{c.glAccountCode ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-foreground">{c._count.assets}</td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => toggle(c)}
                      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${c.isActive ? "bg-[#FFB800]" : "bg-muted"}`}
                      title={c.isActive ? "Click to disable" : "Click to enable"}
                    >
                      <span className={`inline-block w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${c.isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2">
                      <button onClick={() => setModal({ open: true, mode: "edit", data: { ...c } })}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent border border-border text-foreground hover:bg-muted">
                        Edit
                      </button>
                      <button onClick={() => remove(c)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100">
                        {c._count.assets > 0 ? "Disable" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-bold text-foreground text-lg">
                {modal.mode === "create" ? "New Asset Classification" : `Edit — ${modal.data.name}`}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Classification Name *</label>
                  <input className={inputCls} value={modal.data.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Motor Vehicles" required />
                </div>
                <div>
                  <label className={labelCls}>Code *</label>
                  <input className={inputCls} value={modal.data.code} onChange={(e) => setField("code", e.target.value.toUpperCase())} placeholder="e.g. MV" maxLength={10} required />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <input className={inputCls} value={modal.data.description ?? ""} onChange={(e) => setField("description", e.target.value)} placeholder="Optional description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Default Useful Life (years)</label>
                  <input type="number" min="1" max="100" className={inputCls} value={modal.data.usefulLifeDefault}
                    onChange={(e) => setField("usefulLifeDefault", parseInt(e.target.value) || 4)} />
                </div>
                <div>
                  <label className={labelCls}>Depreciation Method</label>
                  <select className={inputCls} value={modal.data.depreciationMethod} onChange={(e) => setField("depreciationMethod", e.target.value)}>
                    <option value="STRAIGHT_LINE">Straight-Line (SLM)</option>
                    <option value="REDUCING_BALANCE">Reducing Balance (RBM)</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Default GL Account (for depreciation posting)</label>
                <select className={inputCls} value={modal.data.glAccountCode ?? ""} onChange={(e) => setField("glAccountCode", e.target.value)}>
                  <option value="">— None —</option>
                  {glAccounts.map((gl) => (
                    <option key={gl.id} value={gl.code}>{gl.code} — {gl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={save} disabled={loading}
                className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
                style={{ background: "#FFB800", color: "#1B2A8A" }}>
                {loading ? "Saving…" : modal.mode === "create" ? "Create" : "Update"}
              </button>
              <button onClick={() => { setModal({ open: false, mode: "create", data: BLANK }); setError(""); }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
