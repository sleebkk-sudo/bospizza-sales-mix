// 리뷰 목록 화면 캡처 한 장에 리뷰가 여러 개 나오므로, 캡처 한 번으로 여러 건을
// 동시에 뽑아낸다. 실제 배달앱 화면으로 검증된 게 아니라 최선의 추정 규칙이라,
// 처음 캡처해보고 잘 안 읽히면 패턴을 조정해야 할 수 있다 (다른 OCR 필드들과
// 마찬가지로 "최선을 다하되 실패하면 사용자가 직접 고친다" 원칙).
export interface ExtractedReview {
  date?: string;
  rating?: number;
  text: string;
  orderMenu?: string;
}

function parseRating(block: string): number | undefined {
  const starMatch = block.match(/[★☆]{2,5}/);
  if (starMatch) {
    const full = (starMatch[0].match(/★/g) ?? []).length;
    if (full > 0) return full;
  }
  const numMatch = block.match(/(?:별점|평점)?\s*([1-5](?:\.\d)?)\s*(?:점|\s*\/\s*5)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseDate(line: string): string | undefined {
  const full = line.match(/(\d{4})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const short = line.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (short) {
    const year = new Date().getFullYear();
    return `${year}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  }
  return undefined;
}

function parseOrderMenu(block: string): string | undefined {
  const m = block.match(/주문\s*메뉴\s*[:：]?\s*(.+)/);
  return m ? m[1].trim() : undefined;
}

function isNoiseLine(line: string): boolean {
  if (parseDate(line)) return true;
  if (/^[★☆\s]+$/.test(line)) return true;
  if (/^(?:별점|평점)?\s*[1-5](?:\.\d)?\s*(?:점|\/\s*5)\s*$/.test(line)) return true;
  if (/주문\s*메뉴/.test(line)) return true;
  if (/^(사장님\s*답글|답글\s*달기|신고|더보기)$/.test(line)) return true;
  return false;
}

// 날짜가 찍힌 줄을 리뷰 하나의 시작으로 보고, 다음 날짜 줄이 나오기 전까지를
// 한 리뷰 블록으로 묶는다. 배달앱 리뷰 카드는 보통 "날짜 → 별점 → 리뷰 텍스트
// → (선택)주문메뉴 → (선택)사장님 답글" 순서로 나온다.
export function parseReviewsFromText(text: string): ExtractedReview[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const reviews: ExtractedReview[] = [];
  let currentDate: string | undefined;
  let blockLines: string[] = [];

  function flush() {
    if (blockLines.length === 0) return;
    const block = blockLines.join("\n");
    const rating = parseRating(block);
    const orderMenu = parseOrderMenu(block);
    const text = blockLines.filter((l) => !isNoiseLine(l)).join(" ").trim();
    if (text || rating !== undefined) {
      reviews.push({ date: currentDate, rating, text, orderMenu });
    }
    blockLines = [];
  }

  for (const line of lines) {
    const date = parseDate(line);
    if (date) {
      flush();
      currentDate = date;
    }
    blockLines.push(line);
  }
  flush();

  return reviews.filter((r) => r.text.length > 0);
}

export function sentimentFromRating(rating: number | undefined): "positive" | "neutral" | "negative" {
  if (rating === undefined) return "neutral";
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

// 저해상도 캡처에서 OCR 정확도가 크게 떨어져서, 작은 이미지는 확대해서 인식시킨다.
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

export async function extractReviewsFromImage(file: File): Promise<ExtractedReview[]> {
  const { recognize } = await import("tesseract.js");
  const processed = await preprocessImage(file).catch(() => file);
  const { data } = await recognize(processed, "kor+eng");
  return parseReviewsFromText(data.text);
}
