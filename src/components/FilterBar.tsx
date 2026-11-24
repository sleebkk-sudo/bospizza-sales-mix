"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StoreSelect } from "@/components/StoreSelect";

function buildHref(from: string, to: string, store: string, channel: string) {
  const sp = new URLSearchParams();
  sp.set("from", from);
  sp.set("to", to);
  if (store !== "all") sp.set("store", store);
  if (channel !== "all") sp.set("channel", channel);
  return `/?${sp.toString()}`;
}

export function FilterBar({
  from,
  to,
  store,
  channel,
  stores,
  channels,
  minDate,
  maxDate,
  presets,
}: {
  from: string;
  to: string;
  store: string;
  channel: string;
  stores: string[];
  channels: readonly string[];
  minDate: string;
  maxDate: string;
  presets: { label: string; from: string; to: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<{ from: string; to: string } | null>(null);

  const activeFrom = isPending && pendingRange ? pendingRange.from : from;
  const activeTo = isPending && pendingRange ? pendingRange.to : to;

  function navigate(nextFrom: string, nextTo: string, nextStore: string, nextChannel: string) {
    setPendingRange({ from: nextFrom, to: nextTo });
    startTransition(() => {
      router.push(buildHref(nextFrom, nextTo, nextStore, nextChannel));
    });
  }

  return (
    <div
      className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3"
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => {
          const active = activeFrom === p.from && activeTo === p.to;
          return (
            <button
              key={p.label}
              type="button"
              disabled={isPending}
              onClick={() => navigate(p.from, p.to, store, channel)}
              className="text-xs px-2.5 py-1.5 rounded-md border disabled:cursor-wait"
              style={
                active
                  ? { background: "var(--surface-1)", borderColor: "var(--border-strong)", fontWeight: 600 }
                  : { color: "var(--text-secondary)", borderColor: "var(--border)" }
              }
            >
              {p.label}
            </button>
          );
        })}
        {isPending && (
          <span className="ml-2 text-xs text-[var(--text-muted)] animate-pulse">불러오는 중…</span>
        )}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        key={`${from}|${to}|${store}|${channel}`}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          navigate(
            String(fd.get("from") || from),
            String(fd.get("to") || to),
            String(fd.get("store") || "all"),
            String(fd.get("channel") || "all")
          );
        }}
      >
        <input
          type="date"
          name="from"
          defaultValue={from}
          min={minDate}
          max={maxDate}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        />
        <span className="text-xs text-[var(--text-muted)]">~</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          min={minDate}
          max={maxDate}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        />
        <StoreSelect stores={stores} defaultValue={store} />
        <select
          name="channel"
          defaultValue={channel}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        >
          <option value="all">전체 배달앱</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="h-8 px-3 rounded-md bg-[var(--fill-accent)] text-white text-xs font-medium disabled:opacity-60 disabled:cursor-wait"
        >
          {isPending ? "조회 중…" : "적용"}
        </button>
      </form>
    </div>
  );
}
