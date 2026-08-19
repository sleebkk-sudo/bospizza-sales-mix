"use client";

import { useRef, useState } from "react";

export function CaptureInput({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function setFile(file: File) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name);
    onFileSelected(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      e.preventDefault();
      setFile(file);
    }
  }

  return (
    <div
      onPaste={handlePaste}
      tabIndex={0}
      className="border border-dashed border-[var(--border-strong)] rounded-lg p-4 text-center outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={fileName ?? "capture"} className="max-h-48 mx-auto rounded mb-2" />
      ) : (
        <p className="text-sm text-[var(--text-muted)] mb-2">
          여기 클릭한 뒤 Ctrl+V로 캡처 이미지를 붙여넣거나, 파일을 선택하세요
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setFile(file);
        }}
        className="text-xs"
      />
    </div>
  );
}
