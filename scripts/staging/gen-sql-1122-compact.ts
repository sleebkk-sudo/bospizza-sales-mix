import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { parseSalesReport } from "../../src/lib/parseSalesReport";

// 사용법: npx tsx scripts/gen-sql-1122-compact.ts <업로드 파일이 있는 디렉터리>
const UP = process.argv[2] ?? "/root/.claude/uploads/85646bf4-f7dc-546e-b126-8e367ba5c277";
function findFile(suffix: string): string {
  const hit = readdirSync(UP).find((f) => f.endsWith(suffix));
  if (!hit) throw new Error(`file ending with ${suffix} not found in ${UP}`);
  return `${UP}/${hit}`;
}
const OUT = "/home/user/bospizza-sales-mix/scripts/sql-1122-c20";
const TARGET_BYTES = 20_000;

type Src = { file: string; snap: number; keep: (d: string) => boolean; label: string };
const sources: Src[] = [
  { file: findFile("SHOP_ORDER_DETAIL_WITH_CANCEL_2026-10-01_2026-11-22_1.xlsx"), snap: 1, keep: (d) => d > "2026-10-15", label: "배민 10/01~11/22 (>10/15)" },
  { file: findFile("20261001_20261031.csv"), snap: 2, keep: (d) => d > "2026-10-15" && d < "2026-10-26", label: "요기요 10/01~10/31 (10/16~10/25)" },
  { file: findFile("20261026_20261122.csv"), snap: 3, keep: () => true, label: "요기요 10/26~11/22 (all)" },
];

const dict = new Map<string, number>();
function id(s: string | null | undefined): number {
  if (s === null || s === undefined) return 0;
  let v = dict.get(s);
  if (v === undefined) { v = dict.size + 1; dict.set(s, v); }
  return v;
}
const dtInt = (d: string) => Number(d.replace(/-/g, ""));
const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;

const snapRows: string[] = [];
const items: string[] = [];
const daily: string[] = [];
const combos: string[] = [];
const opts: string[] = [];
const storeNames = new Set<string>();
const summary: Record<string, unknown>[] = [];

for (const src of sources) {
  const buf = readFileSync(src.file);
  const p = parseSalesReport(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  if (!p.periodStart || !p.periodEnd) throw new Error(`no period: ${src.file}`);
  snapRows.push(`(${src.snap},'${p.periodStart}','${p.periodEnd}',${p.totalQty},${p.totalRevenue})`);
  let c = { items: 0, daily: 0, combos: 0, opts: 0 };
  for (const r of p.rows) {
    const d = r.saleDate ?? p.periodStart;
    if (!src.keep(d)) continue;
    if (r.storeName) storeNames.add(r.storeName);
    items.push(`(${src.snap},${dtInt(d)},${id(r.storeName)},${id(r.category)},${id(r.productName)},${r.qty},${r.revenue},${id(r.channel)})`);
    c.items++;
  }
  for (const r of p.dailyStats) {
    if (!src.keep(r.saleDate)) continue;
    daily.push(`(${dtInt(r.saleDate)},${id(r.storeName)},${id(r.channel)},${r.orderCount},${r.totalQty},${r.totalRevenue})`);
    c.daily++;
  }
  for (const r of p.combos) {
    if (!src.keep(r.saleDate)) continue;
    combos.push(`(${dtInt(r.saleDate)},${id(r.storeName)},${id(r.channel)},${id(r.baseProduct)},${id(r.comboLabel)},${r.qty})`);
    c.combos++;
  }
  for (const r of p.optionSelections) {
    if (!src.keep(r.saleDate)) continue;
    opts.push(`(${dtInt(r.saleDate)},${id(r.storeName)},${id(r.channel)},${id(r.category)},${id(r.optionName)},${r.qty},${r.revenue})`);
    c.opts++;
  }
  summary.push({ label: src.label, period: `${p.periodStart}~${p.periodEnd}`, fileRows: p.rows.length, kept: c, totalQty: p.totalQty, totalRevenue: p.totalRevenue });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let n = 0;
function write(sql: string) {
  n++;
  writeFileSync(`${OUT}/s${String(n).padStart(3, "0")}.sql`, sql, "utf-8");
}
const checks: string[] = [];
function writeBatched(table: string, cols: string, rows: string[]) {
  let cur: string[] = [];
  let bytes = 0;
  const flush = () => {
    if (!cur.length) return;
    const batch = n + 1;
    const tagged = cur.map((r) => `(${batch},${r.slice(1)}`);
    write(`insert into ${table} (batch, ${cols}) values\n${tagged.join(",\n")}\non conflict do nothing;`);
    const colList = cols.split(",").map((c) => c.trim());
    const sums = colList.map((_, i) => cur.reduce((a, r) => a + Number(r.slice(1, -1).split(",")[i]), 0));
    const conds = colList.map((c, i) => `coalesce(sum(${c}),0) = ${sums[i]}`).join(" and ");
    const check = `select count(*) = ${cur.length} and ${conds} as ok, count(*) as n from ${table} where batch = ${batch};`;
    writeFileSync(`${OUT}/s${String(batch).padStart(3, "0")}.check.sql`, check, "utf-8");
    checks.push(`s${String(batch).padStart(3, "0")}`);
    cur = []; bytes = 0;
  };
  for (const r of rows) {
    cur.push(r); bytes += Buffer.byteLength(r) + 6;
    if (bytes >= TARGET_BYTES) flush();
  }
  flush();
}

const dictRows = [...dict.entries()].map(([name, i]) => `(${i},${esc(name)})`);
write(`insert into ing_dict (id, name) values\n${dictRows.join(",\n")}\non conflict (id) do update set name = excluded.name;`);
write(`insert into ing_snap (snap, ps, pe, qty, rev) values\n${snapRows.join(",\n")}\non conflict (snap) do update set ps=excluded.ps, pe=excluded.pe, qty=excluded.qty, rev=excluded.rev;`);
writeBatched("ing_items", "snap, dt, st, cat, prod, qty, rev, ch", items);
writeBatched("ing_daily", "dt, st, ch, orders, qty, rev", daily);
writeBatched("ing_combos", "dt, st, ch, base, label, qty", combos);
writeBatched("ing_opts", "dt, st, ch, cat, name, qty, rev", opts);

function sums(rows: string[]): number[] {
  const acc: number[] = [];
  for (const r of rows) {
    const nums = r.slice(1, -1).split(",").map(Number);
    nums.forEach((v, i) => { acc[i] = (acc[i] ?? 0) + v; });
  }
  return acc;
}
const checksums = { items: sums(items), daily: sums(daily), combos: sums(combos), opts: sums(opts) };
console.log(JSON.stringify({ checksums, summary, dict: dict.size, items: items.length, daily: daily.length, combos: combos.length, opts: opts.length, stores: storeNames.size, files: n }, null, 1));
