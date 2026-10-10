begin;
create table public.gi_seller_daily_goals (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.gi_stores(id),
 seller_id uuid not null,
 date date not null check (date between '2000-01-01' and '2099-12-31'),
 cents bigint not null check (cents between 1 and 100000000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(seller_id,store_id) references public.gi_sellers(id,store_id),
 unique(seller_id,date)
);
create index gi_seller_daily_goals_store_date on public.gi_seller_daily_goals(store_id,date);
alter table public.gi_seller_daily_goals enable row level security;
revoke all on table public.gi_seller_daily_goals from public,anon,authenticated;
grant select,insert,update,delete on table public.gi_seller_daily_goals to authenticated;
create or replace function gi_private.prepare_row()
returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id then raise exception 'Record identity cannot be changed'; end if;
  if TG_TABLE_NAME='gi_sellers' then
   if new.store_id<>old.store_id then
    raise exception 'Archive the seller and create another to transfer stores';
   end if;
  end if;
  new.created_at:=old.created_at;
 else
  new.created_at:=now();
 end if;
 new.updated_at:=now();
 if TG_TABLE_NAME in ('gi_entries','gi_store_goals','gi_seller_goals','gi_seller_daily_goals') then
  if not exists(select 1 from public.gi_stores where id=new.store_id and active) then
   raise exception 'Store is archived or inaccessible';
  end if;
  if TG_TABLE_NAME in ('gi_entries','gi_seller_goals','gi_seller_daily_goals') then
   if not exists(select 1 from public.gi_sellers where id=new.seller_id and store_id=new.store_id and active) then
    raise exception 'Seller is archived or inaccessible';
   end if;
  end if;
 end if;
 return new;
end;
$$;
create trigger prepare_row before insert or update on public.gi_seller_daily_goals for each row execute function gi_private.prepare_row();
create trigger audit_row after insert or update or delete on public.gi_seller_daily_goals for each row execute function gi_private.audit_row();
create policy results_read on public.gi_seller_daily_goals for select to authenticated using (gi_private.has_access(store_id,seller_id,false));
create policy results_insert on public.gi_seller_daily_goals for insert to authenticated with check (gi_private.has_access(store_id,seller_id,true));
create policy results_update on public.gi_seller_daily_goals for update to authenticated using (gi_private.has_access(store_id,seller_id,true)) with check (gi_private.has_access(store_id,seller_id,true));
create policy results_delete on public.gi_seller_daily_goals for delete to authenticated using (gi_private.has_access(store_id,seller_id,true));
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
   when 'gi_seller_daily_goals' then array['id','store_id','seller_id','date','cents']
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
   if t not in ('gi_entries','gi_store_goals','gi_seller_goals','gi_seller_daily_goals','gi_sellers') then raise exception 'Archive this record instead'; end if;
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
