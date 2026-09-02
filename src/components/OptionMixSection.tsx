"use client";

import { useState } from "react";
import { getCatalogPrice } from "@/lib/optionPriceCatalog";

export type OptionEntry = { name: string; qty: number; revenue: number };

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
      className="text-xs px-2.5 py-1.5 rounded-md border whitespace-nowrap"
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

export function OptionMixSection({
  categories,
  mixByCategory,
}: {
  categories: string[];
  mixByCategory: Record<string, OptionEntry[]>;
}) {
  const availableCategories = categories.filter((c) => (mixByCategory[c]?.length ?? 0) > 0);
  const [category, setCategory] = useState<string | null>(availableCategories[0] ?? null);

  if (availableCategories.length === 0) return null;

  const rows = category ? mixByCategory[category] ?? [] : [];
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <p className="text-sm font-medium">옵션별 판매 믹스</p>
        <div className="flex gap-1 flex-wrap">
          {availableCategories.map((c) => (
            <FilterButton key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </FilterButton>
          ))}
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        피자 주문 시 고른 옵션(맛 선택 제외)을 카테고리별로 집계 — 매출이 아닌 선택건수 비중
      </p>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
            <th className="py-2 font-normal">옵션</th>
            <th className="py-2 font-normal text-right">가격</th>
            <th className="py-2 font-normal text-right">건수</th>
            <th className="py-2 font-normal text-right">매출</th>
            <th className="py-2 font-normal text-right">비중</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // 실제 매출은 리뷰이벤트 등으로 0원 처리된 건이 섞여 있어 평균 단가가 흔들리므로,
            // 카탈로그에 등록된 옵션이면 정가와 (정가 × 건수)를 그대로 보여준다.
            const catalogPrice = category ? getCatalogPrice(category, r.name) : null;
            const unitPrice = catalogPrice ?? (r.qty > 0 ? Math.round(r.revenue / r.qty) : 0);
            const revenue = catalogPrice !== null ? catalogPrice * r.qty : r.revenue;
            return (
              <tr key={r.name} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right">{unitPrice > 0 ? `+${unitPrice.toLocaleString()}원` : "0원"}</td>
                <td className="py-2 text-right">{r.qty.toLocaleString()}</td>
                <td className="py-2 text-right">{revenue.toLocaleString()}원</td>
                <td className="py-2 text-right">{totalQty > 0 ? ((r.qty / totalQty) * 100).toFixed(1) : "0.0"}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
