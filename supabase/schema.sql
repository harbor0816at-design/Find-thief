-- Find-thief 1.2: use ONLY on this application's NEW dedicated Supabase project.
-- Service key belongs ONLY in Vercel environment, never in public JS or Git.
create extension if not exists pgcrypto;

create table if not exists public.loss_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_on date not null,
  country text not null check (char_length(country) between 1 and 60),
  city text not null check (char_length(city) between 1 and 100),
  address_private text not null check (char_length(address_private) between 6 and 160),
  lat_private double precision,
  lon_private double precision,
  category text not null check (category in ('物品遗失','疑似扒窃','已报警确认失窃','其他物品安全事件')),
  description_private text not null check (char_length(description_private) between 12 and 800),
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  public_summary text,
  display_lat double precision,
  display_lon double precision,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  -- HMAC of IP and rotated application secret: never store plaintext IP.
  submission_fingerprint text not null check (char_length(submission_fingerprint)=64),
  submission_bucket bigint not null,
  constraint private_coordinate_pair check ((lat_private is null and lon_private is null) or (lat_private between -90 and 90 and lon_private between -180 and 180)),
  constraint public_coordinate_pair check ((display_lat is null and display_lon is null) or (display_lat between -90 and 90 and display_lon between -180 and 180)),
  constraint approved_requires_review check ((status='approved' and char_length(public_summary) between 12 and 240 and display_lat is not null and display_lon is not null and reviewed_at is not null and reviewed_by is not null) or (status<>'approved' and public_summary is null and display_lat is null and display_lon is null)),
  -- At most one accepted report per 10-min bucket per network identifier.
  constraint unique_submission_time_bucket unique (submission_fingerprint, submission_bucket)
);
create index if not exists loss_reports_created_idx on public.loss_reports(created_at desc);
create index if not exists loss_reports_review_idx on public.loss_reports(status,created_at desc);
create index if not exists loss_reports_occurred_idx on public.loss_reports(occurred_on desc) where status='approved';

create table if not exists public.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.loss_reports(id) on delete cascade,
  performed_at timestamptz not null default now(),
  old_status text not null,
  new_status text not null,
  admin_email text not null
);

-- Generated automatically in the SAME transaction as review action.
create or replace function public.loss_report_audit_status_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    insert into public.moderation_audit(report_id,old_status,new_status,admin_email)
    values(new.id,old.status,new.status,coalesce(new.reviewed_by,'unknown'));
  end if;
  return new;
end $$;
drop trigger if exists loss_reports_status_audit on public.loss_reports;
create trigger loss_reports_status_audit after update of status on public.loss_reports
for each row when (old.status is distinct from new.status)
execute function public.loss_report_audit_status_change();

-- All access routed through authenticated Vercel functions. No direct client queries.
alter table public.loss_reports enable row level security;
alter table public.moderation_audit enable row level security;
revoke all on table public.loss_reports, public.moderation_audit from public, anon, authenticated;
grant all on table public.loss_reports, public.moderation_audit to service_role;
revoke execute on function public.loss_report_audit_status_change() from public, anon, authenticated;
grant execute on function public.loss_report_audit_status_change() to service_role;

comment on table public.loss_reports is 'Private user-submitted European travel loss reports, manual approval required.';
comment on column public.loss_reports.submission_fingerprint is 'HMAC-SHA256 client network marker, not raw IP; used only for abuse controls.';
