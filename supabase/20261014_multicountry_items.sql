-- Apply to the dedicated Find-thief Supabase project ONLY.
-- This change has already been applied to smwqqiebkdaheikihbrg on 2026-10-14.
alter table public.loss_reports add column if not exists item_category text not null default '其他物品';
alter table public.loss_reports add column if not exists spot_name_private text;
alter table public.loss_reports add column if not exists spot_name_public text;
alter table public.loss_reports drop constraint if exists loss_item_category_allowed;
alter table public.loss_reports add constraint loss_item_category_allowed check(item_category in ('手机','钱包','护照证件','背包行李','银行卡现金','相机电子设备','首饰','其他物品'));
alter table public.loss_reports drop constraint if exists loss_spot_name_length;
alter table public.loss_reports add constraint loss_spot_name_length check((spot_name_private is null or char_length(spot_name_private)<=100) and (spot_name_public is null or char_length(spot_name_public)<=100));
create index if not exists loss_reports_public_spot_idx on public.loss_reports(status,city,spot_name_public) where status='approved';
create table if not exists public.travel_advisories (
  id text primary key check(length(id) between 4 and 100), country text not null,city text not null,spot_name text not null,
  latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),
  scope text not null check(scope in ('citywide','district','transit','site_context')),
  evidence_kind text not null check(evidence_kind in ('official_statistics','government_travel_advice','historical_government_notice','chinese_consular_notice','journalism_observation')),
  source_title text not null,source_url text not null check(source_url ~ '^https://'),source_date date,checked_at date not null,
  brief_zh text not null,qualification_zh text not null,statistic_value bigint check(statistic_value>=0),
  statistic_label text,statistic_year integer check(statistic_year between 2000 and 2100),
  case_items text[] not null default '{}',status text not null default 'published' check(status in ('staging','published','withdrawn')),
  updated_at timestamptz not null default now()
);
create index if not exists travel_advisories_city_idx on public.travel_advisories(city,status,scope);
alter table public.travel_advisories enable row level security;
revoke all on public.travel_advisories from PUBLIC,anon,authenticated;
grant all on public.travel_advisories to service_role;
comment on table public.travel_advisories is 'Cited context: media and general travel advice are not incident records; do not mix with location-level police crime risk scores.';
