insert into menu_sales_snapshots (period_start, period_end, total_qty, total_revenue, uploaded_at)
select ps, pe, qty, rev, now() from ing_snap
on conflict (period_start, period_end) do update set total_qty = excluded.total_qty, total_revenue = excluded.total_revenue, uploaded_at = excluded.uploaded_at;

insert into stores (name)
select distinct d.name from ing_items i join ing_dict d on d.id = i.st
on conflict (name) do nothing;

insert into menu_sales_items (snapshot_id, category, product_name, qty, revenue, store_name, sale_date, channel)
select s.id, dc.name, dp.name, i.qty, i.rev, ds.name, to_date(i.dt::text, 'YYYYMMDD'), dch.name
from ing_items i
join ing_snap sn on sn.snap = i.snap
join menu_sales_snapshots s on s.period_start = sn.ps and s.period_end = sn.pe
join ing_dict dc on dc.id = i.cat
join ing_dict dp on dp.id = i.prod
left join ing_dict ds on ds.id = i.st
left join ing_dict dch on dch.id = i.ch
on conflict (sale_date, store_name, product_name, channel) do update set category = excluded.category, qty = excluded.qty, revenue = excluded.revenue, snapshot_id = excluded.snapshot_id;

insert into store_daily_stats (sale_date, store_name, channel, order_count, total_qty, total_revenue)
select to_date(x.dt::text, 'YYYYMMDD'), ds.name, dch.name, x.orders, x.qty, x.rev
from ing_daily x
join ing_dict ds on ds.id = x.st
join ing_dict dch on dch.id = x.ch
on conflict (sale_date, store_name, channel) do update set order_count = excluded.order_count, total_qty = excluded.total_qty, total_revenue = excluded.total_revenue;

insert into menu_option_combos (sale_date, store_name, channel, base_product, combo_label, qty)
select to_date(x.dt::text, 'YYYYMMDD'), ds.name, dch.name, db.name, dl.name, x.qty
from ing_combos x
left join ing_dict ds on ds.id = x.st
left join ing_dict dch on dch.id = x.ch
join ing_dict db on db.id = x.base
join ing_dict dl on dl.id = x.label
on conflict (sale_date, store_name, channel, base_product, combo_label) do update set qty = excluded.qty;

insert into menu_option_selections (sale_date, store_name, channel, category, option_name, qty, revenue)
select to_date(x.dt::text, 'YYYYMMDD'), ds.name, dch.name, dc.name, dn.name, x.qty, x.rev
from ing_opts x
left join ing_dict ds on ds.id = x.st
left join ing_dict dch on dch.id = x.ch
join ing_dict dc on dc.id = x.cat
join ing_dict dn on dn.id = x.name
on conflict (sale_date, store_name, channel, category, option_name) do update set qty = excluded.qty, revenue = excluded.revenue;
