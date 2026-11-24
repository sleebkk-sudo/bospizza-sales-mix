"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const ALL = "all";
const ALL_LABEL = "전체 매장";
const BRAND_PREFIX = /^보스피자[-\s]*/;
const CHOSUNG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function compact(text: string) {
  return text.replace(/\s+/g, "").toLowerCase();
}

// "당진신평점" -> "ㄷㅈㅅㅍㅈ". 한글이 아닌 글자는 그대로 둔다.
function toChosung(text: string) {
  return [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0) - 0xac00;
      return code >= 0 && code <= 11171 ? CHOSUNG[Math.floor(code / 588)] : ch;
    })
    .join("");
}

// 매장이 수백 개라 기본 <select>로는 원하는 매장을 찾기 어렵다 — 눌러서 열면 검색창이
// 나오고, 매장명 일부("당진")나 초성("ㄷㅈ")으로 걸러서 고를 수 있게 한다. 고른 값은
// 숨은 input(name)에 담기므로 기존 폼(적용 버튼·GET 폼)에서 <select>와 똑같이 동작한다.
export function StoreSelect({
  stores,
  defaultValue,
  name = "store",
}: {
  stores: string[];
  defaultValue: string;
  name?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const [value, setValue] = useState(defaultValue || ALL);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const indexed = useMemo(
    () =>
      stores.map((store) => {
        const short = compact(store.replace(BRAND_PREFIX, ""));
        return { store, full: compact(store), short, chosung: toChosung(short) };
      }),
    [stores]
  );

  const options = useMemo(() => {
    const q = compact(query);
    if (!q) return [ALL, ...stores];
    const byChosung = /^[ㄱ-ㅎ]+$/.test(q);
    const matched = indexed.filter((s) => (byChosung ? s.chosung.includes(q) : s.full.includes(q)));
    // 검색어로 시작하는 매장을 먼저 보여준다 ("신"을 치면 "신림점"이 "당진신평점"보다 위).
    const startsWith = (s: (typeof indexed)[number]) => (byChosung ? s.chosung : s.short).startsWith(q);
    return [...matched.filter(startsWith), ...matched.filter((s) => !startsWith(s))].map((s) => s.store);
  }, [indexed, stores, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openPanel() {
    setQuery("");
    setActiveIndex(Math.max(0, [ALL, ...stores].indexOf(value)));
    setOpen(true);
  }

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="h-8 max-w-[14rem] rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] pl-2 pr-1.5 text-xs flex items-center gap-1"
      >
        <span className="truncate">{value === ALL ? ALL_LABEL : value}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-[var(--text-muted)]">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-lg">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-label="매장 검색"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options.length > 0 ? `${listId}-${activeIndex}` : undefined}
              autoComplete="off"
              placeholder="매장명 검색 (예: 당진, ㄷㅈ)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(e) => {
                // 한글 조합 중의 Enter는 글자 확정용이라 선택으로 처리하지 않는다.
                if (e.nativeEvent.isComposing) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, options.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  // 폼 안에 있어서 막지 않으면 Enter가 "적용"으로 넘어가 버린다.
                  e.preventDefault();
                  if (options[activeIndex]) choose(options[activeIndex]);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
              className="w-full h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs outline-none focus:ring-2 focus:ring-[var(--fill-accent)]"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="매장" className="max-h-64 overflow-y-auto py-1">
            {options.map((option, i) => {
              const active = i === activeIndex;
              const selected = option === value;
              return (
                <li
                  key={option}
                  id={`${listId}-${i}`}
                  ref={active ? activeRef : undefined}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActiveIndex(i)}
                  onClick={() => choose(option)}
                  className={`px-3 py-1.5 text-xs cursor-pointer ${active ? "bg-[var(--bg-accent)]" : ""} ${
                    selected ? "font-semibold" : ""
                  }`}
                >
                  {option === ALL ? ALL_LABEL : option}
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-2 text-xs text-[var(--text-muted)]">검색 결과가 없습니다.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
