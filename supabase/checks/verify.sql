-- Flight Academy: confirm the schema installed correctly.
-- Every row should show rls_enabled = true.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.tablename = c.relname and p.schemaname = 'public') as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select '— categories seeded (expect 7)', null, (select count(*) from public.categories)
union all
select '— starter exercises (expect 15)', null, (select count(*) from public.exercises)
order by 1;
