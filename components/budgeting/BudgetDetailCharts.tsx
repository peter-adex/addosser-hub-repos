"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCompact } from "@/lib/utils";

interface MonthlyRow { month: string; budget: number; actual: number; }

export default function BudgetDetailCharts({ monthlyData }: { monthlyData: MonthlyRow[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h2 className="font-bold text-foreground mb-4 text-sm">Monthly Budget vs Actual</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={monthlyData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip formatter={(v: number) => formatCompact(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="budget" name="Budget" fill="#1B2A8A" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="#FFB800" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
