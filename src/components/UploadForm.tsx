"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "success"; rows: number; totalRevenue: number }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus({ kind: "loading" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("periodStart", periodStart);
    formData.append("periodEnd", periodEnd);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const body = await res.json();

    if (!res.ok) {
      setStatus({ kind: "error", message: body.error ?? "업로드에 실패했습니다." });
      return;
    }

    setStatus({ kind: "success", rows: body.rows, totalRevenue: body.totalRevenue });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-2">
          기간 시작일 <span className="text-[var(--text-muted)]">(브랜드 리포트는 파일에서 자동 인식, 비워둬도 됨)</span>
        </label>
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-2">
          기간 종료일 <span className="text-[var(--text-muted)]">(자체 템플릿 업로드 시에만 필요)</span>
        </label>
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="w-full h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
        />
      </div>
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-2">
          매출 파일 (.xlsx / .csv)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={status.kind === "loading"}
        className="h-9 px-4 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium disabled:opacity-60"
      >
        {status.kind === "loading" ? "업로드 중..." : "업로드"}
      </button>

      {status.kind === "error" && (
        <p className="text-sm text-[var(--text-danger)]">{status.message}</p>
      )}
      {status.kind === "success" && (
        <p className="text-sm text-[var(--text-success)]">
          {status.rows}개 메뉴, 총 {status.totalRevenue.toLocaleString()}원 저장 완료. 대시보드에서 확인하세요.
        </p>
      )}
    </form>
  );
}
