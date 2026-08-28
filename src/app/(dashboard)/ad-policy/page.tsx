import Link from "next/link";
import { format, subDays, startOfMonth } from "date-fns";
import { getAdCampaigns, getDateBounds, getItemsInRange, getReviewsInRange } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function clamp(date: string, min: string, max: string) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

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

function fmtPct(v: number | null) {
  return v !== null ? `${v}%` : "-";
}

export default async function AdPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const [campaigns, bounds] = await Promise.all([getAdCampaigns(), getDateBounds()]);

  const hasData = !!bounds.min && !!bounds.max;
  const today = fmt(new Date());
  const minDate = bounds.min ?? today;
  const maxDate = bounds.max ?? today;
  const presets = buildPresets(minDate, maxDate);
  const defaultRange = presets.find((p) => p.label === "최근 7일")!;

  const from = clamp(sp.from || defaultRange.from, minDate, maxDate);
  const to = clamp(sp.to || defaultRange.to, minDate, maxDate);

  const [items, reviews] = hasData
    ? await Promise.all([getItemsInRange(from, to, null, null), getReviewsInRange(from, to, null, null, null)])
    : [[], []];

  const revenueByStore = new Map<string, number>();
  for (const item of items) {
    if (!item.store_name) continue;
    revenueByStore.set(item.store_name, (revenueByStore.get(item.store_name) ?? 0) + item.revenue);
  }
  const reviewCountByStore = new Map<string, number>();
  for (const r of reviews) {
    reviewCountByStore.set(r.store_name, (reviewCountByStore.get(r.store_name) ?? 0) + 1);
  }

  function buildHref(f: string, t: string) {
    const p = new URLSearchParams();
    p.set("from", f);
    p.set("to", t);
    return `/ad-policy?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">광고정책</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {from} ~ {to} · 매장별 할인정책·광고정책과 기간 내 매출·리뷰수를 함께 봅니다.
        </p>
      </div>

      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text-secondary)]">
        광고매출·총할인금액은 아직 자동 수집이 연결되지 않아 표시되지 않습니다. 할인정책은 전 매장 공통 상점부담
        쿠폰(6,000원) 기준이며, 매장별 즉시할인 설정은 아직 반영 전입니다.
      </div>

      {hasData && (
        <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Link
                key={p.label}
                href={buildHref(p.from, p.to)}
                className="text-xs px-2.5 py-1.5 rounded-md border"
                style={
                  from === p.from && to === p.to
                    ? { background: "var(--surface-1)", borderColor: "var(--border-strong)", fontWeight: 600 }
                    : { color: "var(--text-secondary)", borderColor: "var(--border)" }
                }
              >
                {p.label}
              </Link>
            ))}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2" key={`${from}|${to}`}>
            <input
              type="date"
              name="from"
              defaultValue={from}
              min={minDate}
              max={to}
              className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
            />
            <span className="text-xs text-[var(--text-muted)]">~</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              min={from}
              max={maxDate}
              className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
            />
            <button type="submit" className="h-8 px-3 rounded-md bg-[var(--fill-accent)] text-white text-xs font-medium">
              적용
            </button>
          </form>
        </div>
      )}

      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
        {campaigns.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6 text-center">아직 등록된 광고정책이 없습니다.</p>
        ) : (
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="py-2 font-normal">매장명</th>
                <th className="py-2 font-normal">할인정책</th>
                <th className="py-2 font-normal">광고 꺼짐/켜짐</th>
                <th className="py-2 font-normal">광고 기간</th>
                <th className="py-2 font-normal text-right">전체 고객 CPS%</th>
                <th className="py-2 font-normal text-right">재주문 고객 CPS%</th>
                <th className="py-2 font-normal text-right">신규 고객 CPS%</th>
                <th className="py-2 font-normal text-right">리뷰수</th>
                <th className="py-2 font-normal text-right">총매출</th>
                <th className="py-2 font-normal text-right">광고매출</th>
                <th className="py-2 font-normal text-right">총할인금액</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.store_name} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 whitespace-nowrap">{c.store_name}</td>
                  <td className="py-2 whitespace-nowrap">쿠폰 6,000원</td>
                  <td className="py-2 whitespace-nowrap">{c.is_active ? "ON" : "OFF"}</td>
                  <td className="py-2 whitespace-nowrap">
                    {c.campaign_started_at ? `${c.campaign_started_at.replaceAll("-", ".")} ~` : "-"}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_all)}</td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_reorder)}</td>
                  <td className="py-2 whitespace-nowrap text-right">{fmtPct(c.cps_new)}</td>
                  <td className="py-2 whitespace-nowrap text-right">
                    {(reviewCountByStore.get(c.store_name) ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right">
                    {(revenueByStore.get(c.store_name) ?? 0).toLocaleString()}원
                  </td>
                  <td className="py-2 whitespace-nowrap text-right text-[var(--text-muted)]">-</td>
                  <td className="py-2 whitespace-nowrap text-right text-[var(--text-muted)]">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
