"use server";

import { revalidatePath } from "next/cache";
import { insertReviews, type NewReview } from "@/lib/data";
import { sentimentFromRating } from "@/lib/reviewOcr";
import { supabase } from "@/lib/supabase";

export type ReviewDraft = {
  date: string;
  rating: number | null;
  text: string;
  orderMenu: string | null;
};

export async function submitReviews(formData: FormData) {
  const storeName = String(formData.get("storeName") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim();
  const draftsRaw = String(formData.get("drafts") ?? "[]");

  if (!storeName || !channel) {
    return { ok: false, error: "매장과 배달앱을 선택해주세요." };
  }

  let drafts: ReviewDraft[];
  try {
    drafts = JSON.parse(draftsRaw);
  } catch {
    return { ok: false, error: "리뷰 데이터를 읽지 못했습니다." };
  }

  const reviews: NewReview[] = drafts
    .filter((d) => d.text && d.text.trim().length > 0)
    .map((d) => ({
      reviewDate: d.date,
      storeName,
      channel,
      rating: d.rating,
      sentiment: sentimentFromRating(d.rating ?? undefined),
      reviewText: d.text.trim(),
      orderMenu: d.orderMenu ?? null,
    }));

  if (reviews.length === 0) {
    return { ok: false, error: "저장할 리뷰가 없습니다." };
  }

  const { inserted, error } = await insertReviews(reviews);
  if (error) return { ok: false, error };

  revalidatePath("/reviews");
  return { ok: true, inserted };
}

export async function addStore(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await supabase.from("stores").upsert({ name: trimmed }, { onConflict: "name", ignoreDuplicates: true });
  revalidatePath("/reviews");
}
