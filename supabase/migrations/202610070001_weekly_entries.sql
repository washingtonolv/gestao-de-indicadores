begin;
alter table public.gi_entries add column period_start date;
alter table public.gi_entries add constraint entry_period_valid check(period_start is null or (period_start<=date and date_trunc('month',period_start)=date_trunc('month',date)));
create function gi_private.entry_period_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare day date; first_day date; working integer:=0; boundary date; valid boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtext(new.seller_id::text));
 if new.date>current_date then raise exception 'Não é permitido lançar um período futuro.'; end if;
 if new.period_start is not null then
  first_day:=date_trunc('month',new.date)::date;boundary:=first_day;
  for day in select generate_series(first_day,(first_day+interval '1 month - 1 day')::date,interval '1 day')::date loop
   if extract(dow from day)<>0 then working:=working+1; end if;
   if (working=7 and not(day=(first_day+interval '1 month - 2 day')::date and extract(dow from day+1)=0)) or day=(first_day+interval '1 month - 1 day')::date then
    if boundary=new.period_start and day=new.date then valid:=true;end if;
    boundary:=day+1;working:=0;
   end if;
  end loop;
  if not valid then raise exception 'Selecione um bloco válido de 7 dias úteis.';end if;
 end if;
 if exists(select 1 from public.gi_entries e where e.seller_id=new.seller_id and e.id<>new.id and coalesce(e.period_start,e.date)<=new.date and coalesce(new.period_start,new.date)<=e.date) then
  raise exception 'Já existe lançamento deste vendedor no período. Edite o registro existente.';
 end if;
 return new;
end;$$;
create trigger entry_period_guard before insert or update on public.gi_entries for each row execute function gi_private.entry_period_guard();
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
   when 'gi_entries' then array['id','store_id','seller_id','date','cents','orders','pieces','period_start']
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
