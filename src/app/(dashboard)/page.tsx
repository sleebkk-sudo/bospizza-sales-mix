import Link from "next/link";

export const dynamic = "force-dynamic";
import { MetricCard } from "@/components/MetricCard";
import { MenuMixChart } from "@/components/MenuMixChart";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { TrendChart } from "@/components/TrendChart";
import {
  getLatestSnapshot,
  getItemsForSnapshot,
  getSnapshots,
  getMenuCosts,
} from "@/lib/data";

export default async function DashboardPage() {
  const [latest, snapshots, costs] = await Promise.all([
    getLatestSnapshot(),
    getSnapshots(),
    getMenuCosts(),
  ]);

  if (!latest) {
    return (
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          아직 업로드된 매출 데이터가 없습니다.
        </p>
        <Link
          href="/upload"
          className="inline-block h-9 px-4 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium leading-9"
        >
          매출 데이터 업로드하러 가기
        </Link>
      </div>
    );
  }

  const items = await getItemsForSnapshot(latest.id);
  const costByName = new Map(costs.map((c) => [c.name, c.cost]));

  const menuMix = items
    .map((item) => ({
      productName: item.product_name,
      category: item.category,
      revenue: item.revenue,
      qty: item.qty,
      share: latest.total_revenue > 0 ? (item.revenue / latest.total_revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const categoryTotals = new Map<string, number>();
  for (const item of items) {
    categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + item.revenue);
  }
  const categoryMix = [...categoryTotals.entries()]
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const trend = snapshots.map((s) => ({
    label: s.period_start,
    revenue: s.total_revenue,
  }));

  const marginRows = menuMix
    .filter((m) => costByName.has(m.productName))
    .map((m) => {
      const unitCost = costByName.get(m.productName) ?? 0;
      const totalCost = unitCost * m.qty;
      const margin = m.revenue - totalCost;
      const marginRate = m.revenue > 0 ? (margin / m.revenue) * 100 : 0;
      return { ...m, totalCost, margin, marginRate };
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">대시보드</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {latest.period_start} ~ {latest.period_end} 기준
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="총 매출"
          value={`${latest.total_revenue.toLocaleString()}원`}
          role="accent"
        />
        <MetricCard label="총 판매수량" value={`${latest.total_qty.toLocaleString()}개`} />
        <MetricCard label="메뉴 수" value={`${menuMix.length}개`} />
        <MetricCard label="카테고리 수" value={`${categoryMix.length}개`} />
      </div>

      <TrendChart data={trend} />

      <div className="grid sm:grid-cols-2 gap-4">
        <MenuMixChart data={menuMix} />
        <CategoryPieChart data={categoryMix} />
      </div>

      {marginRows.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
          <p className="text-sm font-medium mb-4">메뉴별 마진 (원가 입력된 메뉴만)</p>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">메뉴</th>
                <th className="py-2 font-normal text-right">매출</th>
                <th className="py-2 font-normal text-right">원가</th>
                <th className="py-2 font-normal text-right">마진</th>
                <th className="py-2 font-normal text-right">마진율</th>
              </tr>
            </thead>
            <tbody>
              {marginRows.map((row) => (
                <tr key={row.productName} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{row.productName}</td>
                  <td className="py-2 text-right">{row.revenue.toLocaleString()}원</td>
                  <td className="py-2 text-right">{row.totalCost.toLocaleString()}원</td>
                  <td className="py-2 text-right">{row.margin.toLocaleString()}원</td>
                  <td className="py-2 text-right">{row.marginRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
        <p className="text-sm font-medium mb-4">전체 메뉴 목록</p>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
              <th className="py-2 font-normal">메뉴</th>
              <th className="py-2 font-normal">카테고리</th>
              <th className="py-2 font-normal text-right">수량</th>
              <th className="py-2 font-normal text-right">매출</th>
              <th className="py-2 font-normal text-right">비중</th>
            </tr>
          </thead>
          <tbody>
            {menuMix.map((row) => (
              <tr key={row.productName} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2">{row.productName}</td>
                <td className="py-2 text-[var(--text-secondary)]">{row.category}</td>
                <td className="py-2 text-right">{row.qty.toLocaleString()}</td>
                <td className="py-2 text-right">{row.revenue.toLocaleString()}원</td>
                <td className="py-2 text-right">{row.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
