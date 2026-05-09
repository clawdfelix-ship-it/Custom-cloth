create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

