-- =====================================================================
-- Flight Academy — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: it uses IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================
--
-- ACCESS MODEL
--   Today:   only approved staff (role = 'admin' or 'coach') can read/write.
--            New sign-ups land as 'pending' and see nothing until an admin
--            approves them on the Coaches page. The FIRST account ever created
--            becomes 'admin' automatically.
--   Future:  athletes / guardians get role 'athlete' or 'guardian' and are
--            linked to athletes through `athlete_access`. Every policy below
--            already routes through can_view_athlete(), so turning on
--            athlete/parent logins requires NO policy rewrites — just add rows
--            to athlete_access.
-- =====================================================================

-- ---------- Roles & profiles -----------------------------------------
do $$ begin
  create type public.app_role as enum ('pending', 'coach', 'admin', 'athlete', 'guardian');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        public.app_role not null default 'pending',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile on sign-up. First user ever → admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when exists (select 1 from public.profiles where role = 'admin')
         then 'pending'::public.app_role else 'admin'::public.app_role end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Athletes --------------------------------------------------
create table if not exists public.athletes (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text not null,
  birth_date      date,
  grade           text,
  school          text,
  sport           text,
  position        text,
  team_group      text,           -- team / age group, e.g. "12U", "Varsity"
  guardian_name   text,
  guardian_email  text,
  guardian_phone  text,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Future: which logins may see which athletes (self or guardian).
create table if not exists public.athlete_access (
  user_id       uuid not null references auth.users(id) on delete cascade,
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  relationship  text not null check (relationship in ('self', 'guardian')),
  created_at    timestamptz not null default now(),
  primary key (user_id, athlete_id)
);

-- ---------- Access helpers (used by every policy) ---------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('coach', 'admin'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_view_athlete(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or exists (select 1 from public.athlete_access
                 where user_id = auth.uid() and athlete_id = aid);
$$;

-- ---------- Development categories (PDF p.6–7) ------------------------
create table if not exists public.categories (
  id        smallint primary key,
  name      text not null,
  examples  text not null
);

insert into public.categories (id, name, examples) values
  (1, 'Strength',                'weight lifting, bodyweight, resistance bands'),
  (2, 'Speed',                   'sprints, squats, jumps'),
  (3, 'Agility',                 'cones, shuffles, reaction, directional'),
  (4, 'Coordination and Balance','balance, eye-hand coordination'),
  (5, 'Endurance',               'distance run, circuit training'),
  (6, 'Flexibility',             'stretches, range of motion'),
  (7, 'Sport-Specific Skills',   'passing, blocking, position-specific')
on conflict (id) do update set name = excluded.name, examples = excluded.examples;

-- ---------- Exercises ("New Exercise" form, PDF p.7) ------------------
create table if not exists public.exercises (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  created_on      date not null default current_date,
  setup           text,
  setup_image     text,             -- storage path in bucket 'setups'
  steps           text[] not null default '{}' check (cardinality(steps) <= 6),
  category_id     smallint references public.categories(id),
  distance_value  numeric,
  distance_unit   text,
  time_value      numeric,
  time_unit       text,
  reps_value      numeric,
  reps_unit       text,
  created_by      uuid references auth.users(id) default auth.uid(),
  created_at      timestamptz not null default now()
);

-- ---------- Drills ("New Drill" form, PDF p.8) ------------------------
create table if not exists public.drills (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  created_on   date not null default current_date,
  setup        text,
  setup_image  text,
  steps        text[] not null default '{}' check (cardinality(steps) <= 6),
  created_by   uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);

-- Exercises included in a drill, in order of operation (max 6)
create table if not exists public.drill_exercises (
  drill_id     uuid not null references public.drills(id) on delete cascade,
  position     smallint not null check (position between 1 and 6),
  exercise_id  uuid references public.exercises(id) on delete set null,
  label        text,                 -- free text if not in the library
  primary key (drill_id, position)
);

-- Up to three categories, ranked by intention
create table if not exists public.drill_categories (
  drill_id     uuid not null references public.drills(id) on delete cascade,
  rank         smallint not null check (rank between 1 and 3),
  category_id  smallint not null references public.categories(id),
  primary key (drill_id, rank)
);

-- ---------- Sessions (score sheet, PDF p.9) ---------------------------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null default current_date,
  coach_name    text,
  location      text,
  notes         text,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);

-- Attendance (the athlete rows of the sheet)
create table if not exists public.session_athletes (
  session_id  uuid not null references public.sessions(id) on delete cascade,
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  primary key (session_id, athlete_id)
);

-- The sheet's columns: 6 Conditioning + 3 Measure
create table if not exists public.session_items (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions(id) on delete cascade,
  section          text not null check (section in ('conditioning', 'measure')),
  slot             smallint not null check (slot between 1 and 6),
  item_type        text not null check (item_type in ('drill', 'exercise')),
  drill_id         uuid references public.drills(id) on delete set null,
  exercise_id      uuid references public.exercises(id) on delete set null,
  label            text not null,    -- snapshot of the title at the time
  unit             text not null check (unit in ('reps', 'seconds', 'meters', 'yards', 'inches', 'lbs')),
  better           text not null default 'higher' check (better in ('higher', 'lower')),
  unique (session_id, section, slot),
  check (section = 'conditioning' or slot <= 3),
  check ((item_type = 'drill' and exercise_id is null) or (item_type = 'exercise' and drill_id is null))
);

-- One number per athlete per column
create table if not exists public.results (
  id               uuid primary key default gen_random_uuid(),
  session_item_id  uuid not null references public.session_items(id) on delete cascade,
  athlete_id       uuid not null references public.athletes(id) on delete cascade,
  value            numeric not null,
  created_at       timestamptz not null default now(),
  unique (session_item_id, athlete_id)
);

create index if not exists results_athlete_idx on public.results (athlete_id);
create index if not exists session_items_session_idx on public.session_items (session_id);
create index if not exists session_athletes_athlete_idx on public.session_athletes (athlete_id);

-- ---------- Reporting view: every result with its context -------------
-- security_invoker = true → the view obeys the caller's row-level security.
create or replace view public.athlete_results
with (security_invoker = true) as
select
  r.id,
  r.athlete_id,
  r.value,
  si.id          as session_item_id,
  si.section,
  si.item_type,
  si.drill_id,
  si.exercise_id,
  si.label,
  si.unit,
  si.better,
  s.id           as session_id,
  s.session_date,
  coalesce(e.category_id, dc.category_id) as category_id,
  -- one stable key per measurable thing, so the same drill+unit trends together
  coalesce(si.exercise_id::text, si.drill_id::text, lower(si.label)) || ':' || si.unit as measure_key
from public.results r
join public.session_items si on si.id = r.session_item_id
join public.sessions s       on s.id = si.session_id
left join public.exercises e on e.id = si.exercise_id
left join public.drill_categories dc on dc.drill_id = si.drill_id and dc.rank = 1;

-- ---------- Row-level security ----------------------------------------
alter table public.profiles          enable row level security;
alter table public.athletes          enable row level security;
alter table public.athlete_access    enable row level security;
alter table public.categories        enable row level security;
alter table public.exercises         enable row level security;
alter table public.drills            enable row level security;
alter table public.drill_exercises   enable row level security;
alter table public.drill_categories  enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_athletes  enable row level security;
alter table public.session_items     enable row level security;
alter table public.results           enable row level security;

-- Drop-and-recreate keeps this file re-runnable.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: see yourself; staff see everyone; only admins change them.
create policy "profiles: read own or staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "profiles: admin manages" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- athletes: viewable per can_view_athlete(); staff write.
create policy "athletes: read" on public.athletes
  for select using (public.can_view_athlete(id));
create policy "athletes: staff write" on public.athletes
  for all using (public.is_staff()) with check (public.is_staff());

-- athlete_access: users see their own links; admins manage.
create policy "access: read own" on public.athlete_access
  for select using (user_id = auth.uid() or public.is_staff());
create policy "access: admin write" on public.athlete_access
  for all using (public.is_admin()) with check (public.is_admin());

-- Curriculum (categories, exercises, drills) is readable by any signed-in,
-- approved user (incl. future athletes); only staff write.
create policy "categories: read" on public.categories
  for select using (auth.uid() is not null);

create policy "exercises: read" on public.exercises
  for select using (public.is_staff() or exists (select 1 from public.athlete_access where user_id = auth.uid()));
create policy "exercises: staff write" on public.exercises
  for all using (public.is_staff()) with check (public.is_staff());

create policy "drills: read" on public.drills
  for select using (public.is_staff() or exists (select 1 from public.athlete_access where user_id = auth.uid()));
create policy "drills: staff write" on public.drills
  for all using (public.is_staff()) with check (public.is_staff());

create policy "drill_exercises: read" on public.drill_exercises
  for select using (public.is_staff() or exists (select 1 from public.athlete_access where user_id = auth.uid()));
create policy "drill_exercises: staff write" on public.drill_exercises
  for all using (public.is_staff()) with check (public.is_staff());

create policy "drill_categories: read" on public.drill_categories
  for select using (public.is_staff() or exists (select 1 from public.athlete_access where user_id = auth.uid()));
create policy "drill_categories: staff write" on public.drill_categories
  for all using (public.is_staff()) with check (public.is_staff());

-- Sessions: staff see all; future athletes see only sessions they attended.
create policy "sessions: read" on public.sessions
  for select using (
    public.is_staff() or exists (
      select 1 from public.session_athletes sa
      where sa.session_id = sessions.id and public.can_view_athlete(sa.athlete_id)));
create policy "sessions: staff write" on public.sessions
  for all using (public.is_staff()) with check (public.is_staff());

create policy "session_athletes: read" on public.session_athletes
  for select using (public.can_view_athlete(athlete_id));
create policy "session_athletes: staff write" on public.session_athletes
  for all using (public.is_staff()) with check (public.is_staff());

create policy "session_items: read" on public.session_items
  for select using (
    public.is_staff() or exists (
      select 1 from public.session_athletes sa
      where sa.session_id = session_items.session_id and public.can_view_athlete(sa.athlete_id)));
create policy "session_items: staff write" on public.session_items
  for all using (public.is_staff()) with check (public.is_staff());

-- Results: the core privacy boundary — only that athlete's viewers.
create policy "results: read" on public.results
  for select using (public.can_view_athlete(athlete_id));
create policy "results: staff write" on public.results
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- Storage bucket for setup diagrams / photos ----------------
insert into storage.buckets (id, name, public)
values ('setups', 'setups', false)
on conflict (id) do nothing;

drop policy if exists "setups: staff read"  on storage.objects;
drop policy if exists "setups: staff write" on storage.objects;
drop policy if exists "setups: staff update" on storage.objects;
drop policy if exists "setups: staff delete" on storage.objects;
create policy "setups: staff read" on storage.objects
  for select using (bucket_id = 'setups' and public.is_staff());
create policy "setups: staff write" on storage.objects
  for insert with check (bucket_id = 'setups' and public.is_staff());
create policy "setups: staff update" on storage.objects
  for update using (bucket_id = 'setups' and public.is_staff());
create policy "setups: staff delete" on storage.objects
  for delete using (bucket_id = 'setups' and public.is_staff());

-- ---------- Starter library from the Session Agenda (PDF p.5) ---------
-- Categories are a best guess from p.6 — review/edit in the app.
insert into public.exercises (title, category_id, created_by)
select t.title, t.cat, null
from (values
  ('Dot Drill 1-5', 3), ('Box Drill (double)', 3), ('Nebraska', 3),
  ('Pro Shuttle', 3), ('Hawk Star', 3), ('X-Drill', 3), ('W Drill', 3),
  ('3 Cone', 3), ('Cloverleaf', 3), ('Triangle Cut/Spin', 3),
  ('Hawk Box', 3), ('Plyo Box', 2), ('Gauntlet', 2),
  ('Agility Ladder', 2), ('Jump Rope', 4)
) as t(title, cat)
where not exists (select 1 from public.exercises e where e.title = t.title);

-- ---------- API grants -------------------------------------------------
-- Newer Supabase projects don't auto-expose tables to the Data API.
-- Grant access ONLY to signed-in users; RLS above still decides which rows
-- they see. The anonymous (logged-out) role gets nothing.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.athletes, public.athlete_access, public.exercises,
  public.drills, public.drill_exercises, public.drill_categories, public.sessions,
  public.session_athletes, public.session_items, public.results
  to authenticated;
grant select on public.categories, public.athlete_results to authenticated;
grant execute on function public.is_staff(), public.is_admin(), public.can_view_athlete(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
