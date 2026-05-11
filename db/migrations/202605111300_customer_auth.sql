alter table customers add column if not exists email text;
alter table customers add column if not exists pwd_hash text;
alter table customers add column if not exists address text;
alter table customers add column if not exists is_registered boolean not null default false;
create unique index if not exists idx_customers_email_unique on customers(email) where email is not null;

create table if not exists customer_sessions (
  token text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists customer_password_resets (
  token text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
