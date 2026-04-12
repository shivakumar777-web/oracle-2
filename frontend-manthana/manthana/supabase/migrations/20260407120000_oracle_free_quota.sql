-- Daily Oracle quota for limited-tier users (free / basic / inactive).
-- Server routes increment via service role; safe reset per UTC day.

alter table public.profiles
  add column if not exists oracle_limited_day text,
  add column if not exists oracle_limited_used integer not null default 0;

comment on column public.profiles.oracle_limited_day is 'UTC date YYYY-MM-DD for oracle_limited_used counter';
comment on column public.profiles.oracle_limited_used is 'Oracle messages consumed on oracle_limited_day (limited tier)';
