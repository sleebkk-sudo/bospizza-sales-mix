-- 보스피자 Sales Mix 대시보드 스키마
-- Supabase SQL Editor에 이 파일 전체를 붙여넣어 실행하세요.
-- 이후 컬럼이 추가되면 이 파일 하단에 idempotent한 alter 문을 추가하고,
-- 그 alter 문만 다시 SQL Editor에서 실행하면 됩니다.

-- ============================================================
-- 1. 메뉴별 매출 — 업로드 시 지정한 기간(period_start~period_end)
--    단위 스냅샷으로 저장. 같은 기간으로 재업로드하면 그 스냅샷을 덮어씀.
-- ============================================================
create table if not exists menu_sales_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  uploaded_at timestamptz not null default now(),
  total_qty integer not null,
  total_revenue bigint not null,
  unique (period_start, period_end)
);

create table if not exists menu_sales_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references menu_sales_snapshots(id) on delete cascade,
  category text not null,
  product_name text not null,
  qty integer not null,
  revenue bigint not null,
  store_name text,
  -- 배달앱 브랜드 리포트는 파일 자체의 날짜를 담고 있어 이 값이 채워짐.
  -- 자체 4컬럼 템플릿은 업로드 시 입력한 기간(period_start)을 그대로 씀.
  sale_date date,
  -- "요기요" / "배민" — 자체 템플릿 업로드는 null.
  channel text
);

create index if not exists menu_sales_items_snapshot_id_idx
  on menu_sales_items (snapshot_id);
create index if not exists menu_sales_items_store_name_idx
  on menu_sales_items (store_name);
create index if not exists menu_sales_items_sale_date_idx
  on menu_sales_items (sale_date);
create index if not exists menu_sales_items_channel_idx
  on menu_sales_items (channel);

-- ============================================================
-- 2. 메뉴별 원가 — 매출 대비 마진 계산용. name은 업로드 파일의
--    메뉴명과 정확히 일치해야 매칭됩니다.
-- ============================================================
create table if not exists menu_costs (
  name text primary key,
  cost numeric not null,
  note text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. 매장 목록 — 대시보드 매장 필터 드롭다운용 (업로드 시 자동 채워짐).
-- ============================================================
create table if not exists stores (
  name text primary key,
  first_seen date not null default current_date
);

-- ============================================================
-- 4. 매장×날짜별 주문 통계 — 건단가(매출/주문수) 계산용.
--    배달앱 브랜드 리포트의 주문ID를 세어서 만듦. 자체 템플릿 업로드에는
--    주문 단위 정보가 없어 이 테이블에 데이터가 채워지지 않음.
-- ============================================================
create table if not exists store_daily_stats (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  store_name text not null,
  channel text not null,
  order_count integer not null,
  total_qty integer not null,
  total_revenue bigint not null,
  unique (sale_date, store_name, channel)
);
create index if not exists store_daily_stats_sale_date_idx
  on store_daily_stats (sale_date);

-- ============================================================
-- 5. 반반피자류 맛 조합 — 메뉴명에 "반반"이 포함된 상품의 옵션에서 실제로
--    고른 두 가지 맛 조합. base_product는 어떤 상품(반반피자, 반반피자
--    +사이드+음료 등)이었는지, combo_label은 정렬된 "맛A + 맛B" 문자열.
-- ============================================================
create table if not exists menu_option_combos (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  store_name text,
  channel text,
  base_product text not null,
  combo_label text not null,
  qty integer not null,
  unique (sale_date, store_name, channel, base_product, combo_label)
);
create index if not exists menu_option_combos_base_product_idx
  on menu_option_combos (base_product);
create index if not exists menu_option_combos_sale_date_idx
  on menu_option_combos (sale_date);
