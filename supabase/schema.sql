-- Find-thief only. Apply to a brand-new Supabase project, never to another project's DB.
create extension if not exists pgcrypto;
create table if not exists public.loss_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_on date not null,
  country text not null check(char_length(country) between 1 and 60),
  city text not null check(char_length(city) between 1 and 100),
  address_private text not null check(char_length(address_private) between 6 and 160),
  lat_private double precision,
  lon_private double precision,
  category text not null,
  description_private text not null check(char_length(description_private) between 12 and 800),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  public_summary text,
  display_lat double precision,
  display_lon double precision,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  constraint valid_coordinates check (
    (lat_private is null and lon_private is null) or
    (lat_private between -90 and 90 and lon_private between -180 and 180)
  ),
  constraint public_content_only_if_approved check(status='approved' or (public_summary is null and display_lat is null and display_lon is null))
);
create index if not exists loss_reports_created_idx on public.loss_reports(created_at desc);
create index if not exists loss_reports_review_idx on public.loss_reports(status,created_at desc);
-- Do not expose private reports directly. All access is via authenticated Vercel functions with server-side email allowlist.
alter table public.loss_reports enable row level security;
revoke all on table public.loss_reports from anon, authenticated;
grant all on table public.loss_reports to service_role;
create table if not exists public.moderation_audit(
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.loss_reports(id) on delete cascade,
  performed_at timestamptz not null default now(),
  action text not null,
  admin_email text not null
);
alter table public.moderation_audit enable row level security;
revoke all on table public.moderation_audit from anon, authenticated;
grant all on table public.moderation_audit to service_role;