import * as XLSX from "xlsx";

export type ParsedSalesRow = {
  category: string;
  productName: string;
  qty: number;
  revenue: number;
};

export type ParsedSalesReport = {
  rows: ParsedSalesRow[];
  totalQty: number;
  totalRevenue: number;
};

const HEADER_ALIASES: Record<string, keyof ParsedSalesRow> = {
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

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[,\s원]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseSalesReport(buffer: ArrayBuffer): ParsedSalesReport {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (raw.length === 0) {
    throw new Error("업로드한 파일에서 데이터를 찾지 못했습니다.");
  }

  const firstRowKeys = Object.keys(raw[0]);
  const fieldByKey = new Map<string, keyof ParsedSalesRow>();
  for (const key of firstRowKeys) {
    const normalized = key.trim();
    const mapped = HEADER_ALIASES[normalized];
    if (mapped) fieldByKey.set(key, mapped);
  }

  const missing = (["category", "productName", "qty", "revenue"] as const).filter(
    (field) => ![...fieldByKey.values()].includes(field)
  );
  if (missing.length > 0) {
    throw new Error(
      `필수 컬럼을 찾지 못했습니다: 카테고리, 메뉴명, 수량, 매출액 (헤더명을 확인해주세요)`
    );
  }

  const rows: ParsedSalesRow[] = [];
  for (const record of raw) {
    const row: Partial<ParsedSalesRow> = {};
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
    });
  }

  if (rows.length === 0) {
    throw new Error("유효한 데이터 행이 없습니다.");
  }

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return { rows, totalQty, totalRevenue };
}
