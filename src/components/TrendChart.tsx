"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type TrendDatum = {
  label: string;
  revenue: number;
};

export function TrendChart({ data }: { data: TrendDatum[] }) {
  if (data.length < 2) return null;
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-sm font-medium mb-4">기간별 매출 추이</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          />
          <Tooltip formatter={(value) => `${Number(value).toLocaleString()}원`} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--fill-accent)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
