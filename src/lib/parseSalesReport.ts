import * as XLSX from "xlsx";

export type ParsedSalesRow = {
  category: string;
  productName: string;
  qty: number;
  revenue: number;
  storeName: string | null;
};

export type ParsedSalesReport = {
  rows: ParsedSalesRow[];
  totalQty: number;
  totalRevenue: number;
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

function categorizeMenuName(name: string): string {
  if (name.includes("+사이드+음료") || name.includes("세트")) return "세트";
  if (name.includes("피자")) return "피자";
  if (name.includes("스파게티") || name.includes("파스타")) return "파스타";
  if (DRINK_KEYWORDS.some((k) => name.includes(k))) return "음료";
  return "사이드";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[,\s원]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function readSheetRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

// 배달앱(요기요 등)에서 내려받는 브랜드 단위 주문 리포트.
// 프랜차이즈명/가게명/메뉴유형(MENU|OPTION) 컬럼이 있는 원본 export 형식을 그대로 지원한다.
// MENU 행만 실제 매출을 담고 있고, OPTION 행(사이즈/도우 선택 등)은 그 아래 딸린
// 옵션 선택일 뿐이라 매출 집계에서 제외한다 (이미 상위 MENU 행의 주문금액에 포함됨).
function parseBrandOrderReport(raw: Record<string, unknown>[]): ParsedSalesReport {
  const groups = new Map<string, ParsedSalesRow>();

  for (const record of raw) {
    const menuType = String(record["메뉴유형"] ?? "").trim();
    if (menuType !== "MENU") continue;

    const productName = String(record["메뉴명"] ?? "").trim();
    if (!productName) continue;

    const storeName = String(record["가게명"] ?? "").trim() || null;
    const qty = toNumber(record["메뉴or옵션수량"]);
    const revenue = toNumber(record["주문금액"]);
    const key = `${storeName ?? ""}__${productName}`;

    const existing = groups.get(key);
    if (existing) {
      existing.qty += qty;
      existing.revenue += revenue;
    } else {
      groups.set(key, {
        category: categorizeMenuName(productName),
        productName,
        qty,
        revenue,
        storeName,
      });
    }
  }

  const rows = [...groups.values()];
  if (rows.length === 0) {
    throw new Error("MENU 타입 행을 찾지 못했습니다. 파일 형식을 확인해주세요.");
  }

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  return { rows, totalQty, totalRevenue };
}

// 자체 정의한 4컬럼 템플릿 (카테고리, 메뉴명, 수량, 매출액) — 매장 구분 없음.
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
    const row: Partial<Omit<ParsedSalesRow, "storeName">> = {};
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
    });
  }

  if (rows.length === 0) {
    throw new Error("유효한 데이터 행이 없습니다.");
  }

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  return { rows, totalQty, totalRevenue };
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

  return isBrandOrderReport ? parseBrandOrderReport(raw) : parseGenericTemplate(raw);
}
