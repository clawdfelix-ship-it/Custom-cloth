alter table order_items add column if not exists custom_text text;
alter table order_items add column if not exists custom_attachments jsonb;

with st as (
  select id from size_tables where name = '成人通用 (S-4XL)' limit 1
),
ins_st as (
  insert into size_tables (name, data)
  select
    '成人通用 (S-4XL)',
    '[
      {"eu":"S"},
      {"eu":"M"},
      {"eu":"L"},
      {"eu":"XL"},
      {"eu":"2XL"},
      {"eu":"3XL"},
      {"eu":"4XL"}
    ]'::jsonb
  where not exists (select 1 from st)
  returning id
),
sid as (
  select id from ins_st
  union all
  select id from st
)
insert into styles (code, name, cate1, cate2, size_table_id, img_base64, remark)
select
  'CUSTOMER_PROVIDED',
  '客戶提供',
  '現貨款式加工',
  '其他',
  sid.id,
  null,
  'system'
from sid
where not exists (select 1 from styles where code = 'CUSTOMER_PROVIDED');

