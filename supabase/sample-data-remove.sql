-- Removes ALL Flight Academy sample/demo data (rows tagged "[sample]").
-- Real athletes, sessions, exercises and drills are untouched.
delete from public.sessions  where notes = '[sample]';          -- also removes their columns, attendance, results
delete from public.athletes  where notes like '[sample]%';      -- also removes any remaining results
delete from public.drills    where setup like '[sample]%';
delete from public.exercises where setup like '[sample]%';
