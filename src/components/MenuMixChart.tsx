"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { colorForCategory } from "./categoryColors";

export type MenuMixDatum = {
  productName: string;
  category: string;
  revenue: number;
  qty: number;
  share: number;
};

export function MenuMixChart({ data }: { data: MenuMixDatum[] }) {
  const top = data.slice(0, 12);
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-sm font-medium mb-4">메뉴별 매출 (상위 12개)</p>
      <ResponsiveContainer width="100%" height={Math.max(top.length * 32, 120)}>
        <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="productName"
            width={140}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, _name, item) => [
              `${Number(value).toLocaleString()}원 (${(item.payload as MenuMixDatum).share.toFixed(1)}%)`,
              (item.payload as MenuMixDatum).productName,
            ]}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {top.map((entry) => (
              <Cell key={entry.productName} fill={colorForCategory(entry.category)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
