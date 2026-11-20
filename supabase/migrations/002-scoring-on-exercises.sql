-- =====================================================================
-- 002 — Scoring lives on each exercise / drill
-- Adds score_unit + better to exercises and drills, and fills them in for
-- everything already in the library. Safe to re-run (never overwrites a
-- value a coach has already set).
-- =====================================================================
alter table public.exercises add column if not exists score_unit text;
alter table public.exercises add column if not exists better text;
alter table public.drills    add column if not exists score_unit text;
alter table public.drills    add column if not exists better text;

-- 1) If it has been scored in a session, use how it was actually scored (most recent).
update public.exercises e set score_unit = u.unit, better = u.better
from (select distinct on (si.exercise_id) si.exercise_id, si.unit, si.better
      from public.session_items si join public.sessions s on s.id = si.session_id
      where si.exercise_id is not null
      order by si.exercise_id, s.session_date desc) u
where u.exercise_id = e.id and e.score_unit is null;

update public.drills d set score_unit = u.unit, better = u.better
from (select distinct on (si.drill_id) si.drill_id, si.unit, si.better
      from public.session_items si join public.sessions s on s.id = si.session_id
      where si.drill_id is not null
      order by si.drill_id, s.session_date desc) u
where u.drill_id = d.id and d.score_unit is null;

-- 2) Known exercises that are NOT "fastest time wins".
update public.exercises e set score_unit = v.unit, better = v.better
from (values
  ('Plyo Box',           'reps',    'higher'),
  ('Agility Ladder',     'reps',    'higher'),
  ('Jump Rope',          'reps',    'higher'),
  ('Broad Jump',         'inches',  'higher'),
  ('Push-Ups',           'reps',    'higher'),
  ('Sit and Reach',      'inches',  'higher'),
  ('Single-Leg Balance', 'seconds', 'higher'),
  ('Beep Test',          'reps',    'higher')
) as v(title, unit, better)
where e.title = v.title and e.score_unit is null;

-- 3) Everything else is a timed drill: seconds, lower is better.
update public.exercises set score_unit = 'seconds' where score_unit is null;
update public.exercises set better = case when score_unit = 'seconds' then 'lower' else 'higher' end where better is null;
update public.drills    set score_unit = 'seconds' where score_unit is null;
update public.drills    set better = case when score_unit = 'seconds' then 'lower' else 'higher' end where better is null;

-- Lock it in: defaults, required, and only valid values.
alter table public.exercises alter column score_unit set default 'seconds', alter column score_unit set not null,
                            alter column better set default 'lower', alter column better set not null;
alter table public.drills    alter column score_unit set default 'seconds', alter column score_unit set not null,
                            alter column better set default 'lower', alter column better set not null;
do $$ begin
  alter table public.exercises add constraint exercises_score_unit_chk check (score_unit in ('reps','seconds','meters','yards','inches','lbs'));
  alter table public.exercises add constraint exercises_better_chk check (better in ('higher','lower'));
  alter table public.drills    add constraint drills_score_unit_chk check (score_unit in ('reps','seconds','meters','yards','inches','lbs'));
  alter table public.drills    add constraint drills_better_chk check (better in ('higher','lower'));
exception when duplicate_object then null; end $$;
