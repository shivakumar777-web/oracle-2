-- Premium (Pro Plus): enforce Labs quotas same shape as Pro, higher caps (450/mo, 40/day, 360/45/45 tiers).

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
  daily_max int;
  monthly_max int;
  light_max int;
  ct_max int;
  med_max int;
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

  if v.subscription_status is distinct from 'active' or plan_norm not in ('pro', 'proplus') then
    return jsonb_build_object('ok', false, 'error', 'not_pro_active', 'plan', plan_norm);
  end if;

  if plan_norm = 'proplus' then
    daily_max := 40;
    monthly_max := 450;
    light_max := 360;
    ct_max := 45;
    med_max := 45;
  else
    daily_max := 15;
    monthly_max := 150;
    light_max := 120;
    ct_max := 15;
    med_max := 15;
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

  if coalesce(v.labs_scans_today, 0) >= daily_max then
    return jsonb_build_object('ok', false, 'error', 'daily_cap', 'limit', daily_max, 'plan', plan_norm);
  end if;

  if coalesce(v.scans_this_month, 0) >= monthly_max then
    return jsonb_build_object('ok', false, 'error', 'monthly_total', 'limit', monthly_max, 'plan', plan_norm);
  end if;

  if t = 'light' and coalesce(v.labs_light_count, 0) >= light_max then
    return jsonb_build_object('ok', false, 'error', 'light_cap', 'limit', light_max, 'plan', plan_norm);
  end if;
  if t = 'ct_mri' and coalesce(v.labs_ct_mri_count, 0) >= ct_max then
    return jsonb_build_object('ok', false, 'error', 'ct_mri_cap', 'limit', ct_max, 'plan', plan_norm);
  end if;
  if t = 'medium' and coalesce(v.labs_medium_count, 0) >= med_max then
    return jsonb_build_object('ok', false, 'error', 'medium_cap', 'limit', med_max, 'plan', plan_norm);
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

  return jsonb_build_object('ok', true, 'plan', plan_norm);
end;
$$;

revoke all on function public.consume_labs_scan(uuid, text) from public;
grant execute on function public.consume_labs_scan(uuid, text) to service_role;

comment on function public.consume_labs_scan(uuid, text) is 'Labs quota: active pro (150/mo, 15/day, 120/15/15 tiers) or proplus (450/mo, 40/day, 360/45/45 tiers).';
