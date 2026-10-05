-- Read-only post-deployment check. Expected: 7 tables, RLS true,
-- anon_access false, policies 3/3/3/4/4/4/1 per table.
select c.relname as tabela,
 c.relrowsecurity as rls_ativo,
 (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as politicas,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as acesso_anonimo
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in
 ('gi_stores','gi_sellers','gi_profiles','gi_entries','gi_store_goals','gi_seller_goals','gi_audit')
order by c.relname;
