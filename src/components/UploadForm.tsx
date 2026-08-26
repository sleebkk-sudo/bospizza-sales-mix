"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "success"; rows: number; totalRevenue: number }
  >({ kind: "idle" });

  // 드래그로 넣든 클릭해서 고르든, 파일이 정해지는 즉시 바로 업로드한다 — 브랜드
  // 리포트(요기요/배민)는 채널·기간을 파일에서 자동 인식하므로 "업로드" 버튼을 따로
  // 누르게 할 필요가 없다. periodStart/periodEnd는 자체 4컬럼 템플릿에서만 쓰인다.
  async function submitFile(file: File) {
    setFileName(file.name);
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void submitFile(file);
  }

  return (
    <div className="space-y-4 max-w-md">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver
            ? "border-[var(--fill-accent)] bg-[var(--bg-neutral)]"
            : "border-[var(--border-strong)]"
        }`}
      >
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          요기요·배민 파일을 여기로 드래그하면 채널·기간을 자동 인식해서 바로 반영합니다.
        </p>
        <label className="inline-block h-9 px-4 leading-9 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium cursor-pointer">
          파일 선택
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void submitFile(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
        {fileName && <p className="text-xs text-[var(--text-muted)] mt-3">{fileName}</p>}
      </div>

      <details className="text-sm text-[var(--text-secondary)]">
        <summary className="cursor-pointer select-none">자체 4컬럼 템플릿 업로드 시 기간 입력</summary>
        <div className="space-y-3 mt-3">
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

      {status.kind === "loading" && <p className="text-sm text-[var(--text-secondary)]">업로드 중...</p>}
      {status.kind === "error" && <p className="text-sm text-[var(--text-danger)]">{status.message}</p>}
      {status.kind === "success" && (
        <p className="text-sm text-[var(--text-success)]">
          {status.rows}개 메뉴, 총 {status.totalRevenue.toLocaleString()}원 저장 완료. 대시보드에서 확인하세요.
        </p>
      )}
    </div>
  );
}
