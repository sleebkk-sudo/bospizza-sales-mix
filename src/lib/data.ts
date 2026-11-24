import "server-only";
import { supabase } from "@/lib/supabase";
import { OPTION_CATALOG_CATEGORIES } from "@/lib/optionPriceCatalog";

export type SalesItem = {
  id: string;
  category: string;
  product_name: string;
  qty: number;
  revenue: number;
  store_name: string | null;
  sale_date: string | null;
  channel: string | null;
};

const CHANNELS = ["요기요", "배민", "쿠팡이츠"] as const;

// Supabase(PostgREST)는 별도 range 지정이 없으면 결과를 최대 1000행으로 잘라서 돌려준다
// (오류 없이 조용히 잘림) — 매출/옵션 등 조회 기간이 넓어지면 1000행을 넘기는 경우가
// 실제로 있어서(2026-09-02, 1주일치 매출행 1481건에서 발견), 모든 range 조회 함수는
// 이 헬퍼로 1000행씩 끝까지 페이지네이션한다. 페이지 간 순서를 고정하려면 반드시 안정된
// 정렬(id 등)이 필요하다 — 정렬 없이 range만 반복하면 페이지 사이에 행이 누락/중복될 수 있음.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildPage: (rangeFrom: number, rangeTo: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await buildPage(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

// 옵션별 판매 믹스에 노출할 카테고리 — 정식 옵션 가격표(optionPriceCatalog)에 등록된
// 카테고리만 다룬다 ("사이드 선택"처럼 가격표에 없는 카테고리는 제외).
const OPTION_CATEGORIES = OPTION_CATALOG_CATEGORIES;

export type Review = {
  id: string;
  review_date: string;
  store_name: string;
  channel: string;
  rating: number | null;
  sentiment: "positive" | "neutral" | "negative";
  review_text: string | null;
  order_menu: string | null;
  owner_reply: boolean;
};

export type NewReview = {
  reviewDate: string;
  storeName: string;
  channel: string;
  rating: number | null;
  sentiment: "positive" | "neutral" | "negative";
  reviewText: string | null;
  orderMenu: string | null;
  ownerReply: boolean;
};

export async function getDateBounds(): Promise<{ min: string | null; max: string | null }> {
  const [{ data: minRow }, { data: maxRow }] = await Promise.all([
    supabase
      .from("menu_sales_snapshots")
      .select("period_start")
      .order("period_start", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("menu_sales_snapshots")
      .select("period_end")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    min: (minRow?.period_start as string) ?? null,
    max: (maxRow?.period_end as string) ?? null,
  };
}

export async function getStoreNames(): Promise<string[]> {
  const { data } = await supabase.from("stores").select("name").order("name");
  return (data ?? []).map((r) => r.name as string);
}

// 채널은 파일 형식(요기요/배민)에서 고정된 값만 나오므로 테이블 스캔 없이 고정 목록을 쓴다.
export function getChannels(): readonly string[] {
  return CHANNELS;
}

export async function getItemsInRange(
  from: string,
  to: string,
  store: string | null,
  channel: string | null
): Promise<SalesItem[]> {
  return fetchAllRows<SalesItem>((rangeFrom, rangeTo) => {
    let query = supabase
      .from("menu_sales_items")
      .select("id, category, product_name, qty, revenue, store_name, sale_date, channel")
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("id", { ascending: true })
      .range(rangeFrom, rangeTo);
    if (store) query = query.eq("store_name", store);
    if (channel) query = query.eq("channel", channel);
    return query as unknown as PromiseLike<{ data: SalesItem[] | null }>;
  });
}

// 피자 맛 선택을 제외한 옵션(사이즈/도우/토핑/추가메뉴/음료/리뷰이벤트/사이드) 카테고리 목록.
export function getOptionCategories(): readonly string[] {
  return OPTION_CATEGORIES;
}

export type DashboardData = {
  menu: { productName: string; category: string; qty: number; revenue: number }[];
  stores: { storeName: string; qty: number; pizzaQty: number; revenue: number; orderCount: number }[];
  trend: { label: string; revenue: number }[];
  orderCount: number;
  statsRevenue: number;
  combos: { label: string; qty: number }[];
  options: { category: string; name: string; qty: number; revenue: number }[];
};

// 대시보드 한 화면에 필요한 집계를 Postgres 함수(get_dashboard, supabase/schema.sql)에서
// 한 번에 받아온다. 원본 행을 1000개씩 페이지네이션해 가져와 JS에서 합치던 방식은
// 조회 기간이 넓어지면 왕복이 수십 번 생겨 필터 클릭이 수 초씩 걸렸다.
export async function getDashboardData(
  from: string,
  to: string,
  store: string | null,
  channel: string | null
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("get_dashboard", {
    p_from: from,
    p_to: to,
    p_store: store,
    p_channel: channel,
  });
  if (error) throw new Error(`get_dashboard failed: ${error.message}`);
  return data as DashboardData;
}

// 업로드 화면의 "등록 상태" 표에 쓰는 채널 — 파일 업로드로 채우는 채널만 다룬다.
// 쿠팡이츠는 브랜드 리포트 파일이 없어 매장별 크롤링이 필요해서 수집을 중단했으므로
// (2026-11-24) 등록 상태 대상에서 뺀다.
export const REGISTRATION_CHANNELS = ["배민", "요기요"] as const;

// 채널별로 브랜드 리포트에 잡히는(집계 가능한) 매장 수. 배민은 전체 285개점 중 210개만
// 리포트에 들어온다 (2026-11-24 대표 확인) — 매장 수가 바뀌면 이 값을 고친다.
export const CHANNEL_STORE_COVERAGE: Record<string, { reportable: number; total: number } | undefined> = {
  배민: { reportable: 210, total: 285 },
};

export type RegistrationCell = { orders: number; revenue: number; stores: number };
export type RegistrationDay = {
  date: string;
  byChannel: Record<string, RegistrationCell | null>;
};

// from~to의 날짜마다 채널별로 데이터가 등록돼 있는지(주문 수·매출·매장 수) 돌려준다.
// 최신 날짜가 먼저 오도록 정렬한다. 집계는 Postgres 함수(get_registration_status)가 한다.
export async function getRegistrationStatus(from: string, to: string): Promise<RegistrationDay[]> {
  const { data, error } = await supabase.rpc("get_registration_status", { p_from: from, p_to: to });
  if (error) throw new Error(`get_registration_status failed: ${error.message}`);

  const cells = new Map<string, RegistrationCell>();
  for (const row of (data ?? []) as { date: string; channel: string; orders: number; revenue: number; stores: number }[]) {
    cells.set(`${row.date}|${row.channel}`, { orders: row.orders, revenue: row.revenue, stores: row.stores });
  }

  const days: RegistrationDay[] = [];
  const cursor = new Date(`${to}T00:00:00Z`);
  const start = new Date(`${from}T00:00:00Z`);
  while (cursor >= start) {
    const date = cursor.toISOString().slice(0, 10);
    const byChannel: Record<string, RegistrationCell | null> = {};
    for (const channel of REGISTRATION_CHANNELS) {
      byChannel[channel] = cells.get(`${date}|${channel}`) ?? null;
    }
    days.push({ date, byChannel });
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

export async function getReviewsInRange(
  from: string,
  to: string,
  store: string | null,
  channel: string | null,
  sentiment: string | null
): Promise<Review[]> {
  return fetchAllRows<Review>((rangeFrom, rangeTo) => {
    let query = supabase
      .from("reviews")
      .select("id, review_date, store_name, channel, rating, sentiment, review_text, order_menu, owner_reply")
      .gte("review_date", from)
      .lte("review_date", to)
      .order("review_date", { ascending: false })
      .order("id", { ascending: true })
      .range(rangeFrom, rangeTo);
    if (store) query = query.eq("store_name", store);
    if (channel) query = query.eq("channel", channel);
    if (sentiment) query = query.eq("sentiment", sentiment);
    return query as unknown as PromiseLike<{ data: Review[] | null }>;
  });
}

export async function getReviewStoreNames(): Promise<string[]> {
  const { data } = await supabase.from("reviews").select("store_name");
  return [...new Set((data ?? []).map((r) => r.store_name as string))].sort((a, b) => a.localeCompare(b, "ko"));
}

export async function getReviewDateBounds(): Promise<{ min: string | null; max: string | null }> {
  const [{ data: minRow }, { data: maxRow }] = await Promise.all([
    supabase.from("reviews").select("review_date").order("review_date", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("reviews").select("review_date").order("review_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    min: (minRow?.review_date as string) ?? null,
    max: (maxRow?.review_date as string) ?? null,
  };
}

export type AdCampaign = {
  store_name: string;
  is_active: boolean;
  campaign_started_at: string | null;
  cps_all: number | null;
  cps_reorder: number | null;
  cps_new: number | null;
};

export async function getAdCampaigns(): Promise<AdCampaign[]> {
  const { data } = await supabase
    .from("ad_campaigns")
    .select("store_name, is_active, campaign_started_at, cps_all, cps_reorder, cps_new")
    .order("store_name");
  return (data ?? []) as AdCampaign[];
}

export async function insertReviews(reviews: NewReview[]): Promise<{ inserted: number; error: string | null }> {
  if (reviews.length === 0) return { inserted: 0, error: null };
  const { error, count } = await supabase
    .from("reviews")
    .upsert(
      reviews.map((r) => ({
        review_date: r.reviewDate,
        store_name: r.storeName,
        channel: r.channel,
        rating: r.rating,
        sentiment: r.sentiment,
        review_text: r.reviewText,
        order_menu: r.orderMenu,
        owner_reply: r.ownerReply,
      })),
      { onConflict: "review_date,store_name,channel,review_text", count: "exact" }
    );
  return { inserted: count ?? reviews.length, error: error?.message ?? null };
}
