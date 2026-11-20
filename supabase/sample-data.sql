-- =====================================================================
-- Flight Academy — SAMPLE / DEMO DATA
-- 12 made-up athletes (12U + 14U), 9 weekly sessions, realistic results.
-- Every sample row is tagged "[sample]" so supabase/sample-data-remove.sql
-- can delete all of it in one step. Safe to run once; re-running is a no-op.
-- =====================================================================
do $$
declare
  wk int;
  sid uuid;
  v_drill uuid;
  sess_date date;
  it record;
  r record;
  v numeric;
  meas2 text[] := array['40-Yard Dash', 'Broad Jump', 'Push-Ups'];
  meas3 text[] := array['Pro Shuttle', 'Sit and Reach', 'Single-Leg Balance'];
begin
  if exists (select 1 from public.athletes where notes like '[sample]%') then
    raise notice 'Sample data already loaded — nothing to do.';
    return;
  end if;
  perform setseed(0.42);

  -- ---------- Extra exercises so every category has data ----------
  insert into public.exercises (title, category_id, setup, steps, time_unit, reps_unit, created_by)
  select t.title, t.cat, '[sample] ' || t.setup, t.steps, t.tu, t.ru, null
  from (values
    ('40-Yard Dash',       2, 'Two cones 40 yards apart; timer at the finish.', array['Three-point start at cone 1','Sprint through the finish cone'], 'seconds', null),
    ('Broad Jump',         2, 'Tape line on the floor; measuring tape alongside.', array['Toes behind the line','Swing arms and jump forward','Measure to the back heel'], null, null),
    ('Push-Ups',           1, 'Open floor space.', array['Hands under shoulders, body straight','Chest to fist height each rep','Count reps in 60 seconds'], 'seconds', 'reps'),
    ('Sit and Reach',      6, 'Sit-and-reach box against a wall.', array['Legs straight, feet flat on the box','Reach slowly and hold 2 seconds'], null, null),
    ('Single-Leg Balance', 4, 'Flat surface; stopwatch.', array['Stand on one leg, hands on hips','Eyes forward; time until the foot touches down'], 'seconds', null),
    ('Beep Test',          5, 'Two lines 20 meters apart; beep test audio.', array['Run to the line on each beep','Count completed shuttles'], null, 'shuttles')
  ) as t(title, cat, setup, steps, tu, ru)
  where not exists (select 1 from public.exercises e where e.title = t.title);

  -- ---------- A sample drill (shows the drill builder) ----------
  insert into public.drills (title, setup, steps, created_by)
  values ('Speed Circuit', '[sample] Ladder → 3 cones → 10-yard sprint lane.',
          array['Agility ladder high-knee singles','Weave the 3 cones','Sprint 10 yards','Walk back; 3 rounds, 45s rest'], null)
  returning id into v_drill;
  insert into public.drill_exercises (drill_id, position, exercise_id)
  select v_drill, x.pos, (select id from public.exercises where title = x.title limit 1)
  from (values (1, 'Agility Ladder'), (2, '3 Cone'), (3, '40-Yard Dash')) as x(pos, title);
  insert into public.drill_categories (drill_id, rank, category_id) values (v_drill, 1, 2), (v_drill, 2, 3);

  -- ---------- Athletes ----------
  insert into public.athletes (first_name, last_name, birth_date, grade, school, sport, position, team_group, guardian_name, active, notes) values
    ('Marcus',  'Bell',     '2014-03-11', '6', 'Baker Middle',      'Football',   'WR', '12U', 'Dana Bell',      true, '[sample] Demo athlete'),
    ('Aaliyah', 'Grant',    '2014-07-22', '6', 'Baker Middle',      'Basketball', 'PG', '12U', 'Renee Grant',    true, '[sample] Demo athlete'),
    ('Jayden',  'Ortiz',    '2013-11-02', '7', 'Baker Middle',      'Soccer',     'MF', '12U', 'Luis Ortiz',     true, '[sample] Demo athlete'),
    ('Kennedy', 'Hughes',   '2014-01-30', '6', 'Fairborn Primary',  'Track',      'Sprints', '12U', 'Tom Hughes', true, '[sample] Demo athlete'),
    ('Elijah',  'Watts',    '2013-09-14', '7', 'Baker Middle',      'Football',   'RB', '12U', 'Kim Watts',      true, '[sample] Demo athlete'),
    ('Sofia',   'Ramirez',  '2014-05-05', '6', 'Fairborn Primary',  'Volleyball', 'OH', '12U', 'Ana Ramirez',    true, '[sample] Demo athlete'),
    ('Darius',  'King',     '2012-02-18', '8', 'Baker Middle',      'Football',   'QB', '14U', 'Monica King',    true, '[sample] Demo athlete'),
    ('Mia',     'Thompson', '2011-10-09', '9', 'Fairborn High',     'Soccer',     'D',  '14U', 'Greg Thompson',  true, '[sample] Demo athlete'),
    ('Isaiah',  'Carter',   '2012-06-27', '8', 'Baker Middle',      'Basketball', 'SG', '14U', 'Lisa Carter',    true, '[sample] Demo athlete'),
    ('Olivia',  'Brooks',   '2011-12-03', '9', 'Fairborn High',     'Track',      'Hurdles', '14U', 'Sam Brooks', true, '[sample] Demo athlete'),
    ('Tyler',   'Nguyen',   '2012-04-15', '8', 'Baker Middle',      'Football',   'LB', '14U', 'Kim Nguyen',     true, '[sample] Demo athlete'),
    ('Jasmine', 'Price',    '2011-08-21', '9', 'Fairborn High',     'Basketball', 'F',  '14U', 'Andre Price',    true, '[sample] Demo athlete');

  -- ---------- How each measure behaves ----------
  -- worst/best = realistic range for this age band; rate = weekly gain toward "best"
  create temp table _spec (title text primary key, item_type text, unit text, better text,
                           worst numeric, best numeric, rate numeric, noise numeric, places int) on commit drop;
  insert into _spec values
    ('3 Cone',             'exercise', 'seconds', 'lower',  9.60,  7.40, 0.050, 0.18, 2),
    ('40-Yard Dash',       'exercise', 'seconds', 'lower',  6.90,  5.30, 0.045, 0.10, 2),
    ('Pro Shuttle',        'exercise', 'seconds', 'lower',  6.10,  4.60, 0.040, 0.10, 2),
    ('Broad Jump',         'exercise', 'inches',  'higher', 58,    92,   1.10,  2.5,  0),
    ('Push-Ups',           'exercise', 'reps',    'higher', 10,    42,   1.00,  2.0,  0),
    ('Sit and Reach',      'exercise', 'inches',  'higher', 5,     15,   0.25,  0.6,  1),
    ('Single-Leg Balance', 'exercise', 'seconds', 'higher', 12,    60,   2.20,  3.0,  0),
    ('Agility Ladder',     'exercise', 'reps',    'higher', 5,     12,   0.30,  0.8,  0),
    ('Jump Rope',          'exercise', 'reps',    'higher', 55,    130,  3.00,  6.0,  0),
    ('Beep Test',          'exercise', 'reps',    'higher', 22,    70,   1.60,  2.5,  0),
    ('Speed Circuit',      'drill',    'reps',    'higher', 3,     7,    0.12,  0.4,  0);

  -- Per-athlete ability (older group a bit ahead) and how fast they improve.
  create temp table _ath on commit drop as
  select id, team_group,
         least(0.95, greatest(0.05, random() * 0.6 + case when team_group = '14U' then 0.30 else 0.10 end)) as skill,
         case when row_number() over (order by last_name) in (3, 10) then 0.15   -- two plateau athletes
              else 0.6 + random() * 0.9 end as pace
  from public.athletes where notes like '[sample]%';

  create temp table _base on commit drop as
  select a.id as athlete_id, s.title,
         s.worst + (s.best - s.worst) * least(0.98, greatest(0.02, a.skill + (random() - 0.5) * 0.25)) as base,
         a.pace
  from _ath a cross join _spec s;

  -- ---------- 9 weekly sessions ----------
  for wk in 0..8 loop
    sess_date := date '2026-09-24' + wk * 7;
    insert into public.sessions (session_date, coach_name, location, notes)
    values (sess_date, 'Sample Coach', 'Main Gym', '[sample]')
    returning id into sid;

    -- Columns: 4 conditioning + 3 measure (Measure 1 = 3 Cone every week)
    insert into public.session_items (session_id, section, slot, item_type, exercise_id, drill_id, label, unit, better)
    select sid, x.section, x.slot, s.item_type,
           case when s.item_type = 'exercise' then (select id from public.exercises where title = s.title limit 1) end,
           case when s.item_type = 'drill' then v_drill end,
           s.title, s.unit, s.better
    from (values
      ('conditioning', 1, 'Agility Ladder'),
      ('conditioning', 2, 'Jump Rope'),
      ('conditioning', 3, 'Speed Circuit'),
      ('conditioning', 4, 'Beep Test'),
      ('measure',      1, '3 Cone'),
      ('measure',      2, meas2[wk % 3 + 1]),
      ('measure',      3, meas3[wk % 3 + 1])
    ) as x(section, slot, title)
    join _spec s on s.title = x.title;

    -- Attendance: everyone at the first and last test; ~85% otherwise
    insert into public.session_athletes (session_id, athlete_id)
    select sid, id from _ath where wk in (0, 8) or random() < 0.85;

    -- Results for everyone who attended
    for it in select si.id, si.label from public.session_items si where si.session_id = sid loop
      for r in select b.athlete_id, b.base, b.pace, s.*
               from _base b join _spec s on s.title = b.title
               join public.session_athletes sa on sa.athlete_id = b.athlete_id and sa.session_id = sid
               where b.title = it.label loop
        v := r.base + sign(r.best - r.worst) * r.rate * r.pace * wk + (random() - 0.5) * r.noise;
        v := case when r.best > r.worst then least(v, r.best * 1.05) else greatest(v, r.best * 0.95) end;
        insert into public.results (session_item_id, athlete_id, value)
        values (it.id, r.athlete_id, round(greatest(v, 0), r.places));
      end loop;
    end loop;
  end loop;

  -- Scoring settings on the library items the sample uses
  update public.exercises e set score_unit = s.unit, better = s.better from _spec s where e.title = s.title and s.item_type = 'exercise';
  update public.drills d set score_unit = s.unit, better = s.better from _spec s where d.title = s.title and s.item_type = 'drill' and d.setup like '[sample]%';

  raise notice 'Sample data loaded: 12 athletes, 9 sessions.';
end $$;
