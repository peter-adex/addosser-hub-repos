"use client";

import { useMemo }             from "react";
import { calcDepreciation,
         fmtNGNDepr }          from "@/lib/depreciation";

interface Props {
  purchaseDate:   string;
  acquisitionValue: string | number;
  residualValue:    string | number;
  usefulLifeYrs:    number;
  method?:          "STRAIGHT_LINE" | "REDUCING_BALANCE" | "NONE";
}

export default function DepreciationPreview({
  purchaseDate,
  acquisitionValue,
  residualValue,
  usefulLifeYrs,
  method = "STRAIGHT_LINE",
}: Props) {
  const result = useMemo(
    () => calcDepreciation(purchaseDate, acquisitionValue, residualValue, usefulLifeYrs, method),
    [purchaseDate, acquisitionValue, residualValue, usefulLifeYrs, method]
  );

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground text-sm">
        <p className="font-medium">📊 Depreciation Preview</p>
        <p className="text-xs mt-1 opacity-70">
          Enter Purchase Date, Acquisition Value and Useful Life to see depreciation calculations.
        </p>
      </div>
    );
  }

  const isOver = result.depreciationPct >= 100;

  const Row = ({
    label, value, highlight = false, sublabel,
  }: { label: string; value: string; highlight?: boolean; sublabel?: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div>
        <span className="text-sm" style={{ color: "#94a3b8" }}>{label}</span>
        {sublabel && <div className="text-xs opacity-50 mt-0.5">{sublabel}</div>}
      </div>
      <span
        className="font-bold text-sm"
        style={{ color: highlight ? "#FFB800" : "#e2e8f0" }}
      >
        {value}
      </span>
    </div>
  );

  const pct     = Math.min(100, Math.round(result.depreciationPct));
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#FFB800";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f1c2e 0%, #1a2c42 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-white/5">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#FFB800" strokeWidth={2}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>Depreciation Preview</span>
        <span className="text-xs ml-1" style={{ color: "#64748b" }}>
          Straight-line · {usefulLifeYrs}-year useful life
        </span>
      </div>

      <div className="px-5 py-1">
        <Row label="Age of Asset" value={result.ageDisplay} />
        <Row label="Acquisition Value (AQUI)" value={fmtNGNDepr(result.acquisitionValue)} />
        <Row
          label="Depreciation / Month"
          value={fmtNGNDepr(result.depreciationPerMonth)}
          sublabel={`Posted on the 24th · Last: ${
            result.lastDepreciationDate
              ? result.lastDepreciationDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
              : "Not yet"
          }`}
        />
        <Row label="Depreciation / Year" value={fmtNGNDepr(result.depreciationPerYear)} />
        <Row
          label="Accumulated Depreciation"
          value={fmtNGNDepr(result.accumulatedDepr)}
          highlight={true}
        />
        <Row
          label="Net Book Value (NBV)"
          value={fmtNGNDepr(result.netBookValue)}
          highlight={true}
        />
      </div>

      <div className="px-5 pb-5 pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "#64748b" }}>Depreciation progress</span>
          <span
            className="text-xs font-bold"
            style={{ color: isOver ? "#ef4444" : "#FFB800" }}
          >
            {pct}% depreciated
          </span>
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs" style={{ color: "#475569" }}>
            Purchase:{" "}
            {new Date(purchaseDate).toLocaleDateString("en-NG", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
          <span className="text-xs" style={{ color: isOver ? "#ef4444" : "#475569" }}>
            {isOver ? "⚠️ Fully depreciated" : `Replacement due: ${
              result.replacementDue.toLocaleDateString("en-NG", {
                day: "numeric", month: "short", year: "numeric",
              })
            }`}
          </span>
        </div>

        {result.residualValue > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(255,184,0,0.08)", color: "#94a3b8" }}>
            Residual / Scrap Value: <strong style={{ color: "#FFB800" }}>{fmtNGNDepr(result.residualValue)}</strong>
            {" · "}NBV will not fall below this amount
          </div>
        )}
      </div>
    </div>
  );
}
