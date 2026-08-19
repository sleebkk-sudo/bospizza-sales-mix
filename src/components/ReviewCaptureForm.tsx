"use client";

import { useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { extractReviewsFromImage, type ExtractedReview } from "@/lib/reviewOcr";
import { submitReviews } from "@/app/(dashboard)/reviews/actions";

const inputClass =
  "h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]";

type Draft = ExtractedReview & { id: number };

let nextId = 1;

export function ReviewCaptureForm({ stores, channels }: { stores: string[]; channels: readonly string[] }) {
  const [storeName, setStoreName] = useState(stores[0] ?? "");
  const [channel, setChannel] = useState<string>(channels[channels.length - 1] ?? channels[0]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<{ kind: "idle" } | { kind: "saving" } | { kind: "done"; count: number } | { kind: "error"; message: string }>({
    kind: "idle",
  });

  async function handleCapture(file: File) {
    setOcrStatus("running");
    try {
      const extracted = await extractReviewsFromImage(file);
      if (extracted.length === 0) {
        setOcrStatus("error");
        return;
      }
      setDrafts((prev) => [...prev, ...extracted.map((r) => ({ ...r, id: nextId++ }))]);
      setOcrStatus("done");
    } catch {
      setOcrStatus("error");
    }
  }

  function updateDraft(id: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: number) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  function addBlankDraft() {
    setDrafts((prev) => [
      ...prev,
      { id: nextId++, date: new Date().toISOString().slice(0, 10), rating: undefined, text: "" },
    ]);
  }

  async function handleSave() {
    if (!storeName || drafts.length === 0) return;
    setSaveStatus({ kind: "saving" });
    const formData = new FormData();
    formData.set("storeName", storeName);
    formData.set("channel", channel);
    formData.set(
      "drafts",
      JSON.stringify(
        drafts.map((d) => ({
          date: d.date || new Date().toISOString().slice(0, 10),
          rating: d.rating ?? null,
          text: d.text,
          orderMenu: d.orderMenu ?? null,
        }))
      )
    );
    const result = await submitReviews(formData);
    if (result.ok) {
      setSaveStatus({ kind: "done", count: result.inserted ?? drafts.length });
      setDrafts([]);
    } else {
      setSaveStatus({ kind: "error", message: result.error ?? "저장에 실패했습니다." });
    }
  }

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-4">
      <p className="text-sm font-medium">리뷰 캡처 입력</p>

      <div className="flex flex-wrap gap-2">
        <input
          list="store-options"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="매장명 (예: 보스피자-갈산점)"
          className={`${inputClass} flex-1 min-w-[180px]`}
        />
        <datalist id="store-options">
          {stores.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <CaptureInput onFileSelected={handleCapture} />
      {ocrStatus === "running" && (
        <p className="text-xs text-[var(--text-secondary)]">이미지에서 리뷰를 읽는 중이에요...</p>
      )}
      {ocrStatus === "done" && (
        <p className="text-xs text-[var(--text-warning)]">
          자동으로 리뷰를 추출했어요. 저장 전에 날짜·별점·내용이 맞는지 꼭 확인해주세요.
        </p>
      )}
      {ocrStatus === "error" && (
        <p className="text-xs text-[var(--text-muted)]">
          이미지에서 리뷰를 읽지 못했어요. 아래 &quot;직접 추가&quot;로 입력해주세요.
        </p>
      )}

      {drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="border border-[var(--border)] rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="date"
                  value={d.date ?? ""}
                  onChange={(e) => updateDraft(d.id, { date: e.target.value })}
                  className={inputClass}
                />
                <select
                  value={d.rating ?? ""}
                  onChange={(e) => updateDraft(d.id, { rating: e.target.value ? Number(e.target.value) : undefined })}
                  className={inputClass}
                >
                  <option value="">별점 없음</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}점
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  className="text-xs text-[var(--text-danger)] ml-auto"
                >
                  삭제
                </button>
              </div>
              <textarea
                value={d.text}
                onChange={(e) => updateDraft(d.id, { text: e.target.value })}
                placeholder="리뷰 내용"
                rows={2}
                className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
              />
              <input
                type="text"
                value={d.orderMenu ?? ""}
                onChange={(e) => updateDraft(d.id, { orderMenu: e.target.value })}
                placeholder="주문 메뉴 (선택)"
                className={`${inputClass} w-full`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addBlankDraft}
          className="h-9 px-3 rounded-md border border-[var(--border-strong)] text-sm"
        >
          직접 추가
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={drafts.length === 0 || saveStatus.kind === "saving"}
          className="h-9 px-4 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium disabled:opacity-60"
        >
          {saveStatus.kind === "saving" ? "저장 중..." : `리뷰 ${drafts.length}건 저장`}
        </button>
      </div>

      {saveStatus.kind === "done" && (
        <p className="text-sm text-[var(--text-success)]">{saveStatus.count}건 저장했습니다.</p>
      )}
      {saveStatus.kind === "error" && <p className="text-sm text-[var(--text-danger)]">{saveStatus.message}</p>}
    </div>
  );
}
