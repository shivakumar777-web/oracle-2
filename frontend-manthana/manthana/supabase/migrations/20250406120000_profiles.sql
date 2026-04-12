-- Profiles for subscription / Razorpay (keyed to auth.users)
-- Run in Supabase SQL editor or via supabase db push

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  subscription_status text not null default 'inactive',
  subscription_plan text not null default 'free',
  scans_this_month integer not null default 0,
  scans_limit integer not null default 10,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  subscription_expires_at bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_razorpay_customer_id_idx
  on public.profiles (razorpay_customer_id)
  where razorpay_customer_id is not null;

create index if not exists profiles_razorpay_subscription_id_idx
  on public.profiles (razorpay_subscription_id)
  where razorpay_subscription_id is not null;

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

grant select, update on table public.profiles to authenticated;

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user ();
