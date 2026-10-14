-- Run only in dedicated find-thief-europe (smwqqiebkdaheikihbrg).
-- Aggregate telemetry only: no IP, session ID, account or fingerprint is saved here.
create table if not exists public.site_metrics_daily (
 day date not null default current_date,
 metric text not null check(metric in ('page_view','search','area_open','report_open','report_attempt','report_saved','report_received','source_open')),
 city text not null default '' check(char_length(city)<=80),
 total bigint not null default 0 check(total>=0),
 updated_at timestamptz not null default now(),
 primary key(day,metric,city)
);
create index if not exists site_metrics_daily_metric_day on public.site_metrics_daily (metric,day desc);
alter table public.site_metrics_daily enable row level security;
revoke all on table public.site_metrics_daily from PUBLIC,anon,authenticated;
grant select,insert,update on public.site_metrics_daily to service_role;

-- Source evidence is a staging register, not an automatic factual crime claim.
create table if not exists public.source_leads (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 original_url text not null check(length(original_url) between 10 and 1600),
 source_platform text not null check(length(source_platform) between 2 and 80),
 source_country text,
 source_city text,
 source_language text not null default 'zh',
 claimed_event_date date,
 title text not null check(length(title)<=250),
 synopsis text,
 kind text not null default 'lead' check(kind in ('lead','official_aggregate','official_street_csv','visitor_report')),
 license_note text,
 status text not null default 'needs_review' check(status in ('needs_review','approved_for_statistics','rejected')),
 reviewed_at timestamptz,
 reviewed_by text,
 unique(original_url)
);
create index if not exists source_leads_date_status on public.source_leads(status,created_at desc);
alter table public.source_leads enable row level security;
revoke all on table public.source_leads from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.source_leads to service_role;

-- Evidence-backed areas only. Empty on creation; nothing published until independently reviewed.
create table if not exists public.evidence_areas (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 country text not null,
 city text not null,
 label text not null check(length(label) between 2 and 160),
 lat double precision not null check(lat between -90 and 90),
 lon double precision not null check(lon between -180 and 180),
 radius_m integer not null check(radius_m between 250 and 2500),
 source_type text not null check(source_type in ('official_street_data','official_area_stats','moderated_visitor_reports')),
 source_url text not null,
 license_note text not null,
 period_start date not null,
 period_end date not null,
 evidence_count integer not null check(evidence_count >=3),
 method_note text not null,
 evidence_verified_at timestamptz,
 status text not null default 'staging' check(status in ('staging','published','withdrawn')),
 approved_by text,
 approved_at timestamptz,
 constraint evidence_publication_requirements check(status<>'published' OR (evidence_verified_at is not null AND approved_by is not null AND approved_at is not null AND source_url ~ '^https://')),
 constraint evidence_date_order check(period_start<=period_end)
);
create index if not exists evidence_areas_city_status on public.evidence_areas(status,city,period_end desc);
alter table public.evidence_areas enable row level security;
revoke all on table public.evidence_areas from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.evidence_areas to service_role;

-- Service-side aggregate counter, SECURITY INVOKER: no client execute grant, no bypass RLS.
create or replace function public.count_site_metric(event_name text,event_city text default '')
returns void language plpgsql security invoker set search_path = '' as $$
begin
 if event_name not in ('page_view','search','area_open','report_open','report_attempt','report_saved','report_received','source_open') then
  raise exception 'unsupported metric';
 end if;
 if length(event_city)>80 then raise exception 'invalid dimension'; end if;
 insert into public.site_metrics_daily(day,metric,city,total)
 values ((now() at time zone 'UTC')::date,event_name,coalesce(event_city,''),1)
 on conflict (day,metric,city)
 do update set total=public.site_metrics_daily.total+1,updated_at=now();
end $$;
revoke execute on function public.count_site_metric(text,text) from PUBLIC,anon,authenticated;
grant execute on function public.count_site_metric(text,text) to service_role;
comment on table public.site_metrics_daily is 'Approximate anonymous aggregate event counts; not unique users or actual human clicks';
