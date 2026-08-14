"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { colorForCategory } from "./categoryColors";

export type CategoryDatum = {
  category: string;
  revenue: number;
};

export function CategoryPieChart({ data }: { data: CategoryDatum[] }) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-sm font-medium mb-4">카테고리별 매출 비중</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="category"
            innerRadius={50}
            outerRadius={90}
          >
            {data.map((entry) => (
              <Cell key={entry.category} fill={colorForCategory(entry.category)} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${Number(value).toLocaleString()}원`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
