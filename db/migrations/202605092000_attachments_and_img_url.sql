alter table styles add column if not exists img_url text;

alter table feedback add column if not exists attachments jsonb not null default '[]'::jsonb;

