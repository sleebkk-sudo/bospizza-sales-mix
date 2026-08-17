"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colorForCategory } from "./categoryColors";

export type MenuMixEntry = { productName: string; category: string; qty: number; revenue: number };
export type CategoryMixEntry = { category: string; qty: number; revenue: number };

type Metric = "revenue" | "qty";
type View = "item" | "category";
type Row = { name: string; category: string; qty: number; revenue: number };

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-md border"
      style={
        active
          ? { background: "var(--surface-1)", borderColor: "var(--border-strong)", fontWeight: 600 }
          : { color: "var(--text-secondary)", borderColor: "var(--border)" }
      }
    >
      {children}
    </button>
  );
}

export function MenuMixSection({
  menuMix,
  categoryMix,
}: {
  menuMix: MenuMixEntry[];
  categoryMix: CategoryMixEntry[];
}) {
  const [view, setView] = useState<View>("item");
  const [category, setCategory] = useState<string>("전체");
  const [metric, setMetric] = useState<Metric>("revenue");

  const categories = useMemo(() => categoryMix.map((c) => c.category), [categoryMix]);

  const itemRowsAll = useMemo<Row[]>(
    () => menuMix.map((m) => ({ name: m.productName, category: m.category, qty: m.qty, revenue: m.revenue })),
    [menuMix]
  );
  const categoryRowsAll = useMemo<Row[]>(
    () => categoryMix.map((c) => ({ name: c.category, category: c.category, qty: c.qty, revenue: c.revenue })),
    [categoryMix]
  );

  const itemRows = useMemo(() => {
    const filtered = category === "전체" ? itemRowsAll : itemRowsAll.filter((r) => r.category === category);
    return [...filtered].sort((a, b) => b[metric] - a[metric]);
  }, [itemRowsAll, category, metric]);

  const categoryRows = useMemo(
    () => [...categoryRowsAll].sort((a, b) => b[metric] - a[metric]),
    [categoryRowsAll, metric]
  );

  if (menuMix.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-10 text-center">
        선택한 기간/매장에 해당하는 데이터가 없습니다.
      </p>
    );
  }

  const rows = view === "category" ? categoryRows : itemRows;
  const total = rows.reduce((s, r) => s + r[metric], 0);

  const top = view === "category" ? rows : rows.slice(0, 8);
  const restValue = view === "category" ? 0 : rows.slice(8).reduce((s, r) => s + r[metric], 0);
  const pieData: Row[] = restValue > 0 ? [...top, { name: "그 외", category: "그 외", qty: 0, revenue: 0, [metric]: restValue } as Row] : top;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <FilterButton active={view === "item"} onClick={() => setView("item")}>
              메뉴별
            </FilterButton>
            <FilterButton active={view === "category"} onClick={() => setView("category")}>
              카테고리별
            </FilterButton>
          </div>
          {view === "item" && (
            <div className="flex flex-wrap gap-1">
              {["전체", ...categories].map((c) => (
                <FilterButton key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </FilterButton>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <FilterButton active={metric === "revenue"} onClick={() => setMetric("revenue")}>
            매출 비중
          </FilterButton>
          <FilterButton active={metric === "qty"} onClick={() => setMetric("qty")}>
            건수 비중
          </FilterButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={pieData} dataKey={metric} nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
              {pieData.map((d) => (
                <Cell key={d.name} fill={colorForCategory(d.category)} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const pct = total ? ` (${((Number(value) / total) * 100).toFixed(1)}%)` : "";
                const label =
                  metric === "revenue" ? `${Number(value).toLocaleString()}원` : `${Number(value).toLocaleString()}건`;
                return [`${label}${pct}`, name as string];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 text-sm">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ background: colorForCategory(d.category) }}
              />
              <span className="text-[var(--text-secondary)]">{d.name}</span>
              <span className="font-medium">{total ? ((d[metric] / total) * 100).toFixed(1) : "0.0"}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[var(--border)] rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-[var(--surface-1)] text-[var(--text-secondary)]">
            <tr>
              <th className="text-left px-3 py-2 font-medium">{view === "category" ? "카테고리" : "메뉴"}</th>
              <th className="text-right px-3 py-2 font-medium">수량</th>
              <th className="text-right px-3 py-2 font-medium">매출</th>
              <th className="text-right px-3 py-2 font-medium">단가</th>
              <th className="text-right px-3 py-2 font-medium">비중</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.category}-${r.name}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                    style={{ background: colorForCategory(r.category) }}
                  />
                  <span className="align-middle">{r.name}</span>
                  {view === "item" && category === "전체" && (
                    <span className="ml-1.5 text-[11px] text-[var(--text-muted)] align-middle">{r.category}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">{r.qty.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right">{r.revenue.toLocaleString()}원</td>
                <td className="px-3 py-1.5 text-right">
                  {r.qty > 0 ? Math.round(r.revenue / r.qty).toLocaleString() : "-"}원
                </td>
                <td className="px-3 py-1.5 text-right">{total ? ((r[metric] / total) * 100).toFixed(1) : "0.0"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
