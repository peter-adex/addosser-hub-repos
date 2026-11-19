"use client";

interface Props {
  subtotal: string | number;
  vatRate: string | number;
  vatAmount: string | number;
  whtRate: string | number;
  whtAmount: string | number;
  amountPayable: string | number;
  trancheAmount?: string | number;
  isSplit?: boolean;
  className?: string;
}

function naira(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "₦0.00";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "₦0.00";
  return `₦${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
}

function pct(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

export default function PaymentBreakdown({
  subtotal,
  vatRate,
  vatAmount,
  whtRate,
  whtAmount,
  amountPayable,
  trancheAmount,
  isSplit = false,
  className = "",
}: Props) {
  const rows: {
    label: string;
    value: string;
    sub?: string;
    colour?: string;
    border?: boolean;
    bold?: boolean;
    large?: boolean;
  }[] = [
    {
      label: "Sub-Total",
      value: naira(subtotal),
    },
    {
      label: `VAT (${pct(vatRate)})`,
      value: `+ ${naira(vatAmount)}`,
      colour: "text-blue-600 dark:text-blue-400",
    },
    {
      label: `WHT (${pct(whtRate)})`,
      value: `− ${naira(whtAmount)}`,
      colour: "text-red-600 dark:text-red-400",
      border: true,
    },
    {
      label: "Amount Payable to Vendor",
      value: naira(amountPayable),
      bold: true,
      large: true,
      colour: "text-[#FFB800]",
    },
  ];

  const showTranche = isSplit && trancheAmount !== undefined;

  return (
    <div
      className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}
    >
      <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
        <span className="text-base">💰</span>
        <h3 className="text-sm font-bold text-foreground">Payment Breakdown</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Exact values — no approximation
        </span>
      </div>

      <div className="px-5 py-4 space-y-0">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-3 ${
              row.border
                ? "border-b border-dashed border-border"
                : ""
            }`}
          >
            <span
              className={`text-sm ${
                row.bold
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {row.label}
            </span>
            <span
              className={`font-mono ${
                row.large ? "text-xl font-extrabold" : "text-sm font-semibold"
              } ${row.colour ?? "text-foreground"}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {showTranche && (
        <div className="px-5 py-4 bg-[#1B2A8A]/5 dark:bg-[#1B2A8A]/20 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-foreground">
                This Tranche Amount
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Portion of total payable assigned to you
              </div>
            </div>
            <div className="text-xl font-extrabold text-[#1B2A8A] dark:text-blue-300 font-mono">
              {naira(trancheAmount)}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          All values derived directly from invoice records. VAT and WHT are
          computed at invoice creation and stored to 2-decimal precision.
          This breakdown is the authoritative figure for payment and accounting.
        </p>
      </div>
    </div>
  );
}
