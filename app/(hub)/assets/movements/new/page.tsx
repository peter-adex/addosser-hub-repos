"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Loader2, ArrowRight } from "lucide-react";
import UserPicker from "@/components/shared/UserPicker";
import MultiFileUpload, { UploadedAttachment } from "@/components/shared/MultiFileUpload";

interface AssetOpt {
  id: string; assetNo: string; name: string; status: string; isMovable: boolean;
  entity: { id: string; name: string; code: string };
  branch: { id: string; name: string };
  location: string | null;
  classification?: { name: string } | null;
}
interface EntityOpt { id: string; name: string; code: string; isActive: boolean; }
interface BranchOpt { id: string; name: string; entityId: string; isActive: boolean; }

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

export default function NewAssetMovementRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("assetId");

  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<AssetOpt[]>([]);
  const [searching, setSearching]   = useState(false);
  const [asset, setAsset]           = useState<AssetOpt | null>(null);

  const [entities, setEntities] = useState<EntityOpt[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);

  const [form, setForm] = useState({
    toEntityId:   "",
    toBranchId:   "",
    toLocation:   "",
    toAssigneeId: "",
    reason:       "",
    movementDate: new Date().toISOString().split("T")[0],
    remarks:      "",
  });
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    fetch("/api/entities").then((r) => r.json()).then((d) => setEntities(d.data ?? []));
    fetch("/api/branches").then((r) => r.json()).then((d) => setBranches(d.data ?? []));
  }, []);

  const loadAsset = useCallback(async (id: string) => {
    const res = await fetch(`/api/assets/${id}`);
    const data = await res.json();
    if (res.ok && data.data) setAsset(data.data);
  }, []);

  useEffect(() => {
    if (preselectedId) loadAsset(preselectedId);
  }, [preselectedId, loadAsset]);

  useEffect(() => {
    if (!query.trim() || asset) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/assets?q=${encodeURIComponent(query)}&pageSize=8`);
        const data = await res.json();
        setResults(data.data ?? []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, asset]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const destBranches = branches.filter((b) => b.entityId === (form.toEntityId || asset?.entity.id));

  const identical =
    asset &&
    (!form.toEntityId || form.toEntityId === asset.entity.id) &&
    (!form.toBranchId || form.toBranchId === asset.branch.id) &&
    (!form.toLocation || form.toLocation === (asset.location ?? ""));

  const submit = async (e: React.FormEvent, mode: "draft" | "submit") => {
    e.preventDefault();
    if (!asset) { setError("Select an asset first."); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/movement-requests`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, toAssigneeId: form.toAssigneeId || undefined, attachments, submit: mode === "submit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save movement request");
      router.push(`/assets/movements/${data.data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/assets/movements" className="hover:text-foreground">Asset Movements</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Request</span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">New Asset Movement Request</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Move an asset between entities, locations, or both — subject to approval.
        </p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-foreground">1. Select Asset</h2>

        {!asset ? (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                className={inputCls + " pl-9"}
                placeholder="Search by asset code, name, or serial number…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />}
            </div>
            {results.length > 0 && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden divide-y divide-border">
                {results.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { loadAsset(a.id); setQuery(""); setResults([]); }}
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.assetNo} · {a.entity.code} · {a.branch.name}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">{a.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start justify-between p-4 rounded-xl bg-accent/30 border border-border">
            <div>
              <div className="font-bold text-foreground">{asset.name}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">{asset.assetNo}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {asset.classification?.name ?? "—"} · Currently at <strong>{asset.entity.code} / {asset.branch.name}</strong>
                {asset.location ? ` (${asset.location})` : ""}
              </div>
              {!asset.isMovable && (
                <div className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">This asset is marked non-movable and cannot be requested for movement.</div>
              )}
              {asset.status !== "ACTIVE" && (
                <div className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1">Asset status is {asset.status} — only ACTIVE assets are eligible for movement.</div>
              )}
            </div>
            <button type="button" onClick={() => setAsset(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Change</button>
          </div>
        )}
      </div>

      {asset && (
        <form className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-foreground">2. Proposed Destination</h2>
            <p className="text-xs text-muted-foreground -mt-2">Leave a field unchanged if only entity, or only location, is moving.</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-border bg-muted/30">
                <div className={labelCls}>Current Entity</div>
                <div className="text-sm font-semibold text-foreground">{asset.entity.code} — {asset.entity.name}</div>
              </div>
              <div>
                <label className={labelCls}>New Entity <span className="normal-case font-normal">(optional)</span></label>
                <select className={inputCls} value={form.toEntityId} onChange={(e) => set("toEntityId", e.target.value)}>
                  <option value="">— No change —</option>
                  {entities.filter((e) => e.isActive).map((e) => (
                    <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/30">
                <div className={labelCls}>Current Location</div>
                <div className="text-sm font-semibold text-foreground">{asset.branch.name}{asset.location ? ` (${asset.location})` : ""}</div>
              </div>
              <div>
                <label className={labelCls}>New Branch/Location <span className="normal-case font-normal">(optional)</span></label>
                <select className={inputCls} value={form.toBranchId} onChange={(e) => set("toBranchId", e.target.value)}>
                  <option value="">— No change —</option>
                  {destBranches.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Specific Location / Room <span className="normal-case font-normal">(optional)</span></label>
              <input className={inputCls} value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} placeholder="e.g. Floor 2, Room 201" />
            </div>

            <div>
              <label className={labelCls}>Assign To <span className="normal-case font-normal">(optional — who will be using this asset at the destination)</span></label>
              <UserPicker
                value={form.toAssigneeId}
                onChange={(userId) => set("toAssigneeId", userId)}
                inputClassName={inputCls}
                placeholder="Search for a user…"
              />
            </div>

            {asset && form.toEntityId && (
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
                <span>{asset.entity.code}</span><ArrowRight size={14} /><span>{entities.find((e) => e.id === form.toEntityId)?.code}</span>
              </div>
            )}

            {identical && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold">Destination is the same as the current entity/location — change at least one field.</div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-foreground">3. Request Details</h2>
            <div>
              <label className={labelCls}>Movement Reason</label>
              <textarea className={inputCls} rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Why is this asset being moved?" required />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Movement Date</label>
                <input type="date" className={inputCls} value={form.movementDate} onChange={(e) => set("movementDate", e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Supporting Documents <span className="normal-case font-normal">(optional)</span></label>
              <MultiFileUpload folder="assets/movements" value={attachments} onChange={setAttachments} />
            </div>
            <div>
              <label className={labelCls}>Additional Remarks <span className="normal-case font-normal">(optional)</span></label>
              <textarea className={inputCls} rows={2} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || !!identical || !asset.isMovable || asset.status !== "ACTIVE" || !form.reason}
              onClick={(e) => submit(e, "submit")}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1B2A8A] text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
            <button
              type="button"
              disabled={saving || !!identical || !form.reason}
              onClick={(e) => submit(e, "draft")}
              className="px-5 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50"
            >
              Save as Draft
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
