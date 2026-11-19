"use client";

<<<<<<< HEAD
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter }                                  from "next/navigation";
import { formatCompact, MONTHS }                      from "@/lib/utils";

interface GLAccount { id: string; code: string; name: string; category: string; }
interface Entity    { id: string; name: string; code: string; }
interface Branch    { id: string; name: string; code: string | null; }

interface Props {
  entities:   Entity[];
  glAccounts: GLAccount[];
}

const BUDGET_TYPES = {
  OPEX: {
    label: "OPEX", fullLabel: "Operating Expenditure",
    desc:  "Recurring costs required to run daily operations — fuel, salaries, utilities, repairs, stationery.",
    color: "#0284c7", bg: "#e0f2fe",
  },
  CAPEX: {
    label: "CAPEX", fullLabel: "Capital Expenditure",
    desc:  "Long-term investment in assets with useful life over one year — vehicles, IT equipment, buildings.",
    color: "#7c3aed", bg: "#ede9fe",
  },
} as const;
type BudgetType = keyof typeof BUDGET_TYPES;

export default function NewBudgetForm({ entities, glAccounts }: Props) {
  const router = useRouter();

  const [budgetType,    setBudgetType]   = useState<BudgetType>("OPEX");
  const [entityId,      setEntityId]     = useState(entities[0]?.id ?? "");
  const [glAccountId,   setGlAccountId]  = useState("");
  const [glSearch,      setGlSearch]     = useState("");
  const [glOpen,        setGlOpen]       = useState(false);
  const [branchId,      setBranchId]     = useState("");
  const [branches,      setBranches]     = useState<Branch[]>([]);
  const [branchLoading, setBranchLoad]   = useState(false);
  const [financialYear, setYear]         = useState(new Date().getFullYear());
  const [annualAmount,  setAnnual]       = useState("");
  const [quantity,      setQuantity]     = useState<string>("");
  const [distribution,  setDist]         = useState<"EQUAL"|"WEIGHTED"|"MANUAL">("EQUAL");
  const [monthlyAmounts,setMonthly]      = useState<number[]>(Array(12).fill(0));
  const [notes,         setNotes]        = useState("");
  const [loading,       setLoading]      = useState(false);
  const [error,         setError]        = useState("");

  const glRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (glRef.current && !glRef.current.contains(e.target as Node)) setGlOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const loadBranches = useCallback(async (eid: string) => {
    if (!eid) { setBranches([]); return; }
    setBranchLoad(true);
    try {
      const res = await fetch(`/api/branches?entityId=${eid}&active=true`);
      const data = await res.json();
      setBranches(data.success ? data.data : []);
    } catch { setBranches([]); }
    finally { setBranchLoad(false); }
  }, []);

  useEffect(() => {
    setBranchId("");
    loadBranches(entityId);
  }, [entityId, loadBranches]);

  const annual      = parseFloat(annualAmount) || 0;
  const monthlyEq   = annual > 0 ? annual / 12 : 0;
  const manualTotal = monthlyAmounts.reduce((s, a) => s + a, 0);

  const filteredGL = glAccounts.filter((gl) => {
    const q = glSearch.toLowerCase();
    return gl.code.toLowerCase().includes(q) || gl.name.toLowerCase().includes(q) || gl.category.toLowerCase().includes(q);
  });
  const selectedGL = glAccounts.find((gl) => gl.id === glAccountId);

  const pickGL = (gl: GLAccount) => {
    setGlAccountId(gl.id);
    setGlSearch(`${gl.code} — ${gl.name}`);
    setGlOpen(false);
  };

  const setMonthVal = (i: number, v: string) => {
    const u = [...monthlyAmounts];
    u[i] = parseFloat(v) || 0;
    setMonthly(u);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!glAccountId)          { setError("Please select a GL Account."); return; }
    if (!annual || annual <= 0) { setError("Annual amount must be greater than zero."); return; }
    if (distribution === "MANUAL" && Math.abs(manualTotal - annual) > 1) {
      setError(`Manual totals (${formatCompact(manualTotal)}) must equal annual budget (${formatCompact(annual)}).`);
      return;
    }
    if (quantity && (isNaN(Number(quantity)) || Number(quantity) < 1)) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/budgets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          entityId,
          glAccountId,
          branchId:        branchId || undefined,
          quantity:        quantity ? parseInt(quantity) : undefined,
          financialYear,
          annualAmount:    annual,
          distributionType: distribution,
          budgetType,
          notes,
          monthlyAmounts:  distribution === "MANUAL" ? monthlyAmounts : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create budget");
      router.push(`/budgeting/${data.data.id}`);
      router.refresh();
=======
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCompact, MONTHS } from "@/lib/utils";

interface Props {
  entities: { id: string; name: string; code: string }[];
  glAccounts: { id: string; code: string; name: string; category: string }[];
}

export default function NewBudgetForm({ entities, glAccounts }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    entityId: entities[0]?.id ?? "",
    glAccountId: "",
    financialYear: new Date().getFullYear(),
    annualAmount: "",
    distributionType: "EQUAL" as "EQUAL" | "WEIGHTED" | "MANUAL",
    notes: "",
  });
  const [monthlyAmounts, setMonthlyAmounts] = useState<number[]>(Array(12).fill(0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const annual = parseFloat(form.annualAmount) || 0;
  const monthlyEqual = annual / 12;

  const setField = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = {
        ...form,
        annualAmount: annual,
        monthlyAmounts: form.distributionType === "MANUAL" ? monthlyAmounts : undefined,
      };
      const res = await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create budget");
      router.push(`/budgeting/${data.data.id}`);
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const inp  = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition-shadow";
  const lbl  = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
  const meta = BUDGET_TYPES[budgetType];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        <div className="grid grid-cols-2 border-b border-border">
          {(Object.keys(BUDGET_TYPES) as BudgetType[]).map((type) => {
            const t = BUDGET_TYPES[type];
            const active = budgetType === type;
            return (
              <button
                key={type} type="button" onClick={() => setBudgetType(type)}
                className="py-4 font-bold text-sm transition-all"
                style={{
                  background:   active ? t.bg : "transparent",
                  color:        active ? t.color : "hsl(var(--muted-foreground))",
                  borderBottom: active ? `3px solid ${t.color}` : "3px solid transparent",
                }}
              >
                {t.label}
                <span className="block text-xs font-normal opacity-70 mt-0.5">{t.fullLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="px-6 py-3 text-xs" style={{ background: meta.bg, color: meta.color }}>
          <strong>{meta.label}:</strong> {meta.desc}
        </div>

        <div className="p-6 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Entity</label>
              <select className={inp} value={entityId} onChange={(e) => setEntityId(e.target.value)} required>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Financial Year</label>
              <select className={inp} value={financialYear} onChange={(e) => setYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>
              Branch / Location
              <span className="ml-1 normal-case font-normal text-muted-foreground">(optional)</span>
            </label>
            {branchLoading ? (
              <div className={`${inp} text-muted-foreground`}>Loading branches…</div>
            ) : (
              <select className={inp} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">— All Branches / Head Office —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.code ? ` (${b.code})` : ""}
                  </option>
                ))}
              </select>
            )}
            {branches.length === 0 && !branchLoading && entityId && (
              <p className="text-xs text-muted-foreground mt-1">No branches set up for this entity yet. <a href="/admin" className="text-[#1B2A8A] dark:text-blue-400 underline">Add branches in Admin</a>.</p>
            )}
          </div>

          <div>
            <label className={lbl}>GL Account</label>
            <div className="relative" ref={glRef}>
              <input
                type="text" className={inp} autoComplete="off"
                placeholder="Search by code, name or category…"
                value={glSearch}
                onChange={(e) => { setGlSearch(e.target.value); setGlAccountId(""); setGlOpen(true); }}
                onFocus={() => setGlOpen(true)}
              />
              {glOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
                  {filteredGL.length === 0
                    ? <div className="px-4 py-3 text-sm text-muted-foreground">No accounts match "{glSearch}"</div>
                    : filteredGL.map((gl) => (
                        <button key={gl.id} type="button" onClick={() => pickGL(gl)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-4">
                          <span>
                            <code className="text-xs font-bold text-[#1B2A8A] dark:text-blue-300 bg-muted px-1.5 py-0.5 rounded mr-2">{gl.code}</code>
                            {gl.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">{gl.category}</span>
                        </button>
                      ))
                  }
                </div>
              )}
            </div>
            {selectedGL && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                ✓ {selectedGL.code} — {selectedGL.name} ({selectedGL.category})
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>
                Quantity
                <span className="ml-1 normal-case font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                type="number" min="1" step="1" className={inp}
                value={quantity}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setQuantity(v);
                }}
                placeholder={budgetType === "CAPEX" ? "e.g. 5 (laptops)" : "e.g. 12 (months)"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {budgetType === "CAPEX" ? "No. of units to purchase" : "No. of operational units"}
              </p>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Annual Budget Amount (₦)</label>
              <input
                type="number" min="0" step="0.01" className={inp}
                value={annualAmount}
                onChange={(e) => setAnnual(e.target.value)}
                placeholder="e.g. 12000000"
                required
              />
              {annual > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ <strong>{formatCompact(annual)}</strong>
                  {quantity && Number(quantity) > 0 && ` · ${formatCompact(annual / Number(quantity))} per unit`}
                  {distribution === "EQUAL" && ` · ${formatCompact(monthlyEq)}/month`}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={lbl}>Distribution Method</label>
            <div className="flex gap-4 mt-1">
              {(["EQUAL","WEIGHTED","MANUAL"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input type="radio" name="dist" value={opt} checked={distribution === opt}
                    onChange={() => setDist(opt)} className="accent-[#FFB800]" />
                  {opt === "EQUAL" ? "Equal Monthly" : opt === "WEIGHTED" ? "Weighted" : "Manual Entry"}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {distribution === "EQUAL"    && "Annual amount divided equally across 12 months."}
              {distribution === "WEIGHTED" && "Distribute more to peak periods — set weights after creation."}
              {distribution === "MANUAL"   && "Enter exact monthly amounts below."}
            </p>
          </div>

          {distribution === "MANUAL" && (
            <div className="bg-muted/40 rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Amounts (₦)</span>
                <span className={`text-xs font-bold ${Math.abs(manualTotal - annual) > 1 ? "text-red-600" : "text-green-600"}`}>
                  Total: {formatCompact(manualTotal)} / {formatCompact(annual)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((m, i) => (
                  <div key={m}>
                    <div className="text-xs text-muted-foreground mb-1 font-medium">{m}</div>
                    <input type="number" min="0" step="0.01" placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-[#FFB800]"
                      value={monthlyAmounts[i] || ""}
                      onChange={(e) => setMonthVal(i, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={lbl}>
              Justification / Notes
              <span className="ml-1 normal-case font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea className={inp} rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context or justification for this budget request…" />
          </div>
=======
  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800]";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-foreground">Budget Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Entity</label>
            <select className={inputCls} value={form.entityId} onChange={(e) => setField("entityId", e.target.value)} required>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Financial Year</label>
            <select className={inputCls} value={form.financialYear} onChange={(e) => setField("financialYear", e.target.value)}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>GL Account</label>
          <select className={inputCls} value={form.glAccountId} onChange={(e) => setField("glAccountId", e.target.value)} required>
            <option value="">Select GL Account...</option>
            {glAccounts.map((gl) => <option key={gl.id} value={gl.id}>{gl.code} — {gl.name} ({gl.category})</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Annual Budget Amount (₦)</label>
          <input type="number" min="0" className={inputCls} value={form.annualAmount} onChange={(e) => setField("annualAmount", e.target.value)} placeholder="e.g. 12000000" required />
          {annual > 0 && (
            <p className="text-xs text-muted-foreground mt-1">≈ {formatCompact(annual)} per year | {formatCompact(monthlyEqual)}/month</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Distribution Method</label>
          <div className="flex gap-3 mt-1">
            {(["EQUAL", "WEIGHTED", "MANUAL"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input type="radio" name="dist" value={opt} checked={form.distributionType === opt} onChange={() => setField("distributionType", opt)} className="accent-[#FFB800]" />
                {opt === "EQUAL" ? "Equal Monthly" : opt.charAt(0) + opt.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </div>

        {form.distributionType === "MANUAL" && (
          <div>
            <label className={labelCls}>Monthly Amounts (₦)</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {MONTHS.map((m, i) => (
                <div key={m}>
                  <div className="text-xs text-muted-foreground mb-1">{m}</div>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    value={monthlyAmounts[i] || ""}
                    onChange={(e) => {
                      const updated = [...monthlyAmounts];
                      updated[i] = parseFloat(e.target.value) || 0;
                      setMonthlyAmounts(updated);
                    }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: {formatCompact(monthlyAmounts.reduce((s, a) => s + a, 0))}</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Any additional notes..." />
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
        </div>
      </div>

      <div className="flex gap-3">
<<<<<<< HEAD
        <button type="submit" disabled={loading}
          className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}>
          {loading ? "Saving…" : `Save ${budgetType} Budget`}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-8 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent transition-all">
=======
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all"
          style={{ background: "#FFB800", color: "#1B2A8A" }}
        >
          {loading ? "Saving..." : "Save Budget Line"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent transition-all"
        >
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
          Cancel
        </button>
      </div>
    </form>
  );
}
