import Link from "next/link";
import { CHANNEL_STORE_COVERAGE, REGISTRATION_CHANNELS, type RegistrationDay } from "@/lib/data";
import { dayLabel } from "@/components/RegistrationStatus";

// 대시보드 홈에서 지금 보고 있는 기간(필터의 from~to)에 배민·요기요 파일이 모두 올라와
// 있는지 한눈에 보여준다. days는 그 기간의 날짜별 등록 상태(최신 날짜가 먼저).
export function UploadStatusBar({ days }: { days: RegistrationDay[] }) {
  if (days.length === 0) return null;
  const isSingleDay = days.length === 1;

  const channels = REGISTRATION_CHANNELS.map((channel) => {
    const registered = days.filter((d) => d.byChannel[channel]);
    const missing = days.filter((d) => !d.byChannel[channel]).map((d) => d.date);
    const storeCounts = registered.map((d) => d.byChannel[channel]!.stores);
    const avgStores =
      storeCounts.length > 0 ? Math.round(storeCounts.reduce((a, b) => a + b, 0) / storeCounts.length) : 0;
    const state: "done" | "partial" | "none" =
      missing.length === 0 ? "done" : registered.length === 0 ? "none" : "partial";
    return { channel, registered: registered.length, missing, avgStores, state, coverage: CHANNEL_STORE_COVERAGE[channel] };
  });
  const anyMissing = channels.some((c) => c.state !== "done");

  const badge = {
    done: { label: "업로드 완료", className: "bg-[var(--bg-success)] text-[var(--text-success)]" },
    partial: { label: "일부 미등록", className: "bg-[var(--bg-warning)] text-[var(--text-warning)]" },
    none: { label: "미등록", className: "bg-[var(--bg-danger)] text-[var(--text-danger)]" },
  };

  return (
    <section
      aria-label="업로드 상태"
      className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          업로드 상태{" "}
          <span className="font-normal text-[var(--text-muted)]">
            {isSingleDay ? dayLabel(days[0].date) : `${dayLabel(days[days.length - 1].date)} ~ ${dayLabel(days[0].date)}`}
          </span>
        </p>
        {anyMissing && (
          <Link href="/upload" className="text-sm text-[var(--text-accent)] underline underline-offset-2">
            업로드 화면으로
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {channels.map((c) => (
          <div key={c.channel} className="rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{c.channel}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${badge[c.state].className}`}>
                {badge[c.state].label}
              </span>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              {isSingleDay
                ? c.state === "done"
                  ? "이 날짜 데이터가 등록돼 있습니다."
                  : "이 날짜 데이터가 아직 없습니다."
                : `${days.length}일 중 ${c.registered}일 등록`}
            </p>

            {c.missing.length > 0 && !isSingleDay && (
              <p className="text-sm text-[var(--text-danger)]">
                미등록: {c.missing.slice(0, 5).map(dayLabel).join(", ")}
                {c.missing.length > 5 ? ` 외 ${c.missing.length - 5}일` : ""}
              </p>
            )}

            {c.registered > 0 && (
              <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                {isSingleDay ? "주문 발생 매장" : "주문 발생 매장 하루 평균"} {c.avgStores.toLocaleString()}개
                {c.coverage
                  ? ` · 집계 가능 ${c.coverage.reportable.toLocaleString()}개 / 전체 ${c.coverage.total.toLocaleString()}개점`
                  : ""}
              </p>
            )}
            {c.registered === 0 && c.coverage && (
              <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                집계 가능 {c.coverage.reportable.toLocaleString()}개 / 전체 {c.coverage.total.toLocaleString()}개점
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
