-- =====================================================================
-- 004 — "Viewer" role: read-only access to everything coaches can see
-- Viewers can READ athletes, sessions, results, exercises, drills and
-- setup photos. Every write still requires coach/admin (is_staff()).
-- Safe to re-run.
--
-- ⚠ Viewers see whatever is in the database. Before entering real athlete
--   data, set demo/viewer accounts back to Pending (Coaches page) or delete them.
-- =====================================================================
alter type public.app_role add value if not exists 'viewer';

-- role::text so this works in the same run that adds the enum value
create or replace function public.is_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role::text = 'viewer');
$$;

-- Athlete-level reads (athletes, results, attendance) now include viewers.
create or replace function public.can_view_athlete(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.is_viewer()
      or exists (select 1 from public.athlete_access where user_id = auth.uid() and athlete_id = aid);
$$;

-- Program-level reads (curriculum + sessions).
create or replace function public.can_read_program()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.is_viewer()
      or exists (select 1 from public.athlete_access where user_id = auth.uid());
$$;

drop policy if exists "exercises: read" on public.exercises;
create policy "exercises: read" on public.exercises for select using (public.can_read_program());
drop policy if exists "drills: read" on public.drills;
create policy "drills: read" on public.drills for select using (public.can_read_program());
drop policy if exists "drill_exercises: read" on public.drill_exercises;
create policy "drill_exercises: read" on public.drill_exercises for select using (public.can_read_program());
drop policy if exists "drill_categories: read" on public.drill_categories;
create policy "drill_categories: read" on public.drill_categories for select using (public.can_read_program());

drop policy if exists "sessions: read" on public.sessions;
create policy "sessions: read" on public.sessions for select using (
  public.is_staff() or public.is_viewer() or exists (
    select 1 from public.session_athletes sa
    where sa.session_id = sessions.id and public.can_view_athlete(sa.athlete_id)));
drop policy if exists "session_items: read" on public.session_items;
create policy "session_items: read" on public.session_items for select using (
  public.is_staff() or public.is_viewer() or exists (
    select 1 from public.session_athletes sa
    where sa.session_id = session_items.session_id and public.can_view_athlete(sa.athlete_id)));

drop policy if exists "setups: staff read" on storage.objects;
create policy "setups: staff read" on storage.objects
  for select using (bucket_id = 'setups' and (public.is_staff() or public.is_viewer()));

grant execute on function public.is_viewer(), public.can_read_program() to authenticated;
