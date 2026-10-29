-- Run after migration-002.sql: PAYE/pension fields and leave entitlements.
alter table staff
  add column annual_rent numeric(12,2) default 0,     -- declared annual rent, for rent relief
  add column pensionable_pay numeric(12,2),           -- monthly basic+housing+transport; null = use base pay
  add column pension_enabled boolean not null default true;

alter table payslips
  add column pension_employee numeric(12,2) default 0,
  add column pension_employer numeric(12,2) default 0,
  add column paye_tax numeric(12,2) default 0;

create table leave_entitlements (
  type text primary key check (type in ('annual','sick','casual','unpaid')),
  days_per_year int                                   -- working days; null = unlimited
);
insert into leave_entitlements values ('annual', 20), ('sick', 12), ('casual', 5), ('unpaid', null); -- placeholders: edit in the app
alter table leave_entitlements enable row level security;
