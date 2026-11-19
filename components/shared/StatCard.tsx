import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
<<<<<<< HEAD
  theme?: any;
=======
  theme?: any; // legacy compat – ignored
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
}

export function StatCard({ label, value, sub, icon, color = "#1B2A8A", trend, className }: StatCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl p-5 flex items-center gap-4", className)}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: `${color}18` }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-foreground truncate">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && (
          <div
            className="text-xs font-semibold mt-1"
            style={{ color: trend === "up" ? "#16a34a" : trend === "down" ? "#dc2626" : color }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
