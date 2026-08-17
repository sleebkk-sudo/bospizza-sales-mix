import Link from "next/link";

function buildHref(from: string, to: string, store: string) {
  const sp = new URLSearchParams();
  sp.set("from", from);
  sp.set("to", to);
  if (store !== "all") sp.set("store", store);
  return `/?${sp.toString()}`;
}

export function FilterBar({
  from,
  to,
  store,
  stores,
  minDate,
  maxDate,
  presets,
}: {
  from: string;
  to: string;
  store: string;
  stores: string[];
  minDate: string;
  maxDate: string;
  presets: { label: string; from: string; to: string }[];
}) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={buildHref(p.from, p.to, store)}
            className="text-xs px-2.5 py-1.5 rounded-md border"
            style={
              from === p.from && to === p.to
                ? { background: "var(--surface-1)", borderColor: "var(--border-strong)", fontWeight: 600 }
                : { color: "var(--text-secondary)", borderColor: "var(--border)" }
            }
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          name="from"
          defaultValue={from}
          min={minDate}
          max={to}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        />
        <span className="text-xs text-[var(--text-muted)]">~</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          min={from}
          max={maxDate}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        />
        <select
          name="store"
          defaultValue={store}
          className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs"
        >
          <option value="all">전체 매장</option>
          {stores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 px-3 rounded-md bg-[var(--fill-accent)] text-white text-xs font-medium"
        >
          적용
        </button>
      </form>
    </div>
  );
}
