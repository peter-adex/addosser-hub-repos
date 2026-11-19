"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type MovementType = "REALLOCATION" | "TEMPORARY_LOAN" | "ASSIGNMENT" | "UNASSIGNMENT";

interface Branch { id: string; name: string; entityId: string; }
interface UserOpt { id: string; name: string; email: string; }

export default function ReallocatePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [asset,    setAsset]    = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users,    setUsers]    = useState<UserOpt[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [form, setForm] = useState({
    movementType: "REALLOCATION" as MovementType,
    toBranchId:   "",
    toLocation:   "",
    toAssigneeId: "",
    reason:       "",
    movementDate: new Date().toISOString().split("T")[0],
    returnDate:   "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [assetRes, branchRes, userRes] = await Promise.all([
          fetch(`/api/assets/${id}`),
          fetch(`/api/branches`),
          fetch(`/api/users?active=true`),
        ]);
        const assetData  = await assetRes.json();
        const branchData = await branchRes.json();
        const userData   = await userRes.json();
        setAsset(assetData.data);
        setBranches(branchData.data ?? []);
        setUsers(userData.data ?? []);
      } catch { setError("Failed to load asset data"); }
      finally  { setLoading(false); }
    }
    load();
  }, [id]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const res = await fetch(`/api/assets/${id}/move`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save movement");
      router.push(`/assets/${id}`); router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;

  if (asset && !asset.isMovable) return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/assets/${id}`} className="hover:text-foreground">← Back to Asset</Link>
      </div>
      <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-lg mx-auto">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Asset Is Not Movable</h2>
        <p className="text-muted-foreground text-sm">This asset has been marked as <strong>non-movable</strong> (e.g. a building, embedded infrastructure). Its location cannot be changed.</p>
        <Link href={`/assets/${id}`} className="inline-flex mt-5 px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent">← Back to Asset</Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets" className="hover:text-foreground">Assets</Link>
        <span>/</span>
        <Link href={`/assets/${id}`} className="hover:text-foreground">{asset?.name ?? "Asset"}</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Reallocate</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Reallocate Asset</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {asset?.name} ({asset?.assetNo}) — currently at {asset?.branch?.name ?? "—"}
        </p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-foreground">Movement Details</h2>

          <div>
            <label className={labelCls}>Movement Type</label>
            <select className={inputCls} value={form.movementType} onChange={(e) => set("movementType", e.target.value)} required>
              <option value="REALLOCATION">Permanent Reallocation</option>
              <option value="TEMPORARY_LOAN">Temporary Loan</option>
              <option value="ASSIGNMENT">Assign to User</option>
              <option value="UNASSIGNMENT">Unassign from User</option>
            </select>
          </div>

          {(form.movementType === "REALLOCATION" || form.movementType === "TEMPORARY_LOAN") && (
            <div>
              <label className={labelCls}>Destination Branch</label>
              <select className={inputCls} value={form.toBranchId} onChange={(e) => set("toBranchId", e.target.value)} required>
                <option value="">— Select branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Location / Room <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
            <input type="text" className={inputCls} value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} placeholder="e.g. Floor 2, Room 201" />
          </div>

          {form.movementType === "ASSIGNMENT" && (
            <div>
              <label className={labelCls}>Assign To</label>
              <select className={inputCls} value={form.toAssigneeId} onChange={(e) => set("toAssigneeId", e.target.value)} required>
                <option value="">— Select user —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Movement Date</label>
              <input type="date" className={inputCls} value={form.movementDate} onChange={(e) => set("movementDate", e.target.value)} required />
            </div>
            {form.movementType === "TEMPORARY_LOAN" && (
              <div>
                <label className={labelCls}>Expected Return</label>
                <input type="date" className={inputCls} value={form.returnDate} onChange={(e) => set("returnDate", e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Reason / Notes</label>
            <textarea className={inputCls} rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Explain the reason for this movement…" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60" style={{ background: "#FFB800", color: "#1B2A8A" }}>
            {saving ? "Processing…" : "Confirm Movement"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-8 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent">Cancel</button>
        </div>
      </form>
    </div>
  );
}
