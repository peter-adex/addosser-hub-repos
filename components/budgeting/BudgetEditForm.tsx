"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter }             from "next/navigation";
import { formatCompact, MONTHS } from "@/lib/utils";

interface MonthlyLine { month: number; amount: number; }

interface Budget {
  id:              string;
  annualAmount:    number | string;
  distributionType:"EQUAL" | "WEIGHTED" | "MANUAL";
  budgetType:      "OPEX" | "CAPEX";
  quantity:        number | null;
  branchId:        string | null;
  notes:           string | null;
  financialYear:   number;
  status:          string;
  monthlyLines:    MonthlyLine[];
  entityGL: {
    entityId:  string;
    glAccount: { code: string; name: string; category: string };
    entity:    { name: string; code: string };
  };
}

interface Branch { id: string; name: string; code: string | null; }

interface Props { budget: Budget; }

const TYPE_COLOR: Record<string, string> = { OPEX: "#0284c7", CAPEX: "#7c3aed" };
const TYPE_BG:    Record<string, string> = { OPEX: "#e0f2fe", CAPEX: "#ede9fe" };

export default function BudgetEditForm({ budget }: Props) {
  const router = useRouter();

  const [annualAmount,  setAnnual]    = useState(String(Number(budget.annualAmount)));
  const [distribution,  setDist]      = useState(budget.distributionType);
  const [budgetType,    setBudgetType] = useState<"OPEX" | "CAPEX">(budget.budgetType);
  const [quantity,      setQuantity]  = useState(budget.quantity ? String(budget.quantity) : "");
  const [branchId,      setBranchId]  = useState(budget.branchId ?? "");
  const [branches,      setBranches]  = useState<Branch[]>([]);
  const [branchLoading, setBranchLoad] = useState(false);
  const [notes,         setNotes]     = useState(budget.notes ?? "");
  const [monthlyAmounts,setMonthly]   = useState<number[]>(
    MONTHS.map((_, i) => {
      const line = budget.monthlyLines.find((l) => l.month === i + 1);
      return line ? Number(line.amount) : 0;
    })
  );
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const loadBranches = useCallback(async (entityId: string) => {
    if (!entityId) { setBranches([]); return; }
    setBranchLoad(true);
    try {
      const res  = await fetch(`/api/branches?entityId=${entityId}&active=true`);
      const data = await res.json();
      setBranches(data.success ? data.data : []);
    } catch { setBranches([]); }
    finally  { setBranchLoad(false); }
  }, []);

  useEffect(() => {
    loadBranches(budget.entityGL.entityId);
  }, [budget.entityGL.entityId, loadBranches]);

  const annual      = parseFloat(annualAmount) || 0;
  const monthlyEq   = annual > 0 ? annual / 12 : 0;
  const manualTotal = monthlyAmounts.reduce((s, a) => s + a, 0);
  const isCapex     = budgetType === "CAPEX";

  const setMonthVal = (i: number, v: string) => {
    const u = [...monthlyAmounts]; u[i] = parseFloat(v) || 0; setMonthly(u);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(false);

    if (distribution === "MANUAL" && Math.abs(manualTotal - annual) > 1) {
      setError(`Manual totals (${formatCompact(manualTotal)}) must equal annual budget (${formatCompact(annual)}).`);
      return;
    }
    if (isCapex && quantity && (isNaN(Number(quantity)) || Number(quantity) < 1)) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          annualAmount:     annual,
          distributionType: distribution,
          budgetType,
          quantity:         isCapex && quantity ? parseInt(quantity, 10) : null,
          branchId:         branchId || null,
          notes,
          monthlyAmounts:   distribution === "MANUAL" ? monthlyAmounts : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update budget");

      setSuccess(true);
      setTimeout(() => { router.push(`/budgeting/${budget.id}`); router.refresh(); }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB800] transition-shadow";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
  const tc       = TYPE_COLOR[budgetType];
  const tbg      = TYPE_BG[budgetType];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {error   && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">⚠️ {error}</div>}
      {success && <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">✅ Budget updated — redirecting…</div>}

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <code className="bg-muted px-2.5 py-1 rounded-lg text-xs font-bold text-foreground">
            {budget.entityGL.glAccount.code}
          </code>
          <span className="font-semibold text-foreground text-sm">{budget.entityGL.glAccount.name}</span>
          <span className="text-xs text-muted-foreground">({budget.entityGL.glAccount.category})</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {budget.entityGL.entity.name} ({budget.entityGL.entity.code}) · FY {budget.financialYear}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        <div className="grid grid-cols-2 border-b border-border">
          {(["OPEX","CAPEX"] as const).map((type) => {
            const active = budgetType === type;
            return (
              <button key={type} type="button" onClick={() => setBudgetType(type)}
                className="py-3.5 font-bold text-sm transition-all"
                style={{ background: active ? TYPE_BG[type] : "transparent", color: active ? TYPE_COLOR[type] : "hsl(var(--muted-foreground))", borderBottom: active ? `3px solid ${TYPE_COLOR[type]}` : "3px solid transparent" }}>
                {type}
                <span className="block text-xs font-normal opacity-70 mt-0.5">
                  {type === "OPEX" ? "Operating Expenditure" : "Capital Expenditure"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-4">

          <div>
            <label className={labelCls}>Branch <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={branchLoading}>
              <option value="">— All Branches / Head Office —</option>
              {branchLoading
                ? <option disabled>Loading branches…</option>
                : branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.code ? ` (${b.code})` : ""}
                    </option>
                  ))
              }
            </select>
          </div>

          {isCapex && (
            <div>
              <label className={labelCls}>Quantity <span className="normal-case font-normal text-muted-foreground">(number of items)</span></label>
              <input
                type="number" min="1" step="1" className={inputCls}
                value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 5 (for 5 laptops)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the number of units being purchased. Used for CAPEX asset tracking.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Annual Budget Amount (₦)</label>
            <input type="number" min="0" step="0.01" className={inputCls}
              value={annualAmount} onChange={(e) => setAnnual(e.target.value)} required />
            {annual > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                ≈ <strong>{formatCompact(annual)}</strong>
                {distribution === "EQUAL" && ` · ${formatCompact(monthlyEq)}/month`}
                {isCapex && quantity && Number(quantity) > 0 && ` · ${formatCompact(annual / Number(quantity))} per unit`}
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Distribution Method</label>
            <div className="flex gap-4 mt-1">
              {(["EQUAL","WEIGHTED","MANUAL"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input type="radio" name="dist" value={opt} checked={distribution === opt}
                    onChange={() => setDist(opt)} className="accent-[#FFB800]" />
                  {opt === "EQUAL" ? "Equal Monthly" : opt === "WEIGHTED" ? "Weighted" : "Manual Entry"}
                </label>
              ))}
            </div>
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
                      value={monthlyAmounts[i] || ""} onChange={(e) => setMonthVal(i, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Notes / Justification <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
            <textarea className={inputCls} rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="Describe any changes or rationale…" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading || success}
          className="px-8 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
          style={{ background: "#FFB800", color: "#1B2A8A" }}>
          {loading ? "Saving…" : "Update Budget"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-8 py-2.5 rounded-xl font-bold text-sm border border-border bg-card text-muted-foreground hover:bg-accent">
          Cancel
        </button>
      </div>
    </form>
  );
}
