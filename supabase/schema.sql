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
  revenue bigint not null
);

create index if not exists menu_sales_items_snapshot_id_idx
  on menu_sales_items (snapshot_id);

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
