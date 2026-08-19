import { format, subDays } from "date-fns";
import {
  getReviewDateBounds,
  getReviewStoreNames,
  getReviewsInRange,
  getChannels,
  getStoreNames,
} from "@/lib/data";
import { ReviewCaptureForm } from "@/components/ReviewCaptureForm";
import { MetricCard } from "@/components/MetricCard";

export const dynamic = "force-dynamic";

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "긍정",
  neutral: "중립",
  negative: "부정",
};

function fmt(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function clamp(date: string, min: string, max: string) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; store?: string; channel?: string; sentiment?: string }>;
}) {
  const sp = await searchParams;
  const [bounds, reviewStores, salesStores, channels] = await Promise.all([
    getReviewDateBounds(),
    getReviewStoreNames(),
    getStoreNames(),
    getChannels(),
  ]);

  const allStores = [...new Set([...salesStores, ...reviewStores])].sort((a, b) => a.localeCompare(b, "ko"));

  const hasData = !!bounds.min && !!bounds.max;
  const today = fmt(new Date());
  const minDate = bounds.min ?? today;
  const maxDate = bounds.max ?? today;

  const from = clamp(sp.from || fmt(subDays(new Date(`${maxDate}T00:00:00Z`), 29)), minDate, maxDate);
  const to = clamp(sp.to || maxDate, minDate, maxDate);
  const store = sp.store && sp.store !== "all" ? sp.store : null;
  const channel = sp.channel && sp.channel !== "all" ? sp.channel : null;
  const sentiment = sp.sentiment && sp.sentiment !== "all" ? sp.sentiment : null;

  const reviews = hasData ? await getReviewsInRange(from, to, store, channel, sentiment) : [];

  const positiveCount = reviews.filter((r) => r.sentiment === "positive").length;
  const negativeCount = reviews.filter((r) => r.sentiment === "negative").length;
  const ratedCount = reviews.filter((r) => r.rating !== null).length;
  const avgRating =
    ratedCount > 0 ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / ratedCount : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">리뷰</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          배달앱 리뷰를 캡처해서 모으고, 날짜·매장·배달앱·긍정/부정으로 필터링해서 봅니다.
        </p>
      </div>

      <ReviewCaptureForm stores={allStores} channels={channels} />

      {hasData && (
        <>
          <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4">
            <form method="get" className="flex flex-wrap items-center gap-2">
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
              <select
                name="store"
                defaultValue={store ?? "all"}
                className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
              >
                <option value="all">전체 매장</option>
                {allStores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                name="channel"
                defaultValue={channel ?? "all"}
                className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
              >
                <option value="all">전체 배달앱</option>
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                name="sentiment"
                defaultValue={sentiment ?? "all"}
                className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
              >
                <option value="all">긍정/부정 전체</option>
                <option value="positive">긍정만</option>
                <option value="negative">부정만</option>
                <option value="neutral">중립만</option>
              </select>
              <button
                type="submit"
                className="h-8 px-3 rounded-md bg-[var(--fill-accent)] text-white text-xs font-medium"
              >
                적용
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="전체 리뷰" value={`${reviews.length.toLocaleString()}건`} />
            <MetricCard label="긍정" value={`${positiveCount.toLocaleString()}건`} role="success" />
            <MetricCard label="부정" value={`${negativeCount.toLocaleString()}건`} role="danger" />
            <MetricCard label="평균 별점" value={avgRating !== null ? avgRating.toFixed(1) : "-"} />
          </div>

          <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
            {reviews.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-6 text-center">
                선택한 조건에 해당하는 리뷰가 없습니다.
              </p>
            ) : (
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                    <th className="py-2 font-normal">날짜</th>
                    <th className="py-2 font-normal">매장</th>
                    <th className="py-2 font-normal">배달앱</th>
                    <th className="py-2 font-normal">별점</th>
                    <th className="py-2 font-normal">긍정/부정</th>
                    <th className="py-2 font-normal">내용</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 align-top">
                      <td className="py-2 whitespace-nowrap">{r.review_date}</td>
                      <td className="py-2 whitespace-nowrap">{r.store_name}</td>
                      <td className="py-2 whitespace-nowrap">{r.channel}</td>
                      <td className="py-2 whitespace-nowrap">{r.rating !== null ? `${r.rating}점` : "-"}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: `var(--bg-${r.sentiment === "positive" ? "success" : r.sentiment === "negative" ? "danger" : "neutral"})`,
                            color: `var(--text-${r.sentiment === "positive" ? "success" : r.sentiment === "negative" ? "danger" : "neutral"})`,
                          }}
                        >
                          {SENTIMENT_LABEL[r.sentiment]}
                        </span>
                      </td>
                      <td className="py-2">
                        {r.review_text}
                        {r.order_menu && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">주문: {r.order_menu}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
