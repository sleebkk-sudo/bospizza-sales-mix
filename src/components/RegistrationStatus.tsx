import { REGISTRATION_CHANNELS, type RegistrationDay } from "@/lib/data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function dayLabel(iso: string) {
  const [, m, d] = iso.split("-");
  const weekday = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return `${Number(m)}/${Number(d)} (${weekday})`;
}

// 업로드 화면 하단의 "등록 상태" — 날짜마다 배민·요기요 데이터가 들어와 있는지 보여준다.
// days는 최신 날짜가 먼저 오는 순서.
export function RegistrationStatus({ days }: { days: RegistrationDay[] }) {
  const summaries = REGISTRATION_CHANNELS.map((channel) => {
    const latest = days.find((d) => d.byChannel[channel])?.date ?? null;
    const missing = days.filter((d) => !d.byChannel[channel]).map((d) => d.date);
    return { channel, latest, missing };
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold mb-1">등록 상태</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          최근 {days.length}일의 날짜별 배민·요기요 등록 여부입니다. 등록을 마치면 바로 갱신됩니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((s) => (
          <div key={s.channel} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-medium mb-1">{s.channel}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              최근 등록일: {s.latest ? dayLabel(s.latest) : "없음"}
            </p>
            {s.missing.length === 0 ? (
              <p className="text-sm text-[var(--text-success)] mt-1">빠진 날짜 없음</p>
            ) : (
              <p className="text-sm text-[var(--text-danger)] mt-1">
                미등록 {s.missing.length}일: {s.missing.slice(0, 5).map(dayLabel).join(", ")}
                {s.missing.length > 5 ? ` 외 ${s.missing.length - 5}일` : ""}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface-1)] text-[var(--text-secondary)]">
              <th scope="col" className="text-left font-medium px-3 sm:px-4 py-2 whitespace-nowrap">
                날짜
              </th>
              {REGISTRATION_CHANNELS.map((channel) => (
                <th key={channel} scope="col" className="text-left font-medium px-3 sm:px-4 py-2">
                  {channel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-t border-[var(--border)]">
                <th scope="row" className="text-left font-normal px-3 sm:px-4 py-2 whitespace-nowrap tabular-nums">
                  {dayLabel(day.date)}
                </th>
                {REGISTRATION_CHANNELS.map((channel) => {
                  const cell = day.byChannel[channel];
                  return (
                    <td key={channel} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                      {cell ? (
                        <>
                          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--bg-success)] text-[var(--text-success)]">
                            등록
                          </span>
                          <span className="ml-2 text-xs text-[var(--text-muted)] tabular-nums">
                            {cell.orders.toLocaleString()}건
                            {/* 좁은 화면에서는 표가 옆으로 넘치지 않게 매출은 숨긴다. */}
                            <span className="hidden sm:inline"> · {cell.revenue.toLocaleString()}원</span>
                          </span>
                        </>
                      ) : (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--bg-danger)] text-[var(--text-danger)]">
                          미등록
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
