import "server-only";
import { supabase } from "@/lib/supabase";

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

export type DailyStat = {
  sale_date: string;
  store_name: string;
  channel: string;
  order_count: number;
  total_qty: number;
  total_revenue: number;
};

export type ComboRow = {
  sale_date: string;
  store_name: string | null;
  channel: string | null;
  base_product: string;
  combo_label: string;
  qty: number;
};

const CHANNELS = ["요기요", "배민", "쿠팡이츠"] as const;

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
  let query = supabase
    .from("menu_sales_items")
    .select("id, category, product_name, qty, revenue, store_name, sale_date, channel")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (store) query = query.eq("store_name", store);
  if (channel) query = query.eq("channel", channel);
  const { data } = await query;
  return (data ?? []) as SalesItem[];
}

export async function getDailyStatsInRange(
  from: string,
  to: string,
  store: string | null,
  channel: string | null
): Promise<DailyStat[]> {
  let query = supabase
    .from("store_daily_stats")
    .select("sale_date, store_name, channel, order_count, total_qty, total_revenue")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (store) query = query.eq("store_name", store);
  if (channel) query = query.eq("channel", channel);
  const { data } = await query;
  return (data ?? []) as DailyStat[];
}

// menu_option_combos에는 메뉴명에 "반반"이 포함된 상품(반반피자, 반반피자+사이드+음료
// 등)의 맛 조합만 쌓인다. base_product로 따로 안 나누고 전부 합쳐서 "반반 조합 전체"로 본다.
export async function getCombosInRange(
  from: string,
  to: string,
  store: string | null,
  channel: string | null
): Promise<ComboRow[]> {
  let query = supabase
    .from("menu_option_combos")
    .select("sale_date, store_name, channel, base_product, combo_label, qty")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (store) query = query.eq("store_name", store);
  if (channel) query = query.eq("channel", channel);
  const { data } = await query;
  return (data ?? []) as ComboRow[];
}

export async function getReviewsInRange(
  from: string,
  to: string,
  store: string | null,
  channel: string | null,
  sentiment: string | null
): Promise<Review[]> {
  let query = supabase
    .from("reviews")
    .select("id, review_date, store_name, channel, rating, sentiment, review_text, order_menu, owner_reply")
    .gte("review_date", from)
    .lte("review_date", to)
    .order("review_date", { ascending: false });
  if (store) query = query.eq("store_name", store);
  if (channel) query = query.eq("channel", channel);
  if (sentiment) query = query.eq("sentiment", sentiment);
  const { data } = await query;
  return (data ?? []) as Review[];
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
