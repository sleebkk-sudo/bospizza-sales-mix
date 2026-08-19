import "server-only";
import { supabase } from "@/lib/supabase";
import { categorizeMenuName } from "@/lib/parseSalesReport";

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
  reviewText: string;
  orderMenu: string | null;
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
      })),
      { onConflict: "review_date,store_name,channel,review_text", count: "exact" }
    );
  return { inserted: count ?? reviews.length, error: error?.message ?? null };
}

export type CaptureMenuLine = { name: string; qty: number; revenue: number };

// 캡처 입력(개별 주문영수증 또는 일별 요약 화면)을 저장한다. 같은 매장/날짜에
// 여러 번 캡처(주문 여러 건)해도 서로 덮어쓰지 않도록, 기존 값에 새 값을
// 더해서 저장한다 (파일 업로드의 "스냅샷 통째로 교체" 방식과는 다름).
export async function saveSalesCapture(params: {
  saleDate: string;
  storeName: string;
  channel: string;
  menuItems: CaptureMenuLine[];
  fallbackRevenue: number | null;
  fallbackOrders: number | null;
}): Promise<{ error: string | null }> {
  const { saleDate, storeName, channel, menuItems, fallbackRevenue, fallbackOrders } = params;

  const rows =
    menuItems.length > 0
      ? menuItems.map((m) => ({
          category: categorizeMenuName(m.name),
          product_name: m.name,
          qty: m.qty,
          revenue: m.revenue,
        }))
      : [
          {
            category: "미분류",
            product_name: "쿠팡이츠 매출(캡처입력)",
            qty: fallbackOrders ?? 1,
            revenue: fallbackRevenue ?? 0,
          },
        ];

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("menu_sales_items")
      .select("id, qty, revenue")
      .eq("sale_date", saleDate)
      .eq("store_name", storeName)
      .eq("product_name", row.product_name)
      .eq("channel", channel)
      .maybeSingle();

    const { error } = await supabase.from("menu_sales_items").upsert(
      {
        id: existing?.id,
        category: row.category,
        product_name: row.product_name,
        qty: (existing?.qty ?? 0) + row.qty,
        revenue: (existing?.revenue ?? 0) + row.revenue,
        store_name: storeName,
        sale_date: saleDate,
        channel,
      },
      { onConflict: "sale_date,store_name,product_name,channel" }
    );
    if (error) return { error: error.message };
  }

  const addedRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const addedQty = rows.reduce((s, r) => s + r.qty, 0);
  const addedOrders = fallbackOrders ?? 1;

  const { data: existingStat } = await supabase
    .from("store_daily_stats")
    .select("order_count, total_qty, total_revenue")
    .eq("sale_date", saleDate)
    .eq("store_name", storeName)
    .eq("channel", channel)
    .maybeSingle();

  const { error: statError } = await supabase.from("store_daily_stats").upsert(
    {
      sale_date: saleDate,
      store_name: storeName,
      channel,
      order_count: (existingStat?.order_count ?? 0) + addedOrders,
      total_qty: (existingStat?.total_qty ?? 0) + addedQty,
      total_revenue: (existingStat?.total_revenue ?? 0) + addedRevenue,
    },
    { onConflict: "sale_date,store_name,channel" }
  );
  if (statError) return { error: statError.message };

  await supabase.from("stores").upsert({ name: storeName }, { onConflict: "name", ignoreDuplicates: true });

  return { error: null };
}
