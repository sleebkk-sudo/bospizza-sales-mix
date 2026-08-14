"use server";

import { revalidatePath } from "next/cache";
import { upsertMenuCost } from "@/lib/data";

export async function saveMenuCost(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const cost = Number(formData.get("cost") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!name || !Number.isFinite(cost)) return;

  await upsertMenuCost(name, cost, note);
  revalidatePath("/costs");
  revalidatePath("/");
}
