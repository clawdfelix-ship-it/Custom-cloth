alter table orders add column if not exists lookup_code text;
create index if not exists idx_orders_lookup_code on orders(lookup_code);

