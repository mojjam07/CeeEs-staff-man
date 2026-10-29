-- Run after migration-003.sql: audit log and leave carry-over.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,          -- e.g. "PATCH /api/staff/<id>"
  entity text,                   -- staff | shifts | attendance | payroll | leave
  entity_id text,
  status int,
  details jsonb                  -- request body with secrets redacted
);
create index on audit_log (at desc);
alter table audit_log enable row level security;

alter table leave_entitlements add column carry_over_days int not null default 0; -- max unused days carried into next year
