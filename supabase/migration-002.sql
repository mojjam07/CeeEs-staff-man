-- Run after schema.sql: payout details, payout tracking, leave requests.
alter table staff
  add column bank_name text, add column bank_code text,
  add column account_number text, add column account_name text,
  add column paystack_recipient text;

alter table payslips
  add column payout_status text check (payout_status in ('queued','failed')),
  add column payout_ref text;

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  type text not null default 'annual' check (type in ('annual','sick','casual','unpaid')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz default now()
);
alter table leave_requests enable row level security;
create index on leave_requests (staff_id, status);
