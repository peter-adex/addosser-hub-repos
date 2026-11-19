"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { formatCompact } from "@/lib/utils";

interface Props {
  monthlyTrend: { month: string; budget: number; actual: number }[];
}

export default function DashboardCharts({ monthlyTrend }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<<<<<<< HEAD
=======
      {/* Bar Chart */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4 text-sm">Budget vs Actual Spend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyTrend} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              formatter={(v: number) => formatCompact(v)}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="budget" name="Budget" fill="#1B2A8A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="#FFB800" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

<<<<<<< HEAD
=======
      {/* Line Chart */}
>>>>>>> d14ff358a570a0ae2263d9c3d072128e2da8652f
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4 text-sm">Spend Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              formatter={(v: number) => formatCompact(v)}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="budget" name="Budget" stroke="#1B2A8A" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#FFB800" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
