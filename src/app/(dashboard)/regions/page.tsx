import Link from "next/link";
import { format, subDays, startOfMonth } from "date-fns";
import { MetricCard } from "@/components/MetricCard";
import { FilterBar } from "@/components/FilterBar";
import { RegionCompare } from "@/components/RegionCompare";
import { getChannels, getDateBounds, getRegionStats } from "@/lib/data";
import { quantile, toRegionStore } from "@/lib/regions";

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

// 지역 비교는 하루치로 보면 매장별 편차가 너무 커서 기본을 "최근 4주"로 둔다 —
// 요일 구성이 매장마다 같아지도록 7일 단위로 끊는다.
function buildPresets(minDate: string, maxDate: string) {
  const max = new Date(`${maxDate}T00:00:00Z`);
  return [
    { label: "최근 7일", from: clamp(fmt(subDays(max, 6)), minDate, maxDate), to: maxDate },
    { label: "최근 4주", from: clamp(fmt(subDays(max, 27)), minDate, maxDate), to: maxDate },
    { label: "이번달", from: clamp(fmt(startOfMonth(max)), minDate, maxDate), to: maxDate },
    { label: "전체기간", from: minDate, to: maxDate },
  ];
}

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; channel?: string }>;
}) {
  const sp = await searchParams;
  const bounds = await getDateBounds();
  const channels = getChannels();

  if (!bounds.min || !bounds.max) {
    return (
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)] mb-4">아직 업로드된 매출 데이터가 없습니다.</p>
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
  const defaultRange = presets.find((p) => p.label === "최근 4주")!;
  const from = clamp(sp.from || defaultRange.from, bounds.min, bounds.max);
  const to = clamp(sp.to || defaultRange.to, bounds.min, bounds.max);
  const channel = sp.channel && sp.channel !== "all" ? sp.channel : null;
  const periodDays =
    Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;

  const rows = (await getRegionStats(from, to, channel)).filter((r) => r.orders > 0);

  // 전체 배달앱으로 볼 때 배민 주문이 하나도 없는 매장은 배민 리포트에 안 잡히는 매장이라
  // (전체 매장 중 일부만 리포트에 들어온다) 요기요 실적만으로 다른 매장과 비교하면 실제보다
  // 훨씬 낮게 나온다 — 비교에서 빼고 몇 곳인지만 알려준다.
  const comparable = channel === null ? rows.filter((r) => r.baeminOrders > 0) : rows;
  const excludedNoBaemin = rows.length - comparable.length;
  const unassigned = comparable.filter((r) => !r.areaType).map((r) => r.storeName);
  const stores = comparable.filter((r) => r.areaType).map(toRegionStore);

  const perDay = stores.map((s) => s.pizzasPerDay);
  const median = quantile(perDay, 0.5);
  const topCut = quantile(perDay, 0.75);
  const bottomCut = quantile(perDay, 0.25);
  const mean = perDay.length > 0 ? perDay.reduce((a, b) => a + b, 0) / perDay.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">지역별 비교</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {from} ~ {to} ({periodDays}일) · {channel ?? "전체 배달앱"} · 매장당 하루 피자 판수 기준
        </p>
      </div>

      <FilterBar
        basePath="/regions"
        showStore={false}
        from={from}
        to={to}
        store="all"
        channel={channel ?? "all"}
        stores={[]}
        channels={channels}
        minDate={bounds.min}
        maxDate={bounds.max}
        presets={presets}
      />

      {stores.length === 0 ? (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">이 기간에 비교할 매장 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="비교 매장" value={`${stores.length.toLocaleString()}곳`} role="accent" />
            <MetricCard label="하루 판수 중간값" value={`${median.toFixed(1)}판`} />
            <MetricCard label="하루 판수 평균" value={`${mean.toFixed(1)}판`} />
            <MetricCard label="상위 25% 기준" value={`${topCut.toFixed(1)}판 이상`} />
          </div>

          <RegionCompare
            stores={stores}
            topCut={topCut}
            bottomCut={bottomCut}
            periodDays={periodDays}
            showYogiyoShare={channel === null}
          />

          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <p>
              배달앱 주문만 집계합니다 (포장·홀·전화 주문 제외). 기간 도중에 처음 데이터가 잡힌 매장은 그날부터의
              일수로 나눕니다.
            </p>
            {excludedNoBaemin > 0 && (
              <p>배민 주문이 없는 {excludedNoBaemin}곳은 배민 리포트에 잡히지 않는 매장으로 보고 비교에서 뺐습니다.</p>
            )}
            {unassigned.length > 0 && (
              <p className="text-[var(--text-danger)]">
                지역 미지정 {unassigned.length}곳 (비교에서 제외): {unassigned.join(", ")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
