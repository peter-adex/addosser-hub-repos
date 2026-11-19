import { pct } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, max, showLabel = false, className }: ProgressBarProps) {
  const percent = Math.min(100, pct(value, max));
  const barColor =
    percent > 95 ? "#dc2626" : percent > 80 ? "#d97706" : "#16a34a";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: barColor }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-bold text-muted-foreground w-8 text-right">
          {percent}%
        </span>
      )}
    </div>
  );
}
