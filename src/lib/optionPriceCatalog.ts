// 배달앱(요기요/배민/쿠팡이츠) 메뉴 옵션 마스터 가격표. 실제 매출/건수는 프로모션·리뷰
// 이벤트 등으로 0원 처리되는 경우가 섞여있어 평균 단가가 흔들리므로, 옵션별 판매 믹스
// 표의 "가격" 컬럼은 이 고정 카탈로그 값을 그대로 노출한다 (2026-09-02 대표 제공 스크린샷 기준).
export const OPTION_PRICE_CATALOG: Record<string, Record<string, number>> = {
  사이즈: { M: 0, L: 3000 },
  "도우 선택": {
    "기본 도우": 0,
    고구마링: 2000,
    치즈크러스트: 3000,
    크림치즈링: 2000,
    더블치즈크러스트: 5000,
  },
  추가토핑: {
    "옥수수(50g)": 500,
    "올리브(50g)": 500,
    "반달감자(8개)": 1000,
    "파인애플(6개)": 1000,
    "베이컨(8장)": 1000,
    "카나디언햄(12장)": 1000,
    "페퍼로니(12장)": 1000,
    "바베큐치킨(100g)": 2000,
    "불갈비(60g)": 3000,
    "불고기(60g)": 2500,
    "스파이스치킨(60g)": 2000,
    "새우(8개)": 2000,
  },
  추가메뉴: { 피클: 500, 핫소스: 100, 치즈가루: 100, 갈릭디핑소스: 500 },
  "음료 추가": {
    콜라500: 2300,
    "콜라1.25": 2800,
    제로콜라500: 2300,
    "제로콜라1.25": 2800,
    사이다500: 2300,
    "사이다1.25": 2800,
  },
  리뷰이벤트: {
    "선택 안함": 0,
    피클: 0,
    갈릭디핑소스: 0,
    고구마링: 500,
    콜라500: 900,
    "콜라1.25": 1500,
    치즈토핑: 1500,
    "소금구이 닭꼬치": 1900,
    "불갈비 닭꼬치": 1900,
    "명란 닭꼬치": 1900,
    불닭꼬치: 1900,
    "통새우링 4p": 2000,
    "윙&봉 6p": 2900,
    "치즈오븐 스파게티": 3500,
  },
};

// 옵션별 판매 믹스에는 이 카탈로그에 등록된 카테고리·옵션만 노출한다 ("사이드 선택"처럼
// 정식 옵션표에 없는 카테고리나, 원본 표기가 갈라져 나오는 옵션은 화면에서 제외/통합).
export const OPTION_CATALOG_CATEGORIES = Object.keys(OPTION_PRICE_CATALOG);

// 원본 파일마다 표기가 갈라지는 것들을 카탈로그 키로 맞춘다.
// - 요기요 음료명은 "500ml"/"1.25L" 단위가 붙어 내려온다 (카탈로그/배민 표기는 "콜라500").
// - 요기요는 리뷰이벤트 미참여를 "참여 안함"으로, 배민은 "선택 안함"으로 표기한다 — 같은 옵션.
// - 배민 사이즈는 "L(8조각)"/"M(6조각)"처럼 조각수가 붙어 내려올 때가 있다 — 기본 사이즈와 같은 옵션.
export function normalizeOptionName(category: string, name: string): string {
  if (category === "리뷰이벤트" && name === "참여 안함") return "선택 안함";
  if (category === "사이즈") return name.replace(/\(\d+조각\)$/, "");
  const match = name.match(/^(.+?)(\d+(?:\.\d+)?)(ml|L)$/i);
  return match ? `${match[1]}${match[2]}` : name;
}

export function getCatalogPrice(category: string, optionName: string): number | null {
  const table = OPTION_PRICE_CATALOG[category];
  if (!table) return null;
  const key = normalizeOptionName(category, optionName);
  return key in table ? table[key] : null;
}

export function isCatalogOption(category: string, optionName: string): boolean {
  return getCatalogPrice(category, optionName) !== null;
}
