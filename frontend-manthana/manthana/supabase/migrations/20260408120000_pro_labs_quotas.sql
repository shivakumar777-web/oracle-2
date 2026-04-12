-- Pro plan Labs quotas: tier caps + daily cap (server-enforced via RPC + service role)

alter table public.profiles
  add column if not exists labs_usage_month text,
  add column if not exists labs_light_count integer not null default 0,
  add column if not exists labs_ct_mri_count integer not null default 0,
  add column if not exists labs_medium_count integer not null default 0,
  add column if not exists labs_usage_day text,
  add column if not exists labs_scans_today integer not null default 0;

comment on column public.profiles.labs_usage_month is 'UTC YYYY-MM; resets tier + monthly scan counters when month changes';
comment on column public.profiles.labs_light_count is 'Pro: light-tier scans this month (ECG, X-ray, derm, lab, oral, etc.)';
comment on column public.profiles.labs_ct_mri_count is 'Pro: CT + MRI scans this month';
comment on column public.profiles.labs_medium_count is 'Pro: USG + mammography + pathology + cytology this month (shared 15/mo cap)';
comment on column public.profiles.labs_usage_day is 'UTC YYYY-MM-DD for labs_scans_today';
comment on column public.profiles.labs_scans_today is 'Pro: successful Labs analyzes today (UTC)';

-- Atomic consume for active Pro only. Pro Plus skips increments (handled in app). Free inactive returns error.
create or replace function public.consume_labs_scan(p_user_id uuid, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  cur_month text := to_char((timezone('utc', now()))::date, 'YYYY-MM');
  cur_day text := to_char((timezone('utc', now()))::date, 'YYYY-MM-DD');
  t text := lower(trim(p_tier));
  plan_norm text;
begin
  if t not in ('light', 'ct_mri', 'medium') then
    return jsonb_build_object('ok', false, 'error', 'invalid_tier');
  end if;

  select * into v from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  plan_norm := lower(coalesce(v.subscription_plan, 'free'));
  if plan_norm = 'enterprise' then
    plan_norm := 'proplus';
  end if;

  if v.subscription_status = 'active' and plan_norm = 'proplus' then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'proplus_unlimited');
  end if;

  if v.subscription_status is distinct from 'active' or plan_norm is distinct from 'pro' then
    return jsonb_build_object('ok', false, 'error', 'not_pro_active');
  end if;

  if v.labs_usage_month is distinct from cur_month then
    update public.profiles set
      labs_usage_month = cur_month,
      labs_light_count = 0,
      labs_ct_mri_count = 0,
      labs_medium_count = 0,
      scans_this_month = 0,
      labs_usage_day = null,
      labs_scans_today = 0,
      updated_at = now()
    where id = p_user_id;
    select * into v from public.profiles where id = p_user_id;
  end if;

  if v.labs_usage_day is distinct from cur_day then
    update public.profiles set
      labs_usage_day = cur_day,
      labs_scans_today = 0,
      updated_at = now()
    where id = p_user_id;
    select * into v from public.profiles where id = p_user_id;
  end if;

  if coalesce(v.labs_scans_today, 0) >= 15 then
    return jsonb_build_object('ok', false, 'error', 'daily_cap', 'limit', 15);
  end if;

  if coalesce(v.scans_this_month, 0) >= 150 then
    return jsonb_build_object('ok', false, 'error', 'monthly_total', 'limit', 150);
  end if;

  if t = 'light' and coalesce(v.labs_light_count, 0) >= 120 then
    return jsonb_build_object('ok', false, 'error', 'light_cap', 'limit', 120);
  end if;
  if t = 'ct_mri' and coalesce(v.labs_ct_mri_count, 0) >= 15 then
    return jsonb_build_object('ok', false, 'error', 'ct_mri_cap', 'limit', 15);
  end if;
  if t = 'medium' and coalesce(v.labs_medium_count, 0) >= 15 then
    return jsonb_build_object('ok', false, 'error', 'medium_cap', 'limit', 15);
  end if;

  update public.profiles set
    scans_this_month = coalesce(scans_this_month, 0) + 1,
    labs_scans_today = coalesce(labs_scans_today, 0) + 1,
    labs_light_count = case when t = 'light' then coalesce(labs_light_count, 0) + 1 else labs_light_count end,
    labs_ct_mri_count = case when t = 'ct_mri' then coalesce(labs_ct_mri_count, 0) + 1 else labs_ct_mri_count end,
    labs_medium_count = case when t = 'medium' then coalesce(labs_medium_count, 0) + 1 else labs_medium_count end,
    labs_usage_month = cur_month,
    labs_usage_day = cur_day,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.consume_labs_scan(uuid, text) from public;
grant execute on function public.consume_labs_scan(uuid, text) to service_role;
