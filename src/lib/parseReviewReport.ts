import { readSheetRows, normalizeStoreName } from "@/lib/parseSalesReport";
import type { NewReview } from "@/lib/data";

// 별점 기준 자동 분류 — schema.sql의 reviews 테이블 코멘트에 명시된 컨벤션과 동일
// (4~5=positive, 3=neutral, 1~2=negative). 별점이 없으면 neutral.
function sentimentFromRating(rating: number | null): "positive" | "neutral" | "negative" {
  if (rating === null) return "neutral";
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

function toRating(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

// 배달의민족 사장님광장 "리뷰 목록" 다운로드 CSV.
// 헤더: 리뷰ID,브랜드명,사업자등록번호,가게번호,가게명,메뉴명,별점,리뷰내용,리뷰상태,
//       작성일시,수정일시,사장님댓글작성일자,사장님댓글
function parseBaeminReviewList(raw: Record<string, unknown>[]): NewReview[] {
  const rows: NewReview[] = [];
  for (const record of raw) {
    const storeRaw = String(record["가게명"] ?? "").trim();
    if (!storeRaw) continue;
    const storeName = normalizeStoreName(storeRaw);

    const reviewDate = String(record["작성일시"] ?? "").trim().slice(0, 10);
    if (!reviewDate) continue;

    const rating = toRating(String(record["별점"] ?? ""));
    const reviewText = String(record["리뷰내용"] ?? "").trim();
    const orderMenu = String(record["메뉴명"] ?? "").trim();
    const ownerComment = String(record["사장님댓글"] ?? "").trim();

    rows.push({
      reviewDate,
      storeName,
      channel: "배민",
      rating,
      sentiment: sentimentFromRating(rating),
      reviewText: reviewText || null,
      orderMenu: orderMenu || null,
      ownerReply: ownerComment.length > 0,
    });
  }
  return rows;
}

// 파일이 리뷰 리포트 형식이면 파싱해서 돌려주고, 아니면 null — 매출 리포트
// 파서(parseSalesReport)로 넘어가도록 호출부에서 폴백 처리.
export function tryParseReviewReport(buffer: ArrayBuffer): NewReview[] | null {
  const raw = readSheetRows(buffer);
  if (raw.length === 0) return null;

  const headerKeys = Object.keys(raw[0]);
  const isBaeminReviewList =
    headerKeys.includes("리뷰ID") &&
    headerKeys.includes("가게명") &&
    headerKeys.includes("별점") &&
    headerKeys.includes("리뷰내용");

  if (isBaeminReviewList) return parseBaeminReviewList(raw);
  return null;
}
