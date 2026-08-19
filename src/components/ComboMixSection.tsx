"use client";

import { useState } from "react";

export type ComboEntry = { label: string; qty: number };

type View = "combo" | "flavor";

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

export function ComboMixSection({ combos, flavors }: { combos: ComboEntry[]; flavors: ComboEntry[] }) {
  const [view, setView] = useState<View>("combo");

  const rows = view === "combo" ? combos : flavors;
  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-medium">반반피자 판매비중</p>
        <div className="flex gap-1">
          <FilterButton active={view === "combo"} onClick={() => setView("combo")}>
            조합별
          </FilterButton>
          <FilterButton active={view === "flavor"} onClick={() => setView("flavor")}>
            개별 맛별
          </FilterButton>
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        {view === "combo"
          ? "반반피자류 주문에서 고른 두 가지 맛 조합 기준"
          : "조합을 풀어서 맛 하나하나가 몇 번씩 선택됐는지 (한 조합당 두 맛 각각 집계)"}{" "}
        · 매출이 아닌 주문건수 비중
      </p>
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
            <th className="py-2 font-normal">{view === "combo" ? "맛 조합" : "맛"}</th>
            <th className="py-2 font-normal text-right">건수</th>
            <th className="py-2 font-normal text-right">비중</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-[var(--border)] last:border-0">
              <td className="py-2">{r.label}</td>
              <td className="py-2 text-right">{r.qty.toLocaleString()}</td>
              <td className="py-2 text-right">{total > 0 ? ((r.qty / total) * 100).toFixed(1) : "0.0"}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
