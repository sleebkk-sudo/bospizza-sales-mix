import Link from "next/link";
import { format, subDays, startOfMonth } from "date-fns";
import { MetricCard } from "@/components/MetricCard";
import { FilterBar } from "@/components/FilterBar";
import { MenuMixSection } from "@/components/MenuMixSection";
import { ComboMixSection } from "@/components/ComboMixSection";
import { TrendChart } from "@/components/TrendChart";
import {
  getDateBounds,
  getStoreNames,
  getChannels,
  getItemsInRange,
  getDailyStatsInRange,
  getCombosInRange,
} from "@/lib/data";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function clamp(date: string, min: string, max: string) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

// "오늘"은 당일 매출 파일이 아직 안 올라와 있는 게 보통이라 의미가 없다.
// 대신 "어제"는 데이터가 있는 가장 최근 날짜(maxDate) 하루로 본다.
function buildPresets(minDate: string, maxDate: string) {
  const max = new Date(`${maxDate}T00:00:00Z`);
  const last7 = fmt(subDays(max, 6));
  const monthStart = fmt(startOfMonth(max));
  return [
    { label: "어제", from: maxDate, to: maxDate },
    { label: "최근 7일", from: clamp(last7, minDate, maxDate), to: maxDate },
    { label: "이번달", from: clamp(monthStart, minDate, maxDate), to: maxDate },
    { label: "전체기간", from: minDate, to: maxDate },
  ];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; store?: string; channel?: string }>;
}) {
  const sp = await searchParams;
  const [bounds, stores] = await Promise.all([getDateBounds(), getStoreNames()]);
  const channels = getChannels();

  if (!bounds.min || !bounds.max) {
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

  const presets = buildPresets(bounds.min, bounds.max);
  const defaultRange = presets.find((p) => p.label === "최근 7일")!;

  const from = clamp(sp.from || defaultRange.from, bounds.min, bounds.max);
  const to = clamp(sp.to || defaultRange.to, bounds.min, bounds.max);
  const store = sp.store && sp.store !== "all" ? sp.store : null;
  const channel = sp.channel && sp.channel !== "all" ? sp.channel : null;

  const [items, dailyStats, combos] = await Promise.all([
    getItemsInRange(from, to, store, channel),
    getDailyStatsInRange(from, to, store, channel),
    getCombosInRange(from, to, store, channel),
  ]);

  const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  const orderCount = dailyStats.reduce((sum, d) => sum + d.order_count, 0);
  const statsRevenue = dailyStats.reduce((sum, d) => sum + d.total_revenue, 0);
  const avgTicket = orderCount > 0 ? Math.round(statsRevenue / orderCount) : null;

  const productTotals = new Map<string, { category: string; qty: number; revenue: number }>();
  for (const item of items) {
    const existing = productTotals.get(item.product_name);
    if (existing) {
      existing.qty += item.qty;
      existing.revenue += item.revenue;
    } else {
      productTotals.set(item.product_name, { category: item.category, qty: item.qty, revenue: item.revenue });
    }
  }
  const menuMix = [...productTotals.entries()]
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const categoryTotals = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const existing = categoryTotals.get(item.category);
    if (existing) {
      existing.qty += item.qty;
      existing.revenue += item.revenue;
    } else {
      categoryTotals.set(item.category, { qty: item.qty, revenue: item.revenue });
    }
  }
  const categoryMix = [...categoryTotals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const storeTotals = new Map<string, { qty: number; revenue: number; orderCount: number }>();
  for (const item of items) {
    if (!item.store_name) continue;
    const existing = storeTotals.get(item.store_name);
    if (existing) {
      existing.qty += item.qty;
      existing.revenue += item.revenue;
    } else {
      storeTotals.set(item.store_name, { qty: item.qty, revenue: item.revenue, orderCount: 0 });
    }
  }
  for (const d of dailyStats) {
    const existing = storeTotals.get(d.store_name);
    if (existing) existing.orderCount += d.order_count;
  }
  const storeMix = [...storeTotals.entries()]
    .map(([storeName, v]) => ({
      storeName,
      ...v,
      avgTicket: v.orderCount > 0 ? Math.round(v.revenue / v.orderCount) : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const trendMap = new Map<string, number>();
  for (const d of dailyStats) {
    trendMap.set(d.sale_date, (trendMap.get(d.sale_date) ?? 0) + d.total_revenue);
  }
  const trend = [...trendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, revenue]) => ({ label, revenue }));

  const comboTotals = new Map<string, number>();
  const flavorTotals = new Map<string, number>();
  for (const c of combos) {
    comboTotals.set(c.combo_label, (comboTotals.get(c.combo_label) ?? 0) + c.qty);
    for (const flavor of c.combo_label.split(" + ")) {
      flavorTotals.set(flavor, (flavorTotals.get(flavor) ?? 0) + c.qty);
    }
  }
  const comboMix = [...comboTotals.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty);
  const flavorMix = [...flavorTotals.entries()]
    .map(([label, qty]) => ({ label, qty }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">대시보드</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {from} ~ {to} · {store ?? "전체 매장"} · {channel ?? "전체 배달앱"}
        </p>
      </div>

      <FilterBar
        from={from}
        to={to}
        store={store ?? "all"}
        channel={channel ?? "all"}
        stores={stores}
        channels={channels}
        minDate={bounds.min}
        maxDate={bounds.max}
        presets={presets}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="총 매출" value={`${totalRevenue.toLocaleString()}원`} role="accent" />
        <MetricCard label="총 판매수량" value={`${totalQty.toLocaleString()}개`} />
        <MetricCard label="주문 건수" value={orderCount > 0 ? `${orderCount.toLocaleString()}건` : "-"} />
        <MetricCard label="건단가" value={avgTicket !== null ? `${avgTicket.toLocaleString()}원` : "-"} />
      </div>

      <TrendChart data={trend} />

      {!store && storeMix.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
          <p className="text-sm font-medium mb-4">매장별 매출 ({storeMix.length}개 매장)</p>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">매장</th>
                <th className="py-2 font-normal text-right">판매수량</th>
                <th className="py-2 font-normal text-right">매출</th>
                <th className="py-2 font-normal text-right">건단가</th>
                <th className="py-2 font-normal text-right">비중</th>
              </tr>
            </thead>
            <tbody>
              {storeMix.map((s) => (
                <tr key={s.storeName} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2">{s.storeName}</td>
                  <td className="py-2 text-right">{s.qty.toLocaleString()}</td>
                  <td className="py-2 text-right">{s.revenue.toLocaleString()}원</td>
                  <td className="py-2 text-right">{s.avgTicket !== null ? `${s.avgTicket.toLocaleString()}원` : "-"}</td>
                  <td className="py-2 text-right">
                    {totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
        <p className="text-sm font-medium mb-4">메뉴 믹스</p>
        <MenuMixSection menuMix={menuMix} categoryMix={categoryMix} />
      </div>

      {comboMix.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
          <ComboMixSection combos={comboMix} flavors={flavorMix} />
        </div>
      )}
    </div>
  );
}
