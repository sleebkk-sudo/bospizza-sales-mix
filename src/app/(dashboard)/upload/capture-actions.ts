"use server";

import { revalidatePath } from "next/cache";
import { saveSalesCapture, type CaptureMenuLine } from "@/lib/data";

export async function submitSalesCapture(formData: FormData) {
  const saleDate = String(formData.get("saleDate") ?? "").trim();
  const storeName = String(formData.get("storeName") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const menuItemsRaw = String(formData.get("menuItems") ?? "[]");
  const fallbackRevenueRaw = String(formData.get("fallbackRevenue") ?? "").trim();
  const fallbackOrdersRaw = String(formData.get("fallbackOrders") ?? "").trim();

  if (!saleDate || !storeName || !channel) {
    return { ok: false, error: "날짜, 매장, 배달앱을 모두 입력해주세요." };
  }

  let menuItems: CaptureMenuLine[];
  try {
    menuItems = JSON.parse(menuItemsRaw);
  } catch {
    return { ok: false, error: "메뉴 항목을 읽지 못했습니다." };
  }

  const fallbackRevenue = fallbackRevenueRaw ? Number(fallbackRevenueRaw) : null;
  const fallbackOrders = fallbackOrdersRaw ? Number(fallbackOrdersRaw) : null;

  if (menuItems.length === 0 && !fallbackRevenue) {
    return { ok: false, error: "메뉴 항목이나 매출액 중 하나는 있어야 합니다." };
  }

  const { error } = await saveSalesCapture({
    saleDate,
    storeName,
    channel,
    menuItems,
    fallbackRevenue,
    fallbackOrders,
  });
  if (error) return { ok: false, error };

  revalidatePath("/");
  return { ok: true };
}
