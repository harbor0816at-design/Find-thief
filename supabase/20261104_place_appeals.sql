-- Map-first redesign P2: appeals from marked places/businesses. Applies ONLY to find-thief-europe.
-- Additive: creates one new table, touches nothing existing.
create table if not exists public.place_appeals (
  id uuid primary key default gen_random_uuid(),
  place_key text not null check (length(place_key) between 3 and 160),
  city text not null check (length(city) between 1 and 100),
  place_name text not null check (length(place_name) between 1 and 160),
  reason text not null check (reason in ('信息错误','已过时','已整改','恶意标记','其他')),
  detail_private text not null check (length(detail_private) between 10 and 1000),
  contact_email_private text not null check (contact_email_private ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email_private)<=200),
  status text not null default 'pending' check (status in ('pending','upheld','downgraded','removed')),
  decision_public text check (decision_public is null or length(decision_public)<=240),
  submission_fingerprint text not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create unique index if not exists place_appeals_fingerprint on public.place_appeals(submission_fingerprint);
create index if not exists place_appeals_place on public.place_appeals(place_key,status);
alter table public.place_appeals enable row level security;
revoke all on public.place_appeals from public, anon, authenticated;
grant select, insert, update on public.place_appeals to service_role;
comment on table public.place_appeals is 'Appeals by marked places. Contact and detail are private to admins; only place_key, status and decision_public are served publicly.';
