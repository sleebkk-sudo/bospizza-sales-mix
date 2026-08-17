import "server-only";
import { supabase } from "@/lib/supabase";

export type Snapshot = {
  id: string;
  period_start: string;
  period_end: string;
  uploaded_at: string;
  total_qty: number;
  total_revenue: number;
};

export type SalesItem = {
  id: string;
  snapshot_id: string;
  category: string;
  product_name: string;
  qty: number;
  revenue: number;
  store_name: string | null;
};

export type MenuCost = {
  name: string;
  cost: number;
  note: string | null;
};

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  const { data } = await supabase
    .from("menu_sales_snapshots")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Snapshot | null;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const { data } = await supabase
    .from("menu_sales_snapshots")
    .select("*")
    .order("period_start", { ascending: true });
  return (data ?? []) as Snapshot[];
}

export async function getItemsForSnapshot(snapshotId: string): Promise<SalesItem[]> {
  const { data } = await supabase
    .from("menu_sales_items")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("revenue", { ascending: false });
  return (data ?? []) as SalesItem[];
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
