// 쿠팡이츠 매출 캡처 입력용 OCR. 두 종류의 화면을 지원한다:
// ① 개별 주문 영수증 — 메뉴명별 수량/가격이 찍혀있어 메뉴 단위로 집계 가능
// ② 일별 매출 요약 화면 — 총 매출/주문수만 찍혀있어 매장·날짜 단위 합계로만 저장
// 실제 쿠팡이츠 화면으로 검증된 규칙이 아니라 최선의 추정이라, 다른 OCR
// 필드들과 마찬가지로 실패하면 사용자가 직접 값을 고치는 걸 전제로 한다.
export interface ExtractedMenuLine {
  name: string;
  qty: number;
  revenue: number;
}

export interface ExtractedSalesCapture {
  date?: string;
  revenue?: number;
  orders?: number;
  menuItems: ExtractedMenuLine[];
}

function parseNumberNear(text: string, labelPattern: RegExp): number | undefined {
  const combined = new RegExp(`(?:${labelPattern.source})[^0-9]{0,100}([0-9][0-9,]*)`);
  const match = text.match(combined);
  if (!match || !match[1]) return undefined;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(text: string): string | undefined {
  const m = text.match(/(\d{4})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function parseMenuItems(text: string): ExtractedMenuLine[] {
  const items: ExtractedMenuLine[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/(.+?)\s+(\d+)\s*개\s+([0-9][0-9,]*)\s*원/);
    if (!m) continue;
    const name = m[1].trim();
    if (!name) continue;
    if (/즉시\s*할인|결제\s*금액|주문\s*금액|매출\s*액|수수료|이용료|배달비|부가세|정산|광고비/.test(name)) continue;
    const qty = Number(m[2]);
    const revenue = Number(m[3].replace(/,/g, ""));
    if (!Number.isFinite(qty) || !Number.isFinite(revenue)) continue;
    items.push({ name, qty, revenue });
  }
  return items;
}

export function parseSalesCaptureFromText(text: string): ExtractedSalesCapture {
  const date = parseDate(text);
  const revenue = parseNumberNear(text, /매출\s*액|매출|정산\s*금액/);
  const orders = parseNumberNear(text, /주문\s*수(?!\s*금)/);
  const menuItems = parseMenuItems(text);
  return { date, revenue, orders, menuItems };
}

async function preprocessImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width < 1400 ? 2 : 1;
  if (scale === 1) return file;

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/png" });
}

export async function extractSalesCaptureFromImage(file: File): Promise<ExtractedSalesCapture> {
  const { recognize } = await import("tesseract.js");
  const processed = await preprocessImage(file).catch(() => file);
  const { data } = await recognize(processed, "kor+eng");
  return parseSalesCaptureFromText(data.text);
}
