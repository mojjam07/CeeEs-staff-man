-- Run in Supabase SQL Editor. Backend uses the service-role key; RLS is enabled with no
-- public policies so the tables are unreachable from the browser except through the API.
create extension if not exists pgcrypto;

create table staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  phone text,
  position text,
  department text,
  pay_type text not null default 'monthly' check (pay_type in ('monthly','hourly')),
  pay_rate numeric(12,2) not null default 0,      -- monthly salary or hourly rate (NGN)
  status text not null default 'active' check (status in ('active','inactive')),
  hired_on date,
  created_at timestamptz default now()
);

create table profiles (                           -- links a Supabase login to a role + staff record
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','manager','staff')),
  staff_id uuid references staff(id) on delete set null
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,                         -- end <= start means overnight shift
  grace_minutes int not null default 10,
  created_at timestamptz default now()
);

create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  work_date date not null,
  unique (staff_id, work_date)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  status text not null default 'present' check (status in ('present','late','absent','leave')),
  late_minutes int not null default 0,
  hours_worked numeric(5,2) not null default 0,
  note text,
  unique (staff_id, work_date)
);

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  staff_id uuid not null references staff(id),
  days_scheduled int default 0, days_present int default 0, days_late int default 0, days_leave int default 0,
  hours_worked numeric(8,2) default 0, overtime_hours numeric(8,2) default 0,
  base_pay numeric(12,2) default 0, overtime_pay numeric(12,2) default 0, bonus numeric(12,2) default 0,
  absence_deduction numeric(12,2) default 0, late_deduction numeric(12,2) default 0, other_deduction numeric(12,2) default 0,
  net_pay numeric(12,2) default 0,
  unique (run_id, staff_id)
);

create index on attendance (work_date);
create index on shift_assignments (work_date);

alter table staff enable row level security;
alter table profiles enable row level security;
alter table shifts enable row level security;
alter table shift_assignments enable row level security;
alter table attendance enable row level security;
alter table payroll_runs enable row level security;
alter table payslips enable row level security;

-- FIRST ADMIN: create a user in Authentication > Users, then run:
-- insert into profiles (id, role) values ('<that-user-uuid>', 'admin');
