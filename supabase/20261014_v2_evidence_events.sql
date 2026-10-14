-- Applied 2026-10-14 to the isolated find-thief-europe Supabase database.
-- Never execute in other projects. All visitor/report identity info remains private.
create table if not exists public.evidence_events_v2 (
 id uuid primary key default gen_random_uuid(),
 external_ref text unique,
 created_at timestamptz not null default now(),
 country text not null check(length(country) between 2 and 60),
 city text not null check(length(city) between 1 and 100),
 spot_name text check(spot_name is null or length(spot_name)<=100),
 event_kind text not null check(event_kind in ('confirmed_theft','alleged_theft','loss','safety_mention')),
 source_type text not null check(source_type in ('official_case','consular_case','journalism_case','moderated_report')),
 source_title text not null check(length(source_title) between 2 and 220),
 source_url text not null check(source_url ~ '^https://'),
 source_published_on date,
 occurred_on date,
 occurred_precision text not null default 'unknown' check(occurred_precision in ('day','month','unknown')),
 lat double precision check(lat between -90 and 90),
 lon double precision check(lon between -180 and 180),
 location_precision text not null check(location_precision in ('approx_area','district','city','unknown')),
 radius_m integer check(radius_m between 250 and 3000),
 item_category text check(item_category is null or item_category in ('手机','钱包','护照证件','背包行李','银行卡现金','相机电子设备','首饰','其他物品')),
 short_summary text not null check(length(short_summary) between 5 and 200),
 evidence_note text not null check(length(evidence_note) between 5 and 350),
 confidence text not null check(confidence in ('official_record','reported_claim','unconfirmed')),
 review_status text not null default 'staging' check(review_status in ('staging','approved','rejected')),
 reviewed_at timestamptz, reviewed_by text,
 constraint events_verified_public check(review_status<>'approved' OR (reviewed_at is not null and reviewed_by is not null and source_url ~ '^https://' and (occurred_on is not null or source_published_on is not null))),
 constraint events_location_pair check((lat is null)=(lon is null)),
 constraint events_day_precision check(occurred_precision='unknown' or occurred_on is not null),
 constraint events_no_future_event check(occurred_on is null or occurred_on <= (now() at time zone 'UTC')::date)
);
create index if not exists events_v2_published_city on public.evidence_events_v2(city,occurred_on desc,source_published_on desc) where review_status='approved';
create index if not exists events_v2_pending on public.evidence_events_v2(review_status,created_at desc);
alter table public.evidence_events_v2 enable row level security;
revoke all on public.evidence_events_v2 from public,anon,authenticated;
grant select,insert,update,delete on public.evidence_events_v2 to service_role;

create table if not exists public.risk_areas_v2 (
 id text primary key,
 country text not null,city text not null,spot_name text not null,
 lat double precision not null check(lat between -90 and 90),
 lon double precision not null check(lon between -180 and 180),
 radius_m integer not null check(radius_m between 250 and 3000),
 last_incident_on date,last_source_on date,
 verified_event_count integer not null default 0 check(verified_event_count>=0),
 approved_visitor_reports integer not null default 0 check(approved_visitor_reports>=0),
 common_item_categories text[] not null default '{}',sample_summary text,
 source_urls text[] not null default '{}',
 review_status text not null default 'staging' check(review_status in ('staging','published','withdrawn')),
 updated_at timestamptz not null default now(),
 constraint risk_v2_nonempty check(review_status<>'published' OR (verified_event_count+approved_visitor_reports>0 and cardinality(source_urls)>0))
);
create index if not exists risk_v2_city_idx on public.risk_areas_v2(city,review_status,last_incident_on desc);
alter table public.risk_areas_v2 enable row level security;
revoke all on public.risk_areas_v2 from public,anon,authenticated;
grant select,insert,update,delete on public.risk_areas_v2 to service_role;

create table if not exists public.source_catalog_v2 (
 source_key text primary key,country text,city text,spot_name text,
 source_name text not null,source_url text not null check(source_url ~ '^https://'),
 source_kind text not null check(source_kind in ('official_api','official_csv','official_statistics','consular_notice','official_advice','public_news','public_forum')),
 language text not null default 'en',
 collection_method text not null check(collection_method in ('api','csv','metadata_only','manual_link')),
 permission_note text not null,
 crawl_frequency text not null check(crawl_frequency in ('monthly','weekly','manual')),
 enabled boolean not null default false,
 last_checked_at timestamptz,created_at timestamptz not null default now()
);
alter table public.source_catalog_v2 enable row level security;
revoke all on public.source_catalog_v2 from public,anon,authenticated;
grant select,insert,update,delete on public.source_catalog_v2 to service_role;
comment on table public.evidence_events_v2 is 'One individual sourced event (approved by reviewer only), never generic travel advice';
comment on table public.risk_areas_v2 is 'Location-specific independently reviewed event summaries, never destination popularity or general-warning circles';
