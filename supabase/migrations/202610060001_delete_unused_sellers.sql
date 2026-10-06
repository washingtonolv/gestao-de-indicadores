begin;
-- Only administrators may remove sellers; existing foreign keys protect history.
grant delete on public.gi_sellers to authenticated;
create policy sellers_delete on public.gi_sellers for delete to authenticated using (gi_private.is_admin());
-- SECURITY INVOKER: every statement retains the caller's existing RLS rules.
create or replace function public.gi_apply_changes(changes jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare change jsonb; t text; action text; fields text[]; cols text; vals text; sets text; affected bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>10000 then raise exception 'Invalid changes'; end if;
 for change in select value from jsonb_array_elements(changes) loop
  t:=change->>'table'; action:=change->>'action';
  fields:=case t
   when 'gi_stores' then array['id','name','active']
   when 'gi_sellers' then array['id','store_id','name','active']
   when 'gi_entries' then array['id','store_id','seller_id','date','cents','orders','pieces']
   when 'gi_store_goals' then array['id','store_id','month','cents']
   when 'gi_seller_goals' then array['id','store_id','seller_id','month','cents']
   else null end;
  if fields is null or action not in ('insert','update','delete') then raise exception 'Unsupported change'; end if;
  select string_agg(format('%I',f),','),string_agg(format('r.%I',f),','),
   string_agg(format('%I=r.%I',f,f),',') filter(where f<>'id') into cols,vals,sets from unnest(fields) f;
  if action='insert' then
   execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r',t,cols,vals,t) using change->'row';
  elsif action='update' then
   execute format('update public.%I d set %s from jsonb_populate_record(null::public.%I,$1) r where d.id=r.id and d.updated_at=$2',t,sets,t)
    using change->'row',(change->>'expected')::timestamptz;
  else
   if t not in ('gi_entries','gi_store_goals','gi_seller_goals','gi_sellers') then raise exception 'Archive this record instead'; end if;
   execute format('delete from public.%I where id=$1 and updated_at=$2',t)
    using (change->'row'->>'id')::uuid,(change->>'expected')::timestamptz;
  end if;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Registro alterado por outra pessoa ou acesso indisponivel. Recarregue antes de salvar.' using errcode='40001'; end if;
 end loop;
end;
$$;
revoke all on function public.gi_apply_changes(jsonb) from public,anon;
grant execute on function public.gi_apply_changes(jsonb) to authenticated;
commit;
