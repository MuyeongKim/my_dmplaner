create table if not exists public.work_patterns (
  id text primary key,
  "startDate" text not null,
  "cycleItems" jsonb not null,
  "isActive" boolean not null default true
);

create table if not exists public.pattern_exceptions (
  id text primary key,
  date text not null,
  label text not null,
  color text not null,
  enabled boolean not null default true
);

create table if not exists public.schedules (
  id text primary key,
  date text not null,
  title text not null,
  memo text null,
  color text not null,
  source text not null,
  "createdAt" text not null,
  "updatedAt" text not null,
  "reminderAt" text null,
  "notifiedAt" text null,
  "deletedAt" text null
);

create index if not exists schedules_date_idx on public.schedules (date);

create table if not exists public.trash (
  id text primary key,
  "entityType" text not null,
  "entityId" text not null,
  payload jsonb not null,
  "deletedAt" text not null,
  "purgeAt" text not null
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

alter table public.work_patterns enable row level security;
alter table public.pattern_exceptions enable row level security;
alter table public.schedules enable row level security;
alter table public.trash enable row level security;
alter table public.settings enable row level security;

drop policy if exists "mvp_all_work_patterns" on public.work_patterns;
create policy "mvp_all_work_patterns"
on public.work_patterns
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_all_pattern_exceptions" on public.pattern_exceptions;
create policy "mvp_all_pattern_exceptions"
on public.pattern_exceptions
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_all_schedules" on public.schedules;
create policy "mvp_all_schedules"
on public.schedules
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_all_trash" on public.trash;
create policy "mvp_all_trash"
on public.trash
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "mvp_all_settings" on public.settings;
create policy "mvp_all_settings"
on public.settings
for all
to anon, authenticated
using (true)
with check (true);
