import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { parseSalesReport } from "@/lib/parseSalesReport";
import { tryParseReviewReport } from "@/lib/parseReviewReport";
import { insertReviews } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (process.env.DASHBOARD_PASSWORD) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!(await verifySessionToken(token))) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const formPeriodStart = String(formData.get("periodStart") ?? "").trim() || null;
  const formPeriodEnd = String(formData.get("periodEnd") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // 리뷰 리포트(배민 "리뷰 목록" CSV 등)는 매출 리포트와 완전히 다른 테이블
  // (reviews)에 저장되고, 기간 스냅샷 개념도 없다 — 헤더로 먼저 판별해서
  // 매출 파싱 경로를 타지 않고 바로 처리한다.
  let reviewRows;
  try {
    reviewRows = tryParseReviewReport(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "파일을 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (reviewRows) {
    if (reviewRows.length === 0) {
      return NextResponse.json({ error: "리뷰 파일에서 데이터를 찾지 못했습니다." }, { status: 400 });
    }

    const { inserted, error } = await insertReviews(reviewRows);
    if (error) {
      return NextResponse.json({ error: `리뷰 저장 실패: ${error}` }, { status: 500 });
    }

    const storeNames = [...new Set(reviewRows.map((r) => r.storeName))];
    if (storeNames.length > 0) {
      await supabase
        .from("stores")
        .upsert(
          storeNames.map((name) => ({ name })),
          { onConflict: "name", ignoreDuplicates: true }
        );
    }

    return NextResponse.json({ ok: true, kind: "reviews", rows: reviewRows.length, inserted });
  }

  let parsed;
  try {
    parsed = parseSalesReport(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "파일을 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const periodStart = parsed.periodStart ?? formPeriodStart;
  const periodEnd = parsed.periodEnd ?? formPeriodEnd;
  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "기간을 입력해주세요 (파일에 날짜 정보가 없어 직접 입력이 필요합니다)." },
      { status: 400 }
    );
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("menu_sales_snapshots")
    .upsert(
      {
        period_start: periodStart,
        period_end: periodEnd,
        total_qty: parsed.totalQty,
        total_revenue: parsed.totalRevenue,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "period_start,period_end" }
    )
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    return NextResponse.json(
      { error: `저장 실패: ${snapshotError?.message ?? "알 수 없는 오류"}` },
      { status: 500 }
    );
  }

  // 브랜드 리포트(요기요/배민)는 행마다 실제 채널·날짜가 있는데, 예전에 다른 기간으로
  // 업로드했던 스냅샷이 같은 날짜를 이미 담고 있을 수 있다(예: 8/17~8/23 범위로 한 번
  // 올린 뒤 8/20 하루치만 다시 올리는 경우). snapshot_id로만 지우면 그 예전 스냅샷의
  // 행은 안 지워져서 (sale_date, store_name, product_name, channel) unique 제약에
  // 걸려 저장 자체가 실패한다 — 이번 업로드가 담고 있는 (채널, 날짜) 조합은 스냅샷
  // 경계와 무관하게 통째로 지우고 다시 채운다.
  const uploadChannels = [...new Set(parsed.rows.map((r) => r.channel).filter((c): c is string => !!c))];
  const uploadDates = [...new Set(parsed.rows.map((r) => r.saleDate).filter((d): d is string => !!d))];
  if (uploadChannels.length > 0 && uploadDates.length > 0) {
    for (const channel of uploadChannels) {
      await supabase.from("menu_sales_items").delete().eq("channel", channel).in("sale_date", uploadDates);
    }
  }
  // 자체 4컬럼 템플릿(channel/saleDate 없음)은 스냅샷 단위로만 대체된다.
  await supabase.from("menu_sales_items").delete().eq("snapshot_id", snapshot.id);

  const { error: itemsError } = await supabase.from("menu_sales_items").insert(
    parsed.rows.map((row) => ({
      snapshot_id: snapshot.id,
      category: row.category,
      product_name: row.productName,
      qty: row.qty,
      revenue: row.revenue,
      store_name: row.storeName,
      sale_date: row.saleDate ?? periodStart,
      channel: row.channel,
    }))
  );

  if (itemsError) {
    return NextResponse.json(
      { error: `항목 저장 실패: ${itemsError.message}` },
      { status: 500 }
    );
  }

  if (parsed.dailyStats.length > 0) {
    const { error: statsError } = await supabase.from("store_daily_stats").upsert(
      parsed.dailyStats.map((d) => ({
        sale_date: d.saleDate,
        store_name: d.storeName,
        channel: d.channel,
        order_count: d.orderCount,
        total_qty: d.totalQty,
        total_revenue: d.totalRevenue,
      })),
      { onConflict: "sale_date,store_name,channel" }
    );
    if (statsError) {
      return NextResponse.json(
        { error: `일별 통계 저장 실패: ${statsError.message}` },
        { status: 500 }
      );
    }
  }

  if (parsed.combos.length > 0) {
    const { error: comboError } = await supabase.from("menu_option_combos").upsert(
      parsed.combos.map((c) => ({
        sale_date: c.saleDate,
        store_name: c.storeName,
        channel: c.channel,
        base_product: c.baseProduct,
        combo_label: c.comboLabel,
        qty: c.qty,
      })),
      { onConflict: "sale_date,store_name,channel,base_product,combo_label" }
    );
    if (comboError) {
      return NextResponse.json(
        { error: `조합 통계 저장 실패: ${comboError.message}` },
        { status: 500 }
      );
    }
  }

  const storeNames = [...new Set(parsed.rows.map((r) => r.storeName).filter((s): s is string => !!s))];
  if (storeNames.length > 0) {
    await supabase
      .from("stores")
      .upsert(
        storeNames.map((name) => ({ name })),
        { onConflict: "name", ignoreDuplicates: true }
      );
  }

  return NextResponse.json({
    ok: true,
    rows: parsed.rows.length,
    totalQty: parsed.totalQty,
    totalRevenue: parsed.totalRevenue,
    periodStart,
    periodEnd,
  });
}
