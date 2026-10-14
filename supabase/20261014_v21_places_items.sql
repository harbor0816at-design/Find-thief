-- Existing V2.1 migration, already applied ONLY to find-thief-europe.
-- Do not reuse an unrelated Supabase project.
create table if not exists public.tourist_places_v21(
 country text not null,city text not null,spot_name text not null,
 lat double precision check(lat between -90 and 90),
 lon double precision check(lon between -180 and 180),
 precision text not null default 'unknown' check(precision in ('directory_coordinate','unknown')),
 evidence_count integer not null default 0 check(evidence_count=0),
 source_kind text not null default 'existing_destination_directory',
 created_at timestamptz not null default now(),
 primary key(country,city,spot_name),
 constraint place_coordinates_pair check((lat is null)=(lon is null))
);
create index if not exists tourist_places_v21_city on public.tourist_places_v21(city,spot_name);
alter table public.tourist_places_v21 enable row level security;
revoke all on public.tourist_places_v21 from public,anon,authenticated;
grant select,insert,update,delete on public.tourist_places_v21 to service_role;
comment on table public.tourist_places_v21 is 'Attraction name matching only; these entries do not demonstrate crime incidents.';
-- Original 224 records populated from cities.json via authenticated service-role import;
-- do not invent coordinates for destinations lacking located coordinates.
alter table public.loss_reports drop constraint if exists loss_item_category_allowed;
alter table public.loss_reports add constraint loss_item_category_allowed check(item_category in ('手机','钱包','护照证件','背包行李','银行卡现金','相机电子设备','首饰','其他物品','智能手表','耳机','笔记本电脑','行李箱','钥匙'));
alter table public.evidence_events_v2 drop constraint if exists evidence_events_v2_item_category_check;
alter table public.evidence_events_v2 add constraint evidence_events_v2_item_category_check check(item_category is null or item_category in ('手机','钱包','护照证件','背包行李','银行卡现金','相机电子设备','首饰','其他物品','智能手表','耳机','笔记本电脑','行李箱','钥匙'));
