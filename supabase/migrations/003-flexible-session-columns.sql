-- =====================================================================
-- 003 — Sessions can have any number of Conditioning / Measure columns
-- Removes the old hard limits (6 conditioning, 3 measure). The app shows
-- those numbers as a recommendation instead. Safe to re-run.
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.session_items'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%slot%'
  loop
    execute format('alter table public.session_items drop constraint %I', r.conname);
  end loop;
  alter table public.session_items add constraint session_items_slot_positive check (slot >= 1);
end $$;
