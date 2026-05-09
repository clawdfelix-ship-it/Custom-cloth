alter table orders add column if not exists factory_user_id uuid references users(id);
create index if not exists idx_orders_factory_user_id on orders(factory_user_id);

