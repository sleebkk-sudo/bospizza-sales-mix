// 보스피자 쿠팡이츠 캐치업용 통합 run() — 날짜확장(1개월) + 페이지네이션 내장
// COUPANG_CATCHUP_SOP.md 14절·14-1절 참고. 2026-09-28 검증 (48/48, ACCESS_DENIED 0).
// 2026-10-16 수정: (1) 날짜확장 검증+재시도, (2) 페이지네이션 마지막페이지 오판 버그 수정 — 14-1절.
//
// 사용법 (store.coupangeats.com 아무 매장 탭에서):
//   1) 이 파일의 run 함수를 정의한 뒤:
//        localStorage.setItem('__bpRunSrc', run.toString());
//        localStorage.setItem('__bpKey', ANON_KEY); // Supabase MCP get_publishable_keys
//   2) 매장별 (browser_batch: navigate → wait 2.5s → 아래 한 줄, 5~6매장씩):
//        const run=new Function('return '+localStorage.getItem('__bpRunSrc'))();
//        return await run(localStorage.getItem('__bpKey'), 1057866, '2026-09-17', '2026-09-28');
//   minDate = DB 최신 sale_date, maxDate = 오늘(제외). 필터는 minDate <= d < maxDate.

async function run(anonKey, storeId, minDate, maxDate) {
  const SUPABASE_URL = "https://iepvrsyxjslymjyxapvb.supabase.co";
  const H = { apikey: anonKey, Authorization: "Bearer " + anonKey, "Content-Type": "application/json" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (document.body.textContent.includes("권한이 존재하지 않습니다")) return { error: "ACCESS_DENIED", storeId };
  function rClick(el) {
    const r = el.getBoundingClientRect();
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((t) =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
    );
  }
  // 갈산 보정 포함 (SOP 13절)
  function normName(raw) {
    const t = raw.trim();
    let n;
    if (t.startsWith("보스피자-")) n = t;
    else { const m = t.match(/(\S+점)\s*$/); n = m ? "보스피자-" + m[1] : t; }
    return n === "보스피자-부평갈산점" ? "보스피자-갈산점" : n;
  }
  const cands = Array.from(document.querySelectorAll("*")).filter(
    (e) => /^보스피자\s+.+점$/.test(e.textContent.trim()) && e.textContent.trim().length < 20
  );
  const nameEl = cands.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!nameEl) return { error: "NO_STORE_NAME", storeId };
  const storeName = normName(nameEl.textContent.trim());

  // --- 날짜 범위 "1개월" 확장 (SOP 6절) — 적용됐는지 화면 범위 텍스트로 검증하고 최대 3회 재시도 ---
  // 클릭이 씹혀 7일 기본범위에 머문 채 긁으면 minDate 이전 날짜가 통째로 빠지는데 에러는 안 난다.
  // 그래서 표시된 범위의 시작일이 minDate 이하가 될 때까지 다시 시도하고, 결과에 rangeOK로 돌려준다.
  function rangeTxt() {
    const w = Array.from(document.querySelectorAll("div")).find(
      (e) => /\d{4}\.\d{2}\.\d{2}\s*-\s*\d{4}\.\d{2}\.\d{2}/.test(e.textContent.trim()) && e.textContent.trim().length < 40
    );
    return w ? (w.textContent.match(/\d{4}\.\d{2}\.\d{2}\s*-\s*\d{4}\.\d{2}\.\d{2}/) || [""])[0] : "";
  }
  function rangeStart(t) { const m = t.match(/(\d{4})\.(\d{2})\.(\d{2})/); return m ? m[1] + "-" + m[2] + "-" + m[3] : ""; }
  let rangeNow = rangeTxt();
  for (let attempt = 0; attempt < 3 && !(rangeStart(rangeNow) && rangeStart(rangeNow) <= minDate); attempt++) {
    const wrapper = Array.from(document.querySelectorAll("div")).find(
      (e) => /\d{4}\.\d{2}\.\d{2}\s*-\s*\d{4}\.\d{2}\.\d{2}/.test(e.textContent.trim()) && e.textContent.trim().length < 40
    );
    if (!wrapper) break;
    rClick(wrapper.querySelector(".css-1uvczjr") || wrapper);
    await sleep(600);
    const om = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent.trim() === "1개월");
    if (om) rClick(om);
    await sleep(300);
    const sb = Array.from(document.querySelectorAll("button")).find((b) => b.className.includes("defaultOutlined") && b.offsetParent !== null);
    if (sb) rClick(sb);
    await sleep(2500);
    rangeNow = rangeTxt();
  }
  const rangeOK = !!(rangeStart(rangeNow) && rangeStart(rangeNow) <= minDate);

  // --- 옵션 분류 (src/lib/parseSalesReport.ts classifyOptionSelection과 동일) ---
  const DOUGH = new Set(["기본 도우", "고구마링", "치즈크러스트", "크림치즈링", "더블치즈크러스트"]);
  const TOPPING = ["옥수수", "올리브", "반달감자", "파인애플", "베이컨", "카나디언햄", "페퍼로니", "바베큐치킨", "불갈비", "불고기", "스파이스치킨", "새우"];
  const ADDON = new Set(["피클", "핫소스", "치즈가루", "갈릭디핑소스"]);
  const DRINK = ["콜라", "제로콜라", "사이다"];
  function classOpt(raw) {
    const name = (raw || "").trim();
    if (!name) return null;
    if (name.startsWith("[리뷰+사진]") || name === "선택 안함" || name === "참여 안함") {
      const s = name.replace(/^\[리뷰\+사진\]/, "");
      return { category: "리뷰이벤트", optionName: s || "선택 안함" };
    }
    const sz = name.replace(/\(\d+조각\)$/, "");
    if (sz === "M" || sz === "L") return { category: "사이즈", optionName: sz };
    const dough = name === "우유도우" ? "기본 도우" : name;
    if (DOUGH.has(dough)) return { category: "도우 선택", optionName: dough };
    if (TOPPING.some((b) => name.startsWith(b + "("))) return { category: "추가토핑", optionName: name };
    if (ADDON.has(name)) return { category: "추가메뉴", optionName: name };
    if (DRINK.some((p) => name.startsWith(p))) return { category: "음료 추가", optionName: name };
    if (/피자(\(반\/?반\))?$/.test(name)) return null; // 반반피자 맛 옵션은 combo 통계에서 다룸
    return { category: "사이드 선택", optionName: name };
  }
  function catMenu(name) {
    if (name.includes("피자")) return "피자";
    if (name.includes("스파게티") || name.includes("파스타")) return "파스타";
    if (["콜라", "사이다", "환타", "스프라이트", "밀키스", "제로"].some((k) => name.includes(k))) return "음료";
    if (name.includes("+사이드+음료") || name.includes("세트")) return "세트";
    return "사이드";
  }
  function extractPage() {
    const content = document.querySelector(".order-search-result-content");
    if (!content) return document.body.textContent.includes("조회할 내역이 없습니다") ? { orders: [], raw: 0 } : null;
    const out = [];
    for (const row of [...content.children]) {
      const rt = row.textContent;
      if (rt.includes("주문취소") || rt.includes("재주문")) continue; // SOP 8절
      const os = row.querySelector(".order-item");
      if (!os) continue;
      const date = os.querySelector(".order-date span")?.textContent.trim() ?? null;
      if (!date) continue;
      const items = [];
      for (const it of row.querySelectorAll(".order-detail-item")) {
        const ne = it.querySelector(".col-7");
        const nm = ne ? [...ne.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("").trim() : null;
        const qty = parseInt((it.querySelector(".col-2")?.textContent || "").replace(/[^0-9]/g, "")) || 1;
        const price = parseInt((it.querySelector(".order-item-price")?.textContent || "").replace(/[^0-9]/g, "")) || 0;
        const opts = [...it.querySelectorAll(".item-options .order-detail-option-name")].map((s) => s.textContent.trim());
        items.push({ name: nm, qty, price, opts });
      }
      out.push({ date: date.replace(/\./g, "-"), items });
    }
    // raw = 실제 주문 행 수(취소·재주문 포함). 마지막 페이지 판정은 반드시 이걸로 할 것 —
    // 걸러낸 뒤 개수(out.length)로 판정하면 취소건이 섞인 페이지를 "마지막 페이지(10건 미만)"로
    // 오인해 그 뒤 페이지를 통째로 놓친다. 2026-10-16 송산새솔 19건→50건으로 발견. (SOP 14-1절)
    return { orders: out, raw: [...content.children].filter((r) => r.querySelector(".order-item")).length };
  }

  // --- 페이지네이션: 최신순으로 훑다가 minDate 미만 나오면 중단 ---
  // "다음" 버튼(.next-btn)으로 넘기고, 마지막 페이지는 raw 행 수(<10)로 판정한다. 숫자 버튼은 창이
  // 슬라이딩돼 뒤 페이지가 안 보일 수 있고, 걸러낸 건수로 판정하면 취소건 있는 페이지에서 조기 종료된다.
  const seen = new Set();
  const all = [];
  let stop = false;
  for (let pg = 1; pg <= 20 && !stop; pg++) {
    if (pg > 1) {
      const nb = document.querySelector("[class*=pagination] .next-btn, [class*=pagination] button.next-btn");
      if (!nb || nb.disabled || /disabled/.test(nb.className || "")) break;
      rClick(nb);
      await sleep(1600);
    }
    let pr = extractPage();
    if (pr === null) { await sleep(1500); pr = extractPage() || { orders: [], raw: 0 }; }
    const po = pr.orders;
    let anyOld = false;
    for (const o of po) {
      const key = o.date + "|" + JSON.stringify(o.items);
      if (seen.has(key)) continue;
      seen.add(key);
      if (o.date < minDate) { anyOld = true; continue; }
      if (o.date >= maxDate) continue;
      all.push(o);
    }
    if (anyOld) stop = true;
    if (pr.raw < 10) break; // raw 기준 — 필터 후 개수(po.length) 아님
  }

  // --- 집계 ---
  const menu = new Map(), opt = new Map(), day = new Map();
  for (const o of all) {
    if (!day.has(o.date)) day.set(o.date, { oc: 0, rev: 0 });
    const d = day.get(o.date);
    d.oc++;
    for (const it of o.items) {
      if (!it.name) continue;
      d.rev += it.price;
      const k = o.date + "|" + it.name;
      const r = menu.get(k) || { sale_date: o.date, store_name: storeName, product_name: it.name, category: catMenu(it.name), channel: "쿠팡이츠", qty: 0, revenue: 0 };
      r.qty += it.qty; r.revenue += it.price; menu.set(k, r);
      for (const raw of it.opts) {
        const c = classOpt(raw);
        if (!c) continue;
        const ok = o.date + "|" + c.category + "|" + c.optionName;
        const or = opt.get(ok) || { sale_date: o.date, store_name: storeName, channel: "쿠팡이츠", category: c.category, option_name: c.optionName, qty: 0, revenue: 0 };
        or.qty += it.qty; opt.set(ok, or); // 쿠팡은 옵션 개별가 없음 → revenue 0 고정 (SOP 11절)
      }
    }
  }
  const menuRows = [...menu.values()];
  const optRows = [...opt.values()];
  // total_qty = order_count (SOP 5절 관례), total_revenue = 그날 메뉴매출 합 (NOT NULL)
  const statRows = [...day.entries()].map(([d, v]) => ({ sale_date: d, store_name: storeName, channel: "쿠팡이츠", order_count: v.oc, total_qty: v.oc, total_revenue: v.rev }));

  // --- upsert (RLS 없음, anon key 직접) ---
  async function up(table, rows, conflict, pref) {
    if (!rows.length) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: pref }, body: JSON.stringify(rows) });
    if (!res.ok) throw new Error(table + " " + res.status + " " + (await res.text()).slice(0, 200));
  }
  await up("menu_sales_items", menuRows, "sale_date,store_name,product_name,channel", "resolution=merge-duplicates,return=minimal");
  await up("store_daily_stats", statRows, "sale_date,store_name,channel", "resolution=merge-duplicates,return=minimal");
  await up("menu_option_selections", optRows, "sale_date,store_name,channel,category,option_name", "resolution=merge-duplicates,return=minimal");
  await up("stores", [{ name: storeName, first_seen: minDate }], "name", "resolution=ignore-duplicates,return=minimal");

  // range/rangeOK: 호출한 쪽에서 rangeOK===false 인 매장은 재실행 대상으로 걸러낼 것.
  return { storeName, range: rangeNow, rangeOK, orders: all.length, days: [...day.keys()].sort(), menuRows: menuRows.length, optRows: optRows.length };
}
