import Link from "next/link";
import { format, subDays, startOfMonth } from "date-fns";
import { MetricCard } from "@/components/MetricCard";
import { FilterBar } from "@/components/FilterBar";
import { MenuMixSection } from "@/components/MenuMixSection";
import { ComboMixSection } from "@/components/ComboMixSection";
import { OptionMixSection } from "@/components/OptionMixSection";
import { TrendChart } from "@/components/TrendChart";
import { getDateBounds, getStoreNames, getChannels, getDashboardData, getOptionCategories } from "@/lib/data";
import { normalizeOptionName, isCatalogOption } from "@/lib/optionPriceCatalog";

export const dynamic = "force-dynamic";
// Supabase 프로젝트가 ap-southeast-1(싱가포르)에 있어 같은 지역에서 실행해야 DB 왕복이 짧다.
export const preferredRegion = "sin1";

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

  const data = await getDashboardData(from, to, store, channel);
  const optionCategories = getOptionCategories();

  const menuMix = data.menu;
  const totalRevenue = menuMix.reduce((sum, m) => sum + m.revenue, 0);
  const pizzaQty = menuMix.filter((m) => m.category === "피자").reduce((sum, m) => sum + m.qty, 0);
  const orderCount = data.orderCount;
  const avgTicket = orderCount > 0 ? Math.round(data.statsRevenue / orderCount) : null;
  const pizzasPerOrder = orderCount > 0 ? pizzaQty / orderCount : null;

  const categoryTotals = new Map<string, { qty: number; revenue: number }>();
  for (const m of menuMix) {
    const existing = categoryTotals.get(m.category);
    if (existing) {
      existing.qty += m.qty;
      existing.revenue += m.revenue;
    } else {
      categoryTotals.set(m.category, { qty: m.qty, revenue: m.revenue });
    }
  }
  const categoryMix = [...categoryTotals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const storeMix = data.stores.map((s) => ({
    ...s,
    avgTicket: s.orderCount > 0 ? Math.round(s.revenue / s.orderCount) : null,
  }));

  const trend = data.trend;

  const optionMixByCategory: Record<string, { name: string; qty: number; revenue: number }[]> = {};
  for (const category of optionCategories) {
    const totalsByName = new Map<string, { qty: number; revenue: number }>();
    for (const o of data.options) {
      if (o.category !== category) continue;
      // 정식 옵션 가격표에 없는 옵션(오분류·원본 표기 차이로 섞여든 값)은 노출하지 않는다.
      if (!isCatalogOption(category, o.name)) continue;
      const name = normalizeOptionName(category, o.name);
      const existing = totalsByName.get(name);
      if (existing) {
        existing.qty += o.qty;
        existing.revenue += o.revenue;
      } else {
        totalsByName.set(name, { qty: o.qty, revenue: o.revenue });
      }
    }
    optionMixByCategory[category] = [...totalsByName.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }

  // 반반피자 두 번째 맛에는 "(반반)"/"(반/반)" 접미어가 붙어 나올 때가 있고, 두 맛의
  // 저장 순서가 store/date별로 뒤바뀌어 있을 수도 있어 — 집계 전에 항상 같은 규칙(접미어
  // 제거 + 가나다순 정렬)으로 라벨을 다시 만들어야 같은 조합/맛이 갈라지지 않는다.
  function canonicalComboLabel(comboLabel: string): string {
    return comboLabel
      .split(" + ")
      .map((flavor) => flavor.replace(/\(반\/?반\)$/, ""))
      .sort((a, b) => a.localeCompare(b, "ko"))
      .join(" + ");
  }

  const comboTotals = new Map<string, number>();
  const flavorTotals = new Map<string, number>();
  for (const c of data.combos) {
    const label = canonicalComboLabel(c.label);
    comboTotals.set(label, (comboTotals.get(label) ?? 0) + c.qty);
    for (const flavor of label.split(" + ")) {
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MetricCard label="총 매출" value={`${totalRevenue.toLocaleString()}원`} role="accent" />
        <MetricCard label="총 피자판수" value={`${pizzaQty.toLocaleString()}개`} />
        <MetricCard label="주문 건수" value={orderCount > 0 ? `${orderCount.toLocaleString()}건` : "-"} />
        <MetricCard label="건단가" value={avgTicket !== null ? `${avgTicket.toLocaleString()}원` : "-"} />
        <MetricCard label="건당 판수" value={pizzasPerOrder !== null ? `${pizzasPerOrder.toFixed(2)}개` : "-"} />
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

      {data.options.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
          <OptionMixSection categories={[...optionCategories]} mixByCategory={optionMixByCategory} />
        </div>
      )}
    </div>
  );
}
