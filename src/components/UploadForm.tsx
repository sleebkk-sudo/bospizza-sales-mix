"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type QueueItem = {
  id: number;
  file: File;
  state:
    | { kind: "ready" }
    | { kind: "uploading" }
    | { kind: "done"; summary: string }
    | { kind: "error"; message: string };
};

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function describeResult(body: {
  kind?: string;
  rows: number;
  inserted?: number;
  totalRevenue?: number;
  periodStart?: string;
  periodEnd?: string;
  channels?: string[];
}): string {
  if (body.kind === "reviews") {
    return `리뷰 ${body.rows}건 중 ${body.inserted ?? 0}건 저장`;
  }
  const parts: string[] = [];
  if (body.channels && body.channels.length > 0) parts.push(body.channels.join("·"));
  if (body.periodStart && body.periodEnd) {
    parts.push(
      body.periodStart === body.periodEnd
        ? shortDate(body.periodStart)
        : `${shortDate(body.periodStart)}~${shortDate(body.periodEnd)}`
    );
  }
  parts.push(`${body.rows.toLocaleString()}행`);
  parts.push(`${(body.totalRevenue ?? 0).toLocaleString()}원`);
  return parts.join(" · ");
}

export function UploadForm() {
  const router = useRouter();
  const nextId = useRef(1);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [result, setResult] = useState<{ done: number; failed: number } | null>(null);

  // 파일을 고르거나 드래그해도 바로 올리지 않고 목록에만 담는다 — 잘못 고른 파일을
  // 빼거나 배민·요기요 파일을 한 번에 모아 올릴 수 있게, 실제 저장은 "등록" 버튼을
  // 눌렀을 때만 한다.
  function addFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setResult(null);
    setQueue((prev) => [
      // 이전 등록에서 끝난 항목은 새 파일을 담을 때 목록에서 치운다.
      ...prev.filter((q) => q.state.kind === "ready" || q.state.kind === "uploading"),
      ...list.map((file) => ({ id: nextId.current++, file, state: { kind: "ready" } as const })),
    ]);
  }

  function setItemState(id: number, state: QueueItem["state"]) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, state } : q)));
  }

  async function uploadOne(item: QueueItem): Promise<boolean> {
    setItemState(item.id, { kind: "uploading" });

    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("periodStart", periodStart);
    formData.append("periodEnd", periodEnd);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        const message =
          body?.error ??
          (res.status === 413
            ? "파일이 너무 큽니다. 기간을 나눠서 내려받아 주세요."
            : `등록에 실패했습니다. (${res.status})`);
        setItemState(item.id, { kind: "error", message });
        return false;
      }
      setItemState(item.id, { kind: "done", summary: describeResult(body) });
      return true;
    } catch {
      setItemState(item.id, { kind: "error", message: "서버에 연결하지 못했습니다." });
      return false;
    }
  }

  async function registerAll() {
    const targets = queue.filter((q) => q.state.kind === "ready");
    if (targets.length === 0 || isRegistering) return;

    setIsRegistering(true);
    setResult(null);
    let done = 0;
    let failed = 0;
    // 같은 날짜를 담은 파일이 섞여 있어도 결과가 뒤바뀌지 않도록 한 개씩 차례로 올린다.
    for (const item of targets) {
      if (await uploadOne(item)) done++;
      else failed++;
    }
    setIsRegistering(false);
    setResult({ done, failed });
    router.refresh();
  }

  const readyCount = queue.filter((q) => q.state.kind === "ready").length;

  return (
    <div className="space-y-4 max-w-xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver
            ? "border-[var(--fill-accent)] bg-[var(--bg-neutral)]"
            : "border-[var(--border-strong)]"
        }`}
      >
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          요기요·배민 매출 파일이나 배민 리뷰 목록 파일을 여기로 드래그하세요. 여러 개를 한
          번에 담을 수 있고, 아래 &quot;등록&quot; 버튼을 눌러야 반영됩니다.
        </p>
        <label className="inline-block h-9 px-4 leading-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm font-medium cursor-pointer">
          파일 선택
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
      </div>

      {queue.length > 0 && (
        <ul className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)]">
          {queue.map((q) => (
            <li key={q.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm break-all">{q.file.name}</p>
                {q.state.kind === "done" && (
                  <p className="text-xs text-[var(--text-success)] mt-1">{q.state.summary}</p>
                )}
                {q.state.kind === "error" && (
                  <p className="text-xs text-[var(--text-danger)] mt-1">{q.state.message}</p>
                )}
              </div>
              {q.state.kind === "ready" && (
                <>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-neutral)] text-[var(--text-neutral)]">
                    등록 대기
                  </span>
                  <button
                    type="button"
                    onClick={() => setQueue((prev) => prev.filter((x) => x.id !== q.id))}
                    disabled={isRegistering}
                    aria-label={`${q.file.name} 빼기`}
                    className="shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    빼기
                  </button>
                </>
              )}
              {q.state.kind === "uploading" && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-warning)] text-[var(--text-warning)]">
                  등록 중…
                </span>
              )}
              {q.state.kind === "done" && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-success)] text-[var(--text-success)]">
                  완료
                </span>
              )}
              {q.state.kind === "error" && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-danger)] text-[var(--text-danger)]">
                  실패
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void registerAll()}
        disabled={readyCount === 0 || isRegistering}
        className="h-10 px-6 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isRegistering ? "등록 중…" : readyCount > 0 ? `등록 (${readyCount}개)` : "등록"}
      </button>

      <div role="status" aria-live="polite">
        {result && result.failed === 0 && (
          <p className="rounded-md px-4 py-3 text-sm font-medium bg-[var(--bg-success)] text-[var(--text-success)]">
            등록이 완료되었습니다. ({result.done}개 파일) 아래 등록 상태에서 날짜를 확인하세요.
          </p>
        )}
        {result && result.failed > 0 && (
          <p className="rounded-md px-4 py-3 text-sm font-medium bg-[var(--bg-danger)] text-[var(--text-danger)]">
            {result.done > 0
              ? `${result.done}개는 등록됐고 ${result.failed}개는 실패했습니다.`
              : `등록에 실패했습니다. (${result.failed}개 파일)`}{" "}
            실패한 파일의 사유를 확인하세요.
          </p>
        )}
      </div>

      <details className="text-sm text-[var(--text-secondary)]">
        <summary className="cursor-pointer select-none">자체 4컬럼 템플릿 업로드 시 기간 입력</summary>
        <div className="space-y-3 mt-3 max-w-md">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">기간 시작일</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">기간 종료일</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
