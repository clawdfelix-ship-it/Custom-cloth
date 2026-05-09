create table if not exists login_attempts (
  id uuid primary key default uuid_generate_v4(),
  ip text not null,
  acc text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_created_at on login_attempts(created_at desc);
create index if not exists idx_login_attempts_ip_acc on login_attempts(ip, acc, created_at desc);

