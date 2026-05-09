create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  acc text unique not null,
  pwd_hash text not null,
  role text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists size_tables (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists styles (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  name text not null,
  cate1 text not null,
  cate2 text not null,
  size_table_id uuid not null references size_tables(id),
  img_base64 text,
  remark text,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  contact_name text,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (company_name, phone)
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_sn text unique not null,
  customer_id uuid not null references customers(id),
  cust_name text not null,
  cust_contact text,
  cust_phone text not null,
  cate1 text not null,
  cate2 text not null,
  factory_name text,
  order_type text not null,
  status text not null,
  amount text,
  remark text,
  create_time timestamptz not null default now(),
  requested_delivery_date date,
  suggested_delivery_date date,
  source_order_id uuid references orders(id)
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  style_id uuid not null references styles(id),
  qty jsonb not null
);

create table if not exists feedback (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  order_sn text not null,
  factory_name text not null,
  content text not null,
  status text not null,
  create_time timestamptz not null default now()
);

create index if not exists idx_orders_created_time on orders(create_time desc);
create index if not exists idx_orders_phone on orders(cust_phone);
create index if not exists idx_orders_factory on orders(factory_name);
create index if not exists idx_feedback_factory on feedback(factory_name);

