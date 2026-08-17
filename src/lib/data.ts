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
};

export type DailyStat = {
  sale_date: string;
  store_name: string;
  order_count: number;
  total_qty: number;
  total_revenue: number;
};

export type MenuCost = {
  name: string;
  cost: number;
  note: string | null;
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

export async function getItemsInRange(
  from: string,
  to: string,
  store: string | null
): Promise<SalesItem[]> {
  let query = supabase
    .from("menu_sales_items")
    .select("id, category, product_name, qty, revenue, store_name, sale_date")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (store) query = query.eq("store_name", store);
  const { data } = await query;
  return (data ?? []) as SalesItem[];
}

export async function getDailyStatsInRange(
  from: string,
  to: string,
  store: string | null
): Promise<DailyStat[]> {
  let query = supabase
    .from("store_daily_stats")
    .select("sale_date, store_name, order_count, total_qty, total_revenue")
    .gte("sale_date", from)
    .lte("sale_date", to);
  if (store) query = query.eq("store_name", store);
  const { data } = await query;
  return (data ?? []) as DailyStat[];
}

export async function getMenuCosts(): Promise<MenuCost[]> {
  const { data } = await supabase.from("menu_costs").select("*").order("name");
  return (data ?? []) as MenuCost[];
}

export async function upsertMenuCost(name: string, cost: number, note: string): Promise<void> {
  await supabase
    .from("menu_costs")
    .upsert({ name, cost, note: note || null, updated_at: new Date().toISOString() });
}
