# 보스피자 쿠팡이츠 데이터 반영 SOP (48개 매장)

이 문서는 "보스피자 쿠팡이츠 로그인했으니 반영해줘" 요청이 올 때마다 처음부터 다시
알아내지 않도록, 2026-08-23에 확립한 방법을 기록한다. README 8절이 말하는 "외부에서
직접 테이블에 넣는 방식"의 구체적인 실행 방법이 이 문서다.

## 0. 사전 준비

- 이 리포(`bospizza-sales-mix`)가 로컬에 없으면 클론부터: 기본적으로 로컬에 클론되어
  있지 않다(작업용 프로젝트 폴더가 아니라 순수 데이터 드롭 폴더만 있는 경우가 많음).
  `git clone https://github.com/sleebkk-sudo/bospizza-sales-mix.git`
- Supabase 프로젝트 ID: `iepvrsyxjslymjyxapvb`. **RLS 전체 테이블 비활성화 상태** —
  anon/publishable key로 브라우저에서 직접 읽기/쓰기 가능 (서비스롤 키 불필요).
  anon key는 Supabase MCP `get_publishable_keys`로 즉시 조회 가능.

## 1. 로그인은 1개 매장 계정이면 48개 전부 커버된다 — 절대 매장별로 재로그인하지 말 것

사용자가 "쿠팡이츠 로그인했다"고 하면 보통 아무 매장 계정 하나(예: "이상형"님 계정,
보스피자 권선시장점)로 로그인한 것인데, **이 계정 하나로 48개 매장 전부에 접근 가능**
하다.

## 2. 매장 ID 목록은 이미 알려져 있다 — 스위처 클릭 대신 URL 직접 이동을 우선 고려할 것

[[project_bospizza_coupang_review_scrape_workflow]] 메모리(리뷰 스크래핑용으로 먼저
확립됨)에 **48개 매장 ID 전체 목록**이 이미 있다: 연속 ID **1057866~1057912**(47개) +
**1057915**(갈산점, 범위 밖). URL 패턴은 `/merchant/management/orders/{storeId}`
(리뷰는 `/reviews/{storeId}`). **이 ID를 알고 있으면 매장 스위처를 클릭해서 찾아다닐
필요 없이 `navigate`로 바로 그 매장 페이지로 이동하면 된다** — 이번 회차(2026-08-23,
매출 반영)는 이 ID 목록의 존재를 뒤늦게 발견해서 스위처 클릭 방식으로 처리했는데,
다음엔 처음부터 ID 직접 이동으로 시작할 것 — 리뷰 워크플로우가 이미 그렇게 하고 있고
(`browser_batch`로 navigate+추출+집계를 매장당 1콜), 매출 반영도 그대로 따라할 수
있다. 이 경우 매장마다 완결된 사이클(이동→추출→그 매장 데이터 바로 Supabase 삽입)로
처리하면 되므로, 아래 3절의 "클릭 전환 + localStorage 누적" 방식에서 걱정했던 "navigate
가 상태를 날린다"는 문제 자체가 사라진다(매장 간에 누적할 상태가 없으니까).

스위처 클릭 방식이 필요한 경우(ID 목록이 최신이 아닌 것 같을 때 재검증용)만 아래를
참고:

```js
window.__getStoreLinks = () => [...document.querySelectorAll('a')].filter(a => a.textContent.trim().startsWith('보스피자'));
window.__getStoreLinks().map(a => a.textContent.trim()) // 48개 이름 배열, href는 없음(React Router)
```
`href` 속성이 없어 클릭해야 하는데 그냥 `.click()`은 씹히므로 네이티브 이벤트 시퀀스가
필요하다(아래 `__dispatchClick`). 이 방식을 쓸 거면 **`navigate` 도구로 다른 매장
URL에 직접 이동하지 말 것** — 페이지 리로드로 `window`에 쌓아둔 누적 데이터가 다
날아간다(2026-08-23에 이 실수로 30개 매장 재작업함). 매장 전환은 스위처 링크 클릭(SPA
라우팅)으로만 해야 상태 유지됨.

## 3. 주문 추출 — 쿠팡 주문 상세는 클릭 없이 이미 펼쳐진 상태로 DOM에 있다

미담향(단일 매장) 계정과 달리 이 계정은 주문 행이 기본적으로 펼쳐져 있어 "펼치기"
클릭이 필요 없다. 실제 DOM 클래스 구조(2026-08-23 확인):

```
.order-search-result-content > LI.col-12 (주문 1건)
  .order-item                     ← 주문 요약 (날짜/코드/합계)
    .order-date span              ← "2026.08.21"
    (형제 DIV.col-4.col-md-3, order-name 클래스 아님) ← 주문코드 텍스트 (첫 텍스트노드)
  .order-details .order-detail-item (상품 1줄)
    .col-7                        ← 상품명 (첫 텍스트노드만, 하위 UL.item-options는 제외)
    .col-2                        ← "1개" (수량)
    .order-item-price             ← "34,300원" (그 상품 줄의 합계금액)
```

주문 0건이면 `.order-search-result-content` 자체가 없고 대신 페이지에
`"조회할 내역이 없습니다"` 텍스트가 있음 — 이걸 빈 배열 `[]`로 처리해야지 `null`(추출
실패)과 헷갈리면 안 된다.

전체 추출/클릭 헬퍼 (매 세션 최초 1회 `window`에 등록, 이후 재사용):

```js
window.__dispatchClick = function(el) {
  const rect = el.getBoundingClientRect();
  const opts = {bubbles:true, cancelable:true, clientX: rect.x+rect.width/2, clientY: rect.y+rect.height/2};
  el.dispatchEvent(new MouseEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));
};
window.__extractOrders = function() {
  const content = document.querySelector('.order-search-result-content');
  if (!content) {
    if (document.body.textContent.includes('조회할 내역이 없습니다')) return [];
    return null; // 아직 로딩 중이거나 진짜 실패 — 재시도
  }
  const orders = [];
  for (const row of [...content.children]) {
    const orderSection = row.querySelector('.order-item');
    if (!orderSection) continue;
    const date = orderSection.querySelector('.order-date span')?.textContent.trim() ?? null;
    const codeDiv = [...orderSection.children].find(c => c.className.includes('col-4') && c.className.includes('col-md-3') && !c.className.includes('order-name'));
    const code = codeDiv ? codeDiv.childNodes[0].textContent.trim() : null;
    const items = [];
    for (const itemEl of row.querySelectorAll('.order-detail-item')) {
      const nameEl = itemEl.querySelector('.col-7');
      const name = nameEl ? [...nameEl.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim() : null;
      const qty = parseInt((itemEl.querySelector('.col-2')?.textContent||'').replace(/[^0-9]/g,'')) || 1;
      const price = parseInt((itemEl.querySelector('.order-item-price')?.textContent||'').replace(/[^0-9]/g,'')) || 0;
      items.push({name, qty, price});
    }
    orders.push({date, code, items});
  }
  return orders;
};
```

## 4. 48개 매장 순회 — localStorage에 누적 (window 변수 아님!)

`window` 전역 변수는 `navigate()` 호출 한 번에 날아가므로, 실수 방지 차원에서 처음부터
**`localStorage`에 누적**한다(같은 origin 안에서는 살아남고, 혹시 실수로 진짜 페이지
이동이 일어나도 데이터가 보존됨):

```js
window.__runBatch = async function(targetNames) {
  const store = JSON.parse(localStorage.getItem('__bp_results') || '{}');
  for (const name of targetNames) {
    const link = window.__getStoreLinks().find(a => a.textContent.trim() === name);
    if (!link) { store[name] = {error:'not found'}; continue; }
    window.__dispatchClick(link);
    await new Promise(r => setTimeout(r, 1500)); // 렌더 대기, 1.5초면 충분
    store[name] = window.__extractOrders();
  }
  localStorage.setItem('__bp_results', JSON.stringify(store));
  return Object.keys(store).length;
};
```

한 번에 5~7개 매장씩 배치로 돌리고(전체를 한 번에 돌리면 타임아웃/출력 잘림 위험),
매 배치마다 `Object.entries(r).map(([k,v]) => [k, Array.isArray(v)?v.length:v])`처럼
**건수만** 출력해서 컨텍스트를 아낀다 — 전체 원본 데이터는 localStorage에 이미 있으므로
다시 볼 필요 없음.

## 5. 집계 → Supabase 직접 REST 삽입 (이게 핵심 시간단축 포인트)

48개 매장 원본 주문 데이터를 에이전트 컨텍스트로 끌고 와서 Node 스크립트를 짜는 방식
(미담향에서 하던 방식)은 이 규모에서는 느리고 토큰 낭비다. 대신 **브라우저 안에서
집계까지 끝내고, `fetch()`로 Supabase REST API에 직접 upsert**한다 — 브라우저→
Supabase가 직접 통신하니 원본 주문 데이터가 에이전트 컨텍스트를 거칠 필요가 아예 없다.

```js
function categorizeMenuName(name) { // src/lib/parseSalesReport.ts와 동일 로직 유지할 것
  if (name.includes("+사이드+음료") || name.includes("세트")) return "세트";
  if (name.includes("피자")) return "피자";
  if (name.includes("스파게티") || name.includes("파스타")) return "파스타";
  if (["콜라","사이다","환타","스프라이트","밀키스","제로"].some(k => name.includes(k))) return "음료";
  return "사이드";
}
function normalizeStoreName(raw) { // "보스피자 XX점" -> "보스피자-XX점", 내부 공백 제거
  return "보스피자-" + raw.replace(/^보스피자\s*/, "").replace(/\s+/g, "");
}
```

- **집계 규칙**: 같은 (매장, 날짜, 상품명)으로 qty/revenue를 합산해 `menu_sales_items`
  한 행. 여러 주문에 같은 상품이 나눠 있어도, 한 주문 안에 수량 2 이상이어도 그냥 합산.
- **`store_daily_stats.total_qty`는 실제 상품 수량 합이 아니라 `order_count`와 동일하게
  넣는다** — 기존에 이미 삽입된 123개 행이 전부 이 방식(주문 1건=qty 1로 취급)이라
  일관성을 맞춘 것. 진짜 아이템 수량 합을 넣지 말 것(기존 관례와 어긋남).
- **재실행 시 날짜 필터 필수**: 매장별로 이미 반영된 마지막 날짜(latest_date)를
  Supabase에서 미리 조회해서, 그 날짜 이하인 주문은 집계에서 제외해야 한다(안 그러면
  unique 제약 위반 에러는 안 나지만 `merge-duplicates`가 기존 값을 덮어써서 최신 상태와
  안 맞을 수 있음 — 매번 조회하는 쪽이 안전).
- **삽입은 `on_conflict` + `Prefer: resolution=merge-duplicates`로 upsert**:
  ```js
  const SUPABASE_URL = "https://iepvrsyxjslymjyxapvb.supabase.co";
  const ANON_KEY = "..."; // Supabase MCP get_publishable_keys로 조회
  await fetch(`${SUPABASE_URL}/rest/v1/menu_sales_items?on_conflict=sale_date,store_name,product_name,channel`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json",
               Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(menuRows),
  });
  // store_daily_stats도 동일 패턴, on_conflict=sale_date,store_name,channel
  ```
- **`stores` 테이블에도 반드시 upsert**(`Prefer: resolution=ignore-duplicates`) — 대시보드
  매장 필터 드롭다운이 `menu_sales_items`가 아니라 이 테이블을 따로 읽는다
  (`src/lib/data.ts`). 신규 매장(이번엔 8곳: 동탄목동/신림푸르지오/신월2동/삼동/사가정/
  대흥역/오류1호/갈산)은 안 넣으면 데이터는 있는데 필터에 안 뜨는 상태가 됨.
- `menu_option_combos`(반반피자 맛 조합)는 기존에도 쿠팡이츠 채널은 0건 — 이번에도
  스킵했음. 필요해지면 그때 `.item-options .order-detail-option-name` 첫 번째(사이즈)를
  제외한 나머지 중 "피자"로 끝나는 옵션 2개를 골라 반영.

## 6. 알려진 미해결 지점

- **기본 조회 기간이 "최근 7일"로 고정** — 매장별 마지막 반영일이 7일보다 오래된 경우
  (2026-08-23 기준 인천계산점 8/12, 신림녹두점 8/13, 송정역점 8/14) 그 사이 며칠은 이
  7일 창에 안 잡힌다. 상단 "주문일 YYYY.MM.DD - YYYY.MM.DD" 옆 날짜 피커 버튼을
  `computer.click`과 `__dispatchClick` 둘 다로 시도했지만 캘린더 팝업이 열리지 않았음
  (DOM에 calendar/datepicker 관련 요소 자체가 안 생김 — 아이콘 버튼이 아니라 다른
  트리거일 가능성). 다음에 이 갭이 다시 생기면 날짜 피커를 여는 방법부터 새로 찾아야
  한다 — 영향은 매장당 1~3일, 주문 0~2건 수준이라 급하지 않음.
- 위 3개 매장은 이번 회차에서 8/16~8/23 구간만 반영되고 그 이전 갭은 비어있는 채로
  남아있다.
