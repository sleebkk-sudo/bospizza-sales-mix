// 지역별 비교 화면에서 서버(page)와 클라이언트(RegionCompare)가 같이 쓰는 계산.
// 매장의 지역(시도·시군구·동네 유형)은 stores 테이블에 들어 있다 (supabase/store_regions.sql).

export type RegionStoreRow = {
  storeName: string;
  sido: string | null;
  sigungu: string | null;
  areaType: string | null;
  orders: number;
  revenue: number;
  pizzaQty: number;
  baeminOrders: number;
  yogiyoOrders: number;
  // 조회 기간 중 이 매장을 집계한 일수 — 기간 도중에 처음 데이터가 잡힌 매장은 그날부터 센다.
  days: number;
};

export type RegionStore = RegionStoreRow & {
  macro: string | null;
  pizzasPerDay: number;
  ordersPerDay: number;
  avgTicket: number | null;
};

const MACRO_BY_SIDO: Record<string, string> = {
  서울: "수도권",
  인천: "수도권",
  경기: "수도권",
  대전: "충청권",
  세종: "충청권",
  충남: "충청권",
  충북: "충청권",
  대구: "영남권",
  경북: "영남권",
  경남: "영남권",
  울산: "영남권",
  부산: "영남권",
  광주: "호남권",
  전북: "호남권",
  전남: "호남권",
  강원: "강원",
  제주: "제주",
};

export const REGION_DIMENSIONS = [
  { key: "areaType", label: "동네 유형" },
  { key: "macro", label: "권역" },
  { key: "sido", label: "시도" },
] as const;
export type RegionDimension = (typeof REGION_DIMENSIONS)[number]["key"];

export function toRegionStore(row: RegionStoreRow): RegionStore {
  const days = Math.max(1, row.days);
  return {
    ...row,
    days,
    macro: row.sido ? (MACRO_BY_SIDO[row.sido] ?? null) : null,
    pizzasPerDay: row.pizzaQty / days,
    ordersPerDay: row.orders / days,
    avgTicket: row.orders > 0 ? Math.round(row.revenue / row.orders) : null,
  };
}

// 0~1 사이 분위수 (선형 보간). 빈 배열이면 0.
export function quantile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type RegionGroup = {
  name: string;
  storeCount: number;
  medianPizzasPerDay: number;
  meanPizzasPerDay: number;
  avgTicket: number | null;
  yogiyoShare: number | null;
  topCount: number;
  bottomCount: number;
};

// 매장들을 한 기준(동네 유형/권역/시도)으로 묶어 "매장당 하루 판수"를 비교한다.
// 평균은 잘 파는 몇 매장에 끌려가므로 중간값을 기준으로 정렬한다. topCut/bottomCut은
// 전체 매장의 상위·하위 25% 경계 — 그 그룹에 잘 파는 매장이 몰려 있는지 보려는 것.
export function summarizeRegionGroups(
  stores: RegionStore[],
  dimension: RegionDimension,
  topCut: number,
  bottomCut: number
): RegionGroup[] {
  const groups = new Map<string, RegionStore[]>();
  for (const store of stores) {
    const name = store[dimension];
    if (!name) continue;
    const list = groups.get(name);
    if (list) list.push(store);
    else groups.set(name, [store]);
  }
  return [...groups.entries()]
    .map(([name, list]) => {
      const perDay = list.map((s) => s.pizzasPerDay);
      const orders = list.reduce((sum, s) => sum + s.orders, 0);
      const revenue = list.reduce((sum, s) => sum + s.revenue, 0);
      const yogiyo = list.reduce((sum, s) => sum + s.yogiyoOrders, 0);
      return {
        name,
        storeCount: list.length,
        medianPizzasPerDay: quantile(perDay, 0.5),
        meanPizzasPerDay: perDay.reduce((a, b) => a + b, 0) / list.length,
        avgTicket: orders > 0 ? Math.round(revenue / orders) : null,
        yogiyoShare: orders > 0 ? yogiyo / orders : null,
        topCount: list.filter((s) => s.pizzasPerDay >= topCut).length,
        bottomCount: list.filter((s) => s.pizzasPerDay <= bottomCut).length,
      };
    })
    .sort((a, b) => b.medianPizzasPerDay - a.medianPizzasPerDay);
}
