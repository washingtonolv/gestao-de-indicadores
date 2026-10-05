-- SQL Editor only. Usa o primeiro administrador ativo existente.
-- Teste transacional: nenhum cadastro de teste permanece após o rollback.
begin;
select set_config('request.jwt.claim.sub',
 (select id::text from public.gi_profiles where active and role='admin' order by created_at limit 1),true);
set local role authenticated;
do $$
declare test_id uuid:=gen_random_uuid();
begin
 perform public.gi_apply_changes(jsonb_build_array(jsonb_build_object(
  'table','gi_stores','action','insert','row',jsonb_build_object('id',test_id,'name','Teste transacional '||test_id::text,'active',true))));
 if not exists(select 1 from public.gi_stores where id=test_id) then raise exception 'Falha de persistencia'; end if;
 if not exists(select 1 from public.gi_audit where record_id=test_id and actor_id=auth.uid()) then raise exception 'Falha de auditoria'; end if;
end $$;
rollback;
