import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { parseSalesReport } from "@/lib/parseSalesReport";
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

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
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
        order_count: d.orderCount,
        total_qty: d.totalQty,
        total_revenue: d.totalRevenue,
      })),
      { onConflict: "sale_date,store_name" }
    );
    if (statsError) {
      return NextResponse.json(
        { error: `일별 통계 저장 실패: ${statsError.message}` },
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
