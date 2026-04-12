-- One-time free-tier Manthana Labs trial (total successful scans, lifetime).
-- Increment only via /api/labs/record-scan (service role). Authenticated users can still
-- read their profile; do not send labs_free_trial_used from client update forms.

alter table public.profiles
  add column if not exists labs_free_trial_used integer not null default 0;

comment on column public.profiles.labs_free_trial_used is
  'Non-Pro: successful Labs analyzes toward lifetime free trial (cap enforced in API). Pro/Pro Plus use subscription quotas.';
