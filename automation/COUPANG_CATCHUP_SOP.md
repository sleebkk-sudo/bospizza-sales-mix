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

## 6. 날짜 범위 넓히기 — "1개월" 프리셋 (2026-09-01 해결됨)

이전 절("기본 조회 기간 7일 고정, 날짜 피커 안 열림")은 해결됨. 날짜 표시 영역 자체를
클릭하는 게 아니라 그 안의 **`.css-1uvczjr` 서브 div**를 클릭해야 프리셋 드롭다운이
열린다(바깥 wrapper를 클릭하면 아무 반응 없거나 씹힘 — 2026-09-01에 여러 번 확인).
열리면 "오늘 / 최근 1주일 / 1개월 / 3개월 / 6개월" 프리셋 버튼이 나타나는데, 날짜가
7일보다 오래 밀린 매장은 **"1개월"**을 클릭하면 됨(6개월치까지 밀린 적은 아직 없었음).
그 다음 날짜 표시 옆의 아이콘 전용 버튼(`button.button--defaultOutlined`)을 클릭해야
실제 조회가 실행된다 — 프리셋만 클릭하고 이 버튼을 안 누르면 화면 텍스트만 바뀌고
목록은 갱신 안 됨.

```js
function robustClick(el) {
  const r = el.getBoundingClientRect();
  ['pointerdown','mousedown','mouseup','click'].forEach(t =>
    el.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, clientX:r.x+r.width/2, clientY:r.y+r.height/2}))
  );
}
const wrapper = Array.from(document.querySelectorAll('div')).find(e => /\d{4}\.\d{2}\.\d{2}\s*-\s*\d{4}\.\d{2}\.\d{2}/.test(e.textContent.trim()) && e.textContent.trim().length < 40);
robustClick(wrapper.querySelector('.css-1uvczjr') || wrapper);
await new Promise(r => setTimeout(r, 500));
robustClick(Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && e.textContent.trim()==='1개월'));
await new Promise(r => setTimeout(r, 200));
robustClick(Array.from(document.querySelectorAll('button')).find(b => b.className.includes('defaultOutlined') && b.offsetParent !== null));
await new Promise(r => setTimeout(r, 1800)); // 결과 갱신 대기
```

## 7. 매장명 추출 — switcher 드롭다운의 숨은 링크와 절대 헷갈리지 말 것

`document.querySelectorAll('a')`로 "보스피자"로 시작하는 텍스트를 찾으면 **현재 매장
전환용 switcher 드롭다운의 숨은(rect 0×0) `<a>` 48개가 전부 걸린다** — 그중 배열 순서상
첫 번째가 우연히 계정 기본 매장(예: 권선시장점)이라 어떤 store ID를 가든 항상 그 이름을
돌려주는 조용한 버그가 남. (2026-09-01에 실제로 1057867=동탄목동점 데이터가
보스피자-권선시장점으로 잘못 들어간 사고 발생 — 발견 즉시 해당 3개 행 삭제 후
재입력함.) **현재 페이지의 실제 매장명은 `class="dropdown-btn highlight"`인 가시적
DIV 하나뿐** — 아래처럼 rect가 실제로 화면에 잡히는(width>0 && height>0) 엘리먼트만
후보로 남기고, 정규식도 매장명에 공백이 들어가는 경우(예: "중동 미리내점")까지 커버해야
한다:

```js
const nameCandidates = Array.from(document.querySelectorAll('*'))
  .filter(e => /^보스피자\s+.+점$/.test(e.textContent.trim()) && e.textContent.trim().length < 20);
const nameEl = nameCandidates.find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
```

## 8. 취소·재주문 주문 제외

주문 목록에 "주문취소"(취소됨) · "재주문"(무료 재발송, 매출 0원) 상태가 섞여 있다.
`.order-item` 한 단계 위 `<li>`(row) 전체의 textContent에 이 두 문자열이 포함되면
그 주문은 집계에서 건너뛴다 — 그대로 두면 매출이 부풀거나 취소된 메뉴가 믹스에 남는다.

## 9. ACCESS_DENIED — 특정 매장이 아니라 세션/속도 문제로 보임 (2026-09-01 재확인)

과거엔 "기흥역점부터 특정 매장들이 막힌다"고 기록했었는데, 이번엔 **48개 중 24개를
연속으로 문제없이 처리한 뒤부터** 이후 매장(1057888~1057915, 갈산점 포함)이 전부
막혔다 — 즉 이전에 잘 됐던 매장(갈산점 등)도 이번엔 막힘. 매장 고유의 권한 문제가
아니라 **같은 세션에서 너무 많은 매장을 빠르게 순회하면 걸리는 속도 제한/이상탐지일
가능성이 높다.** 막히면:
- `/merchant/management/home/{id}` 선방문, 스위처 클릭 등 예전 워크어라운드는 이번엔
  전혀 안 먹힘(직접 확인함).
- 무리해서 계속 재시도하지 말 것 — 사용자가 예전에 "오류나니깐 이따가 해라"고 명시적으로
  지시한 적 있음. 막힌 매장 목록만 기록해두고, 다음 세션(로그인을 새로 하거나 시간이
  지난 뒤)에 그 매장들부터 마저 처리하면 된다.
- 2026-09-01 세션에서 막힌 ID 범위: 1057888~1057915 (23~24개 매장). 성공한 범위:
  1057866~1057887 (22개, 갈산점/사가정점/오류1호점 제외 — 이 셋은 8/27 이후 신규
  주문이 없어서 애초에 갱신할 데이터가 없었음).
- **재시도 텀은 최소 5분보다 길어야 한다** — 막힌 지 5분 뒤 재시도했지만 동일 매장은
  여전히 ACCESS_DENIED였음(2026-09-01 확인). 반면 그 세션에서 아예 안 건드렸던
  ID(1057913)는 바로 접근됐다 — 즉 계정 전체가 아니라 **그 세션에서 실제로 요청을
  보냈던 매장 ID들만** 개별적으로 쿨다운이 걸리는 것으로 보인다. 몇 시간~하루 정도
  텀을 두고 재시도할 것.

## 10. 세션 페이싱 규칙 (2026-09-01, 사용자 확정) — ACCESS_DENIED 예방 차원

과거엔 48개를 한 세션에 다 끝내려다 24개째부터 막혔다. 다음부터는 아래 세 가지를
기본값으로 지킬 것 (사용자가 명시적으로 확정함):

1. **세션당 처리 상한 20개** — 20개 매장을 처리했으면(신규 데이터가 없어 스킵한 매장도
   "처리"로 카운트) 그 시점에서 스스로 멈추고 "여기까지 반영했고 나머지는 다음에"라고
   보고할 것. 사용자가 "계속해줘"라고 명시적으로 말하지 않는 한 20개를 넘겨서 계속
   돌리지 않는다.
2. **병렬 탭 4개 → 2개로 축소** — 요청 속도를 낮춰서 이상탐지에 덜 걸리게 한다. 급하다고
   탭을 다시 늘리지 말 것.
3. **가능하면 매일 반영** — "일주일치 밀린 걸 몰아서" 하지 말고 매일(또는 최대한 자주)
   "어제자만" 반영하는 루틴으로 유도한다. 매장당 처리할 신규 주문이 적어지고 세션
   자체도 짧아져서, ACCESS_DENIED가 걸릴 확률과 걸렸을 때의 피해 범위(며칠치 밀린
   매장 수)가 둘 다 줄어든다. 사용자가 "보스피자 쿠팡이츠 로그인했으니 반영해줘"라고
   할 때 마지막 반영일이 이미 여러 날 밀려있으면(예: 3일 이상), 이 사실을 먼저
   짚어주고 매일 하는 걸 권할 것.
