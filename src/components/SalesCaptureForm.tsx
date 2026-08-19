"use client";

import { useState } from "react";
import { CaptureInput } from "@/components/CaptureInput";
import { extractSalesCaptureFromImage, type ExtractedMenuLine } from "@/lib/salesOcr";
import { submitSalesCapture } from "@/app/(dashboard)/upload/capture-actions";

const inputClass =
  "h-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--fill-accent)]";

export function SalesCaptureForm({ stores }: { stores: string[] }) {
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [storeName, setStoreName] = useState(stores[0] ?? "");
  const [menuItems, setMenuItems] = useState<ExtractedMenuLine[]>([]);
  const [fallbackRevenue, setFallbackRevenue] = useState("");
  const [fallbackOrders, setFallbackOrders] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "done" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleCapture(file: File) {
    setOcrStatus("running");
    try {
      const result = await extractSalesCaptureFromImage(file);
      if (result.date) setSaleDate(result.date);
      if (result.menuItems.length > 0) {
        setMenuItems((prev) => [...prev, ...result.menuItems]);
      } else {
        if (result.revenue != null) setFallbackRevenue(String(result.revenue));
        if (result.orders != null) setFallbackOrders(String(result.orders));
      }
      setOcrStatus(result.menuItems.length > 0 || result.revenue != null ? "done" : "error");
    } catch {
      setOcrStatus("error");
    }
  }

  function updateItem(i: number, patch: Partial<ExtractedMenuLine>) {
    setMenuItems((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function removeItem(i: number) {
    setMenuItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!saleDate || !storeName) return;
    setSaveStatus({ kind: "saving" });
    const formData = new FormData();
    formData.set("saleDate", saleDate);
    formData.set("storeName", storeName);
    formData.set("channel", "쿠팡이츠");
    formData.set("menuItems", JSON.stringify(menuItems));
    formData.set("fallbackRevenue", fallbackRevenue);
    formData.set("fallbackOrders", fallbackOrders);
    const result = await submitSalesCapture(formData);
    if (result.ok) {
      setSaveStatus({ kind: "done" });
      setMenuItems([]);
      setFallbackRevenue("");
      setFallbackOrders("");
    } else {
      setSaveStatus({ kind: "error", message: result.error ?? "저장에 실패했습니다." });
    }
  }

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">쿠팡이츠 매출 캡처 입력</p>
        <p className="text-xs text-[var(--text-muted)]">
          개별 주문 영수증 캡처면 메뉴별로 자동 집계되고, 일별 요약 화면 캡처면 매출/주문수만 저장됩니다.
          같은 매장·날짜에 여러 번 캡처해도 값이 쌓입니다(덮어쓰지 않음).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={saleDate}
          onChange={(e) => setSaleDate(e.target.value)}
          className={inputClass}
        />
        <input
          list="capture-store-options"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="매장명 (예: 보스피자-갈산점)"
          className={`${inputClass} flex-1 min-w-[180px]`}
        />
        <datalist id="capture-store-options">
          {stores.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <CaptureInput onFileSelected={handleCapture} />
      {ocrStatus === "running" && (
        <p className="text-xs text-[var(--text-secondary)]">이미지에서 숫자를 읽는 중이에요...</p>
      )}
      {ocrStatus === "done" && (
        <p className="text-xs text-[var(--text-warning)]">
          자동으로 값을 채웠어요. 저장 전에 숫자가 맞는지 꼭 확인해주세요.
        </p>
      )}
      {ocrStatus === "error" && (
        <p className="text-xs text-[var(--text-muted)]">
          이미지에서 값을 읽지 못했어요. 아래 칸에 직접 입력해주세요.
        </p>
      )}

      {menuItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">읽은 메뉴 (수정 가능)</p>
          {menuItems.map((m, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <input
                value={m.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                className={`${inputClass} flex-1 min-w-[120px]`}
              />
              <input
                type="number"
                value={m.qty}
                onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
              <input
                type="number"
                value={m.revenue}
                onChange={(e) => updateItem(i, { revenue: Number(e.target.value) })}
                className={`${inputClass} w-28`}
              />
              <button type="button" onClick={() => removeItem(i)} className="text-xs text-[var(--text-danger)]">
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">매출액 (원)</label>
            <input
              type="number"
              value={fallbackRevenue}
              onChange={(e) => setFallbackRevenue(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">주문수</label>
            <input
              type="number"
              value={fallbackOrders}
              onChange={(e) => setFallbackOrders(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saveStatus.kind === "saving" || !storeName || !saleDate}
        className="h-9 px-4 rounded-md bg-[var(--fill-accent)] text-white text-sm font-medium disabled:opacity-60"
      >
        {saveStatus.kind === "saving" ? "저장 중..." : "저장"}
      </button>

      {saveStatus.kind === "done" && <p className="text-sm text-[var(--text-success)]">저장했습니다.</p>}
      {saveStatus.kind === "error" && <p className="text-sm text-[var(--text-danger)]">{saveStatus.message}</p>}
    </div>
  );
}
