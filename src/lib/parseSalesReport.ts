import * as XLSX from "xlsx";

export type ParsedSalesRow = {
  category: string;
  productName: string;
  qty: number;
  revenue: number;
  storeName: string | null;
  saleDate: string | null;
  channel: string | null;
};

export type ParsedDailyStat = {
  storeName: string;
  saleDate: string;
  channel: string;
  orderCount: number;
  totalQty: number;
  totalRevenue: number;
};

// 반반피자류(메뉴명에 "반반" 포함) 주문에서 실제로 고른 두 가지 맛의 조합.
// 예: baseProduct "반반피자", comboLabel "더블치즈 피자 + 슈퍼콤비네이션 피자".
export type ParsedComboRow = {
  saleDate: string;
  storeName: string | null;
  channel: string;
  baseProduct: string;
  comboLabel: string;
  qty: number;
};

// 피자 주문 시 고르는 옵션(맛 선택 제외) 한 건. category는 "사이즈"/"도우 선택"/
// "추가토핑"/"추가메뉴"/"음료 추가"/"리뷰이벤트"/"사이드 선택" 중 하나.
export type ParsedOptionSelection = {
  saleDate: string;
  storeName: string | null;
  channel: string;
  category: string;
  optionName: string;
  qty: number;
  revenue: number;
};

export type ParsedSalesReport = {
  rows: ParsedSalesRow[];
  dailyStats: ParsedDailyStat[];
  combos: ParsedComboRow[];
  optionSelections: ParsedOptionSelection[];
  totalQty: number;
  totalRevenue: number;
  // 파일에서 날짜를 읽을 수 있으면 자동으로 채워짐 (브랜드 주문 리포트). 없으면 null —
  // 업로드 폼에서 직접 입력한 기간을 그대로 쓴다 (자체 4컬럼 템플릿).
  periodStart: string | null;
  periodEnd: string | null;
};

const GENERIC_HEADER_ALIASES: Record<string, "category" | "productName" | "qty" | "revenue"> = {
  카테고리: "category",
  분류: "category",
  메뉴명: "productName",
  상품명: "productName",
  메뉴: "productName",
  수량: "qty",
  판매수량: "qty",
  매출액: "revenue",
  매출: "revenue",
  금액: "revenue",
};

const DRINK_KEYWORDS = ["콜라", "사이다", "환타", "스프라이트", "밀키스", "제로"];
const KEY_SEP = "|||";

// "피자+사이드+음료 세트"처럼 세트 메뉴 이름에 "피자"/"세트"가 같이 들어있는 경우가
// 많아, 세트 여부보다 피자 포함 여부를 먼저 판별해야 한다 — 안 그러면 세트로 나가는
// 피자 판매량이 전부 "세트" 카테고리로 빠져서 피자 판매수량이 실제보다 적게 집계된다.
export function categorizeMenuName(name: string): string {
  if (name.includes("피자")) return "피자";
  if (name.includes("스파게티") || name.includes("파스타")) return "파스타";
  if (DRINK_KEYWORDS.some((k) => name.includes(k))) return "음료";
  if (name.includes("+사이드+음료") || name.includes("세트")) return "세트";
  return "사이드";
}

// "반반피자" 등에서 고른 개별 맛 옵션인지 판별 (사이즈/도우/리뷰이벤트 등 다른 옵션과 구분).
// 반반피자 두 번째 맛에는 "(반/반)"이 붙어 나올 때가 있다.
function isFlavorOptionName(name: string): boolean {
  return /피자(\(반\/반\))?$/.test(name);
}

// 요기요 OPTION 행은 옵션그룹 컬럼이 없어서 옵션명 자체로 카테고리를 판별해야 한다
// (배민은 "옵션그룹이름" 컬럼이 있어 그대로 쓴다 — parseBaeminShopOrderDetail 참고).
// 쿠팡이츠의 "우유도우"는 배민/요기요의 "기본 도우"와 같은 옵션이라 이름을 통일한다.
const DOUGH_NAMES = new Set(["기본 도우", "고구마링", "치즈크러스트", "크림치즈링", "더블치즈크러스트"]);
const TOPPING_BASE_NAMES = [
  "옥수수",
  "올리브",
  "반달감자",
  "파인애플",
  "베이컨",
  "카나디언햄",
  "페퍼로니",
  "바베큐치킨",
  "불갈비",
  "불고기",
  "스파이스치킨",
  "새우",
];
const ADDON_MENU_NAMES = new Set(["피클", "핫소스", "치즈가루", "갈릭디핑소스"]);
const DRINK_PREFIXES = ["콜라", "제로콜라", "사이다"];

function normalizeDoughName(name: string): string {
  return name === "우유도우" ? "기본 도우" : name;
}

// 배민은 "L(8조각)"/"M(6조각)"처럼 조각수가 붙은 사이즈 표기가 그대로 내려올 때가 있다 —
// 기본 사이즈(L/M)와 같은 옵션이라 합친다.
function normalizeSizeName(name: string): string {
  return name.replace(/\(\d+조각\)$/, "");
}

// 피자 맛 선택 옵션(예: "더블페퍼로니 피자")은 반반피자 조합 통계(ComboMixSection)에서
// 이미 다루므로 여기서는 제외(null 반환)한다.
export function classifyOptionSelection(rawName: string): { category: string; optionName: string } | null {
  const name = rawName.trim();
  if (!name) return null;
  if (name.startsWith("[리뷰+사진]") || name === "선택 안함" || name === "참여 안함") {
    const stripped = name.replace(/^\[리뷰\+사진\]/, "");
    return { category: "리뷰이벤트", optionName: stripped || "선택 안함" };
  }
  if (name === "M" || name === "L") return { category: "사이즈", optionName: name };
  const dough = normalizeDoughName(name);
  if (DOUGH_NAMES.has(dough)) return { category: "도우 선택", optionName: dough };
  if (TOPPING_BASE_NAMES.some((base) => name.startsWith(`${base}(`))) return { category: "추가토핑", optionName: name };
  if (ADDON_MENU_NAMES.has(name)) return { category: "추가메뉴", optionName: name };
  if (DRINK_PREFIXES.some((prefix) => name.startsWith(prefix))) return { category: "음료 추가", optionName: name };
  if (isFlavorOptionName(name)) return null;
  return { category: "사이드 선택", optionName: name };
}

// 배민은 "옵션그룹이름" 컬럼이 그대로 카테고리 역할을 한다. "피자 선택"은 반반피자
// 조합 통계에서 이미 다루므로 제외한다.
const BAEMIN_GROUP_TO_CATEGORY: Record<string, string> = {
  "가격/사이즈": "사이즈",
  "도우 선택": "도우 선택",
  "추가 메뉴": "추가메뉴",
  "음료 선택": "음료 추가",
  "리뷰 이벤트": "리뷰이벤트",
  "사이드 선택": "사이드 선택",
};

function comboLabelFor(flavors: string[]): string {
  return [...flavors].sort((a, b) => a.localeCompare(b, "ko")).join(" + ");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[,\s원]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// 배달앱마다 매장명 표기가 달라서("B.BOSS피자 하남미사점" vs "보스피자-하남미사점")
// 같은 매장이 필터에서 따로 잡히지 않도록 "보스피자-XX점" 형태로 통일한다.
// (리뷰 리포트 파서도 그대로 재사용 — parseReviewReport.ts)
export function normalizeStoreName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("보스피자-")) return trimmed;
  const match = trimmed.match(/(\S+점)\s*$/);
  return match ? `보스피자-${match[1]}` : trimmed;
}

function isZipBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 2));
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" — 진짜 .xlsx/.xls(zip 기반) 파일
}

// 큰따옴표로 묶인 필드(콤마·줄바꿈 포함 가능) CSV 파서. 리뷰 내용처럼 필드 안에
// 개행이 들어있는 경우가 흔해서(리뷰 리포트), 줄 단위로 먼저 쪼개면 따옴표 안의
// 개행에서 행이 깨진다 — 그래서 전체 텍스트를 문자 단위로 훑으면서 따옴표 밖에
// 있는 개행만 실제 행 구분자로 취급한다.
// xlsx 라이브러리로 CSV를 읽으면 "2026-08-16" 같은 날짜 문자열을 엑셀 시리얼 숫자로
// 잘못 해석하는 문제가 있어, CSV는 직접 파싱해서 원본 문자열을 그대로 보존한다.
function parseCsvText(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\r") {
      // \r\n의 \n에서 행을 끊으므로 여기서는 무시
    } else if (ch === "\n") {
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (nonEmptyRows.length === 0) return [];

  const headers = nonEmptyRows[0].map((h) => h.trim());
  return nonEmptyRows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

export function readSheetRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  if (isZipBuffer(buffer)) {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });
  }

  let text = new TextDecoder("utf-8").decode(buffer);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM 제거
  return parseCsvText(text);
}

// 배달앱(요기요 등)에서 내려받는 브랜드 단위 주문 리포트.
// 프랜차이즈명/가게명/메뉴유형(MENU|OPTION)/날짜/주문ID 컬럼이 있는 원본 export 형식을 그대로 지원한다.
// MENU 행만 실제 매출을 담고 있고, OPTION 행(사이즈/도우 선택 등)은 그 아래 딸린
// 옵션 선택일 뿐이라 매출 집계에서 제외한다 (이미 상위 MENU 행의 주문금액에 포함됨).
// 다만 반반피자류의 "맛 선택" 옵션(예: "더블치즈 피자")은 조합 통계용으로 따로 모은다.
// 건단가 계산을 위해 (매장, 날짜)별 고유 주문ID 개수도 함께 집계한다.
function parseBrandOrderReport(raw: Record<string, unknown>[]): ParsedSalesReport {
  const CHANNEL = "요기요";
  const productGroups = new Map<string, ParsedSalesRow>();
  const orderIdsByStoreDate = new Map<string, Set<string>>();
  const revenueByStoreDate = new Map<string, number>();
  const qtyByStoreDate = new Map<string, number>();
  const comboGroups = new Map<string, ParsedComboRow>();
  const optionGroups = new Map<string, ParsedOptionSelection>();
  let minDate: string | null = null;
  let maxDate: string | null = null;

  // 반반피자 조합을 같은 주문의 MENU 행과 연결하려면 주문 단위로 묶어야 한다.
  const orderGroups = new Map<string, Record<string, unknown>[]>();
  const orderKeyList: string[] = [];
  for (const record of raw) {
    const orderId = String(record["주문ID"] ?? record["주문번호"] ?? "").trim();
    const groupKey = orderId || `__row_${orderKeyList.length}`;
    if (!orderGroups.has(groupKey)) {
      orderGroups.set(groupKey, []);
      orderKeyList.push(groupKey);
    }
    orderGroups.get(groupKey)!.push(record);
  }

  for (const groupKey of orderKeyList) {
    const orderRows = orderGroups.get(groupKey)!;
    const first = orderRows[0];
    const storeName = normalizeStoreName(String(first["가게명"] ?? "").trim()) || "미상";
    const saleDate = String(first["날짜"] ?? "").trim() || null;
    const orderId = String(first["주문ID"] ?? first["주문번호"] ?? "").trim();

    if (saleDate) {
      if (!minDate || saleDate < minDate) minDate = saleDate;
      if (!maxDate || saleDate > maxDate) maxDate = saleDate;
    }

    const menuRows = orderRows.filter((r) => String(r["메뉴유형"] ?? "").trim() === "MENU");
    if (menuRows.length === 0) continue;

    // 주문ID는 MENU 행이 있는 주문만 센다 — OPTION 행만 있고 MENU 행이 아직 없는 주문(예:
    // 리포트를 하루 중간에 받아서 아직 결제 완료 전인 주문)까지 건수에 잡히는 걸 방지.
    if (orderId && saleDate) {
      const sdKey = `${storeName}${KEY_SEP}${saleDate}`;
      if (!orderIdsByStoreDate.has(sdKey)) orderIdsByStoreDate.set(sdKey, new Set());
      orderIdsByStoreDate.get(sdKey)!.add(orderId);
    }

    const optionRows = orderRows.filter((r) => String(r["메뉴유형"] ?? "").trim() === "OPTION");
    const flavorOptions = optionRows
      .map((r) => String(r["옵션명"] ?? "").trim())
      .filter((name) => isFlavorOptionName(name));
    let flavorCursor = 0;

    if (saleDate) {
      for (const record of optionRows) {
        const classified = classifyOptionSelection(String(record["옵션명"] ?? ""));
        if (!classified) continue;
        const qty = toNumber(record["메뉴or옵션수량"]);
        const revenue = toNumber(record["주문금액"]);
        const optKey = `${storeName}${KEY_SEP}${saleDate}${KEY_SEP}${classified.category}${KEY_SEP}${classified.optionName}`;
        const existingOpt = optionGroups.get(optKey);
        if (existingOpt) {
          existingOpt.qty += qty;
          existingOpt.revenue += revenue;
        } else {
          optionGroups.set(optKey, {
            saleDate,
            storeName,
            channel: CHANNEL,
            category: classified.category,
            optionName: classified.optionName,
            qty,
            revenue,
          });
        }
      }
    }

    for (const record of menuRows) {
      const productName = String(record["메뉴명"] ?? "").trim();
      if (!productName) continue;

      const qty = toNumber(record["메뉴or옵션수량"]);
      const revenue = toNumber(record["주문금액"]);
      const key = `${storeName}${KEY_SEP}${productName}${KEY_SEP}${saleDate ?? ""}`;

      const existing = productGroups.get(key);
      if (existing) {
        existing.qty += qty;
        existing.revenue += revenue;
      } else {
        productGroups.set(key, {
          category: categorizeMenuName(productName),
          productName,
          qty,
          revenue,
          storeName,
          saleDate,
          channel: CHANNEL,
        });
      }

      if (saleDate) {
        const sdKey = `${storeName}${KEY_SEP}${saleDate}`;
        revenueByStoreDate.set(sdKey, (revenueByStoreDate.get(sdKey) ?? 0) + revenue);
        qtyByStoreDate.set(sdKey, (qtyByStoreDate.get(sdKey) ?? 0) + qty);
      }

      if (saleDate && productName.includes("반반") && flavorCursor + 1 < flavorOptions.length) {
        const comboLabel = comboLabelFor([flavorOptions[flavorCursor], flavorOptions[flavorCursor + 1]]);
        flavorCursor += 2;
        const comboKey = `${storeName}${KEY_SEP}${saleDate}${KEY_SEP}${productName}${KEY_SEP}${comboLabel}`;
        const existingCombo = comboGroups.get(comboKey);
        if (existingCombo) existingCombo.qty += qty;
        else
          comboGroups.set(comboKey, {
            saleDate,
            storeName,
            channel: CHANNEL,
            baseProduct: productName,
            comboLabel,
            qty,
          });
      }
    }
  }

  const rows = [...productGroups.values()];
  if (rows.length === 0) {
    throw new Error("MENU 타입 행을 찾지 못했습니다. 파일 형식을 확인해주세요.");
  }

  const dailyStats: ParsedDailyStat[] = [...orderIdsByStoreDate.entries()].map(([key, orderIds]) => {
    const [storeName, saleDate] = key.split(KEY_SEP);
    return {
      storeName,
      saleDate,
      channel: CHANNEL,
      orderCount: orderIds.size,
      totalQty: qtyByStoreDate.get(key) ?? 0,
      totalRevenue: revenueByStoreDate.get(key) ?? 0,
    };
  });

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return {
    rows,
    dailyStats,
    combos: [...comboGroups.values()],
    optionSelections: [...optionGroups.values()],
    totalQty,
    totalRevenue,
    periodStart: minDate,
    periodEnd: maxDate,
  };
}

// 배민(배달의민족) "가게별 주문 상세(취소, 옵션 포함)" 리포트.
// 한 상품에 옵션이 여러 개면 옵션 그룹마다 행이 반복되고, "상품금액/상품 총 금액"은
// 그 상품 인스턴스의 최종 금액(옵션까지 반영된 값)이 모든 옵션 행에 동일하게 반복된다
// — 즉 옵션 총 금액을 또 더하면 이중 집계된다. 실제 매출은 (주문번호, 상품명, 상품금액)이
// 연속으로 반복되는 구간을 한 상품 인스턴스로 묶어 그 금액을 한 번만 센다.
// "피자 선택" 옵션그룹은 반반피자류의 맛 조합 통계용으로 따로 모은다.
// 주문상태가 "주문완료"가 아닌 행(주문취소 등)은 전부 제외한다.
function parseBaeminShopOrderDetail(raw: Record<string, unknown>[]): ParsedSalesReport {
  const CHANNEL = "배민";
  const productGroups = new Map<string, ParsedSalesRow>();
  const qtyByStoreDate = new Map<string, number>();
  const revenueByStoreDate = new Map<string, number>();
  const orderCountByStoreDate = new Map<string, number>();
  const comboGroups = new Map<string, ParsedComboRow>();
  const optionGroups = new Map<string, ParsedOptionSelection>();
  const seenOrderIds = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;

  let curOrderNo: string | null = null;
  let curProductName: string | null = null;
  let curProductAmount: string | null = null;
  let curAccum: { storeName: string; saleDate: string; category: string; productName: string; qty: number; revenue: number } | null = null;
  let curFlavors: string[] = [];

  function flushCurrent() {
    if (!curAccum) return;
    const key = `${curAccum.storeName}${KEY_SEP}${curAccum.productName}${KEY_SEP}${curAccum.saleDate}`;
    const existing = productGroups.get(key);
    if (existing) {
      existing.qty += curAccum.qty;
      existing.revenue += curAccum.revenue;
    } else {
      productGroups.set(key, {
        category: curAccum.category,
        productName: curAccum.productName,
        qty: curAccum.qty,
        revenue: curAccum.revenue,
        storeName: curAccum.storeName,
        saleDate: curAccum.saleDate,
        channel: CHANNEL,
      });
    }

    if (curAccum.productName.includes("반반") && curFlavors.length >= 2) {
      const comboLabel = comboLabelFor(curFlavors.slice(0, 2));
      const comboKey = `${curAccum.storeName}${KEY_SEP}${curAccum.saleDate}${KEY_SEP}${curAccum.productName}${KEY_SEP}${comboLabel}`;
      const existingCombo = comboGroups.get(comboKey);
      if (existingCombo) existingCombo.qty += curAccum.qty;
      else
        comboGroups.set(comboKey, {
          saleDate: curAccum.saleDate,
          storeName: curAccum.storeName,
          channel: CHANNEL,
          baseProduct: curAccum.productName,
          comboLabel,
          qty: curAccum.qty,
        });
    }

    curAccum = null;
    curFlavors = [];
  }

  for (const record of raw) {
    if (String(record["주문상태"] ?? "").trim() !== "주문완료") continue;

    const storeName = normalizeStoreName(String(record["가게이름"] ?? "").trim()) || "미상";
    const saleDate = String(record["주문일자"] ?? "").trim() || "";
    const orderNo = String(record["주문번호"] ?? "").trim();
    const productName = String(record["상품명"] ?? "").trim();
    const productAmountRaw = String(record["상품금액"] ?? "").trim();

    if (saleDate) {
      if (!minDate || saleDate < minDate) minDate = saleDate;
      if (!maxDate || saleDate > maxDate) maxDate = saleDate;
    }

    if (orderNo && !seenOrderIds.has(orderNo)) {
      seenOrderIds.add(orderNo);
      const sdKey = `${storeName}${KEY_SEP}${saleDate}`;
      orderCountByStoreDate.set(sdKey, (orderCountByStoreDate.get(sdKey) ?? 0) + 1);
      revenueByStoreDate.set(sdKey, (revenueByStoreDate.get(sdKey) ?? 0) + toNumber(record["주문금액"]));
    }

    if (!productName) continue;

    const sameGroup =
      curAccum && curOrderNo === orderNo && curProductName === productName && curProductAmount === productAmountRaw;

    if (!sameGroup) {
      flushCurrent();
      curOrderNo = orderNo;
      curProductName = productName;
      curProductAmount = productAmountRaw;
      const qty = toNumber(record["상품수"]);
      curAccum = {
        storeName,
        saleDate,
        category: categorizeMenuName(productName),
        productName,
        qty,
        revenue: toNumber(record["상품 총 금액"]),
      };
      const sdKey = `${storeName}${KEY_SEP}${saleDate}`;
      qtyByStoreDate.set(sdKey, (qtyByStoreDate.get(sdKey) ?? 0) + qty);
    }

    const optionGroup = String(record["옵션그룹이름"] ?? "").trim();
    const optionNameRaw = String(record["옵션명"] ?? "").trim();
    if (optionNameRaw && (optionGroup === "피자 선택" || isFlavorOptionName(optionNameRaw))) {
      curFlavors.push(optionNameRaw);
    } else if (optionNameRaw && saleDate) {
      const category = BAEMIN_GROUP_TO_CATEGORY[optionGroup];
      if (category) {
        // 리뷰 이벤트 옵션은 "[리뷰+사진]피클"처럼 접두어가 붙어 나올 때가 있다 —
        // 요기요 쪽(classifyOptionSelection)과 옵션명을 맞추기 위해 여기서도 벗겨낸다.
        const optionName =
          category === "리뷰이벤트"
            ? optionNameRaw.replace(/^\[리뷰\+사진\]/, "") || "선택 안함"
            : category === "사이즈"
              ? normalizeSizeName(optionNameRaw)
              : optionNameRaw;
        const qty = toNumber(record["옵션수"]);
        const revenue = toNumber(record["옵션 총 금액"]);
        const optKey = `${storeName}${KEY_SEP}${saleDate}${KEY_SEP}${category}${KEY_SEP}${optionName}`;
        const existingOpt = optionGroups.get(optKey);
        if (existingOpt) {
          existingOpt.qty += qty;
          existingOpt.revenue += revenue;
        } else {
          optionGroups.set(optKey, {
            saleDate,
            storeName,
            channel: CHANNEL,
            category,
            optionName,
            qty,
            revenue,
          });
        }
      }
    }
  }
  flushCurrent();

  const rows = [...productGroups.values()];
  if (rows.length === 0) {
    throw new Error("주문완료 상태의 상품 행을 찾지 못했습니다. 파일 형식을 확인해주세요.");
  }

  const dailyStats: ParsedDailyStat[] = [...orderCountByStoreDate.entries()].map(([key, orderCount]) => {
    const [storeName, saleDate] = key.split(KEY_SEP);
    return {
      storeName,
      saleDate,
      channel: CHANNEL,
      orderCount,
      totalQty: qtyByStoreDate.get(key) ?? 0,
      totalRevenue: revenueByStoreDate.get(key) ?? 0,
    };
  });

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return {
    rows,
    dailyStats,
    combos: [...comboGroups.values()],
    optionSelections: [...optionGroups.values()],
    totalQty,
    totalRevenue,
    periodStart: minDate,
    periodEnd: maxDate,
  };
}

// 자체 정의한 4컬럼 템플릿 (카테고리, 메뉴명, 수량, 매출액) — 매장/날짜/채널 구분 없음.
function parseGenericTemplate(raw: Record<string, unknown>[]): ParsedSalesReport {
  const firstRowKeys = Object.keys(raw[0]);
  const fieldByKey = new Map<string, "category" | "productName" | "qty" | "revenue">();
  for (const key of firstRowKeys) {
    const mapped = GENERIC_HEADER_ALIASES[key.trim()];
    if (mapped) fieldByKey.set(key, mapped);
  }

  const missing = (["category", "productName", "qty", "revenue"] as const).filter(
    (field) => ![...fieldByKey.values()].includes(field)
  );
  if (missing.length > 0) {
    throw new Error(
      "필수 컬럼을 찾지 못했습니다: 카테고리, 메뉴명, 수량, 매출액 (헤더명을 확인해주세요)"
    );
  }

  const rows: ParsedSalesRow[] = [];
  for (const record of raw) {
    const row: Partial<Pick<ParsedSalesRow, "category" | "productName" | "qty" | "revenue">> = {};
    for (const [key, field] of fieldByKey) {
      const value = record[key];
      if (field === "qty" || field === "revenue") {
        row[field] = toNumber(value);
      } else {
        row[field] = String(value ?? "").trim();
      }
    }
    if (!row.productName) continue;
    rows.push({
      category: row.category || "미분류",
      productName: row.productName!,
      qty: row.qty ?? 0,
      revenue: row.revenue ?? 0,
      storeName: null,
      saleDate: null,
      channel: null,
    });
  }

  if (rows.length === 0) {
    throw new Error("유효한 데이터 행이 없습니다.");
  }

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  return {
    rows,
    dailyStats: [],
    combos: [],
    optionSelections: [],
    totalQty,
    totalRevenue,
    periodStart: null,
    periodEnd: null,
  };
}

export function parseSalesReport(buffer: ArrayBuffer): ParsedSalesReport {
  const raw = readSheetRows(buffer);
  if (raw.length === 0) {
    throw new Error("업로드한 파일에서 데이터를 찾지 못했습니다.");
  }

  const headerKeys = Object.keys(raw[0]);
  const isBrandOrderReport =
    headerKeys.includes("메뉴유형") &&
    headerKeys.includes("가게명") &&
    headerKeys.includes("주문금액");
  const isBaeminShopOrderDetail =
    headerKeys.includes("가게이름") &&
    headerKeys.includes("주문상태") &&
    headerKeys.includes("상품 총 금액");

  if (isBrandOrderReport) return parseBrandOrderReport(raw);
  if (isBaeminShopOrderDetail) return parseBaeminShopOrderDetail(raw);
  return parseGenericTemplate(raw);
}
