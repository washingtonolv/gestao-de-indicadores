begin;
-- gi_sellers remains a store-specific identity. person_id links explicit transfers;
-- matching names alone never merges people or moves historic records.
alter table public.gi_sellers add column person_id uuid not null default gen_random_uuid();
create index gi_sellers_person on public.gi_sellers(person_id);
create unique index gi_sellers_person_store on public.gi_sellers(person_id,store_id);
revoke insert,update on public.gi_sellers from authenticated;
grant insert(id,store_id,name,active),update(id,store_id,name,active) on public.gi_sellers to authenticated;
create table public.gi_seller_periods (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null,
 store_id uuid not null references public.gi_stores(id),
 started_on date check(started_on between '2000-01-01' and '2099-12-31'),
 ended_on date check(ended_on between '2000-01-01' and '2099-12-31'),
 end_reason text check(end_reason in ('transfer','dismiss','archive')),
 created_at timestamptz not null default now(),
 check(ended_on is null or ended_on>=coalesce(started_on,'2000-01-01'::date)),
 check((ended_on is null)=(end_reason is null)),
 foreign key(seller_id,store_id) references public.gi_sellers(id,store_id) on delete cascade
);
create unique index gi_seller_periods_open on public.gi_seller_periods(seller_id) where ended_on is null;
create index gi_seller_periods_seller on public.gi_seller_periods(seller_id,started_on);
create index gi_seller_periods_store on public.gi_seller_periods(store_id);
create table public.gi_seller_movements (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null,
 from_seller_id uuid not null references public.gi_sellers(id),
 to_seller_id uuid references public.gi_sellers(id),
 action text not null check(action in ('transfer','dismiss','archive','reactivate')),
 effective_on date not null check(effective_on between '2000-01-01' and '2099-12-31'),
 note text not null default '' check(length(note)<=500),
 actor_id uuid,
 actor_name text not null,
 goal_changes jsonb,
 created_at timestamptz not null default now()
);
create index gi_seller_movements_person on public.gi_seller_movements(person_id,created_at);
create index gi_seller_movements_source on public.gi_seller_movements(from_seller_id);
create index gi_seller_movements_target on public.gi_seller_movements(to_seller_id);
alter table public.gi_seller_periods enable row level security;
alter table public.gi_seller_movements enable row level security;
revoke all on public.gi_seller_periods,public.gi_seller_movements from public,anon,authenticated;
grant select on public.gi_seller_periods,public.gi_seller_movements to authenticated;
create policy periods_read on public.gi_seller_periods for select to authenticated using(gi_private.has_access(store_id,seller_id,false));
create policy movements_read on public.gi_seller_movements for select to authenticated using((select gi_private.is_admin()));
-- Unknown initial admission dates stay NULL; no invented dates or movements.
insert into public.gi_seller_periods(seller_id,store_id) select id,store_id from public.gi_sellers where active;

create function gi_private.seed_seller_period() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active and coalesce(current_setting('gi.lifecycle_operation',true),'')<>'on' then
  insert into public.gi_seller_periods(seller_id,store_id) values(new.id,new.store_id);
 end if;
 return null;
end;$$;
create trigger seed_seller_period after insert on public.gi_sellers for each row execute function gi_private.seed_seller_period();
create function gi_private.seller_identity_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.person_id is distinct from old.person_id then raise exception 'A identidade da pessoa não pode ser alterada.'; end if;
 if new.active is distinct from old.active and coalesce(current_setting('gi.lifecycle_operation',true),'')<>'on' then
  raise exception 'Use Transferir, Desligar/arquivar ou Reativar para registrar a data e preservar o histórico.';
 end if;
 return new;
end;$$;
create trigger seller_identity_guard before update on public.gi_sellers for each row execute function gi_private.seller_identity_guard();

create function gi_private.seller_period_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare person uuid; is_active boolean; first_date date; last_date date;
begin
 select person_id into person from public.gi_sellers where id=new.seller_id;
 perform pg_advisory_xact_lock(hashtextextended(person::text,27));
 select active into is_active from public.gi_sellers where id=new.seller_id;
 if not coalesce(is_active,false) then raise exception 'Este vínculo está inativo. Confira o histórico do vendedor.';end if;
 if TG_TABLE_NAME='gi_entries' then
  first_date:=coalesce(new.period_start,new.date);last_date:=new.date;
 elsif TG_TABLE_NAME='gi_seller_daily_goals' then first_date:=new.date;last_date:=new.date;
 else
  if not exists(select 1 from public.gi_seller_periods p where p.seller_id=new.seller_id and coalesce(p.started_on,'2000-01-01')<=new.month+interval '1 month - 1 day' and coalesce(p.ended_on,'2099-12-31')>=new.month) then
   raise exception 'A meta não corresponde a um período de vínculo nesta loja.';
  end if;
  return new;
 end if;
 if not exists(select 1 from public.gi_seller_periods p where p.seller_id=new.seller_id and p.store_id=new.store_id and coalesce(p.started_on,'2000-01-01')<=first_date and coalesce(p.ended_on,'2099-12-31')>=last_date) then
  raise exception 'O período informado está fora do vínculo do vendedor nesta loja. Na semana de transferência, confira os lançamentos diários.';
 end if;
 return new;
end;$$;
create trigger zz_seller_period_guard before insert or update on public.gi_entries for each row execute function gi_private.seller_period_guard();
create trigger zz_seller_period_guard before insert or update on public.gi_seller_goals for each row execute function gi_private.seller_period_guard();
create trigger zz_seller_period_guard before insert or update on public.gi_seller_daily_goals for each row execute function gi_private.seller_period_guard();

-- Private definer is needed for one atomic movement plus account rebinding.
-- It checks current database membership, never editable JWT/user metadata.
create function gi_private.manage_seller(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 source public.gi_sellers%rowtype; target public.gi_sellers%rowtype;
 period public.gi_seller_periods%rowtype;
 source_goal public.gi_seller_goals%rowtype; target_goal public.gi_seller_goals%rowtype;
 action text; day date; last_day date; target_store uuid; goal_month date;
 source_cents bigint; target_cents bigint; adjust boolean; actor_name text; changes jsonb;
begin
 if auth.uid() is null or not gi_private.is_admin() then raise exception 'Somente administradores podem movimentar vendedores.' using errcode='42501';end if;
 if jsonb_typeof(payload)<>'object' then raise exception 'Movimentação inválida.';end if;
 action:=payload->>'action';day:=(payload->>'date')::date;
 if action is null or action not in ('transfer','dismiss','archive','reactivate') or day is null or day<'2000-01-01' or day>(now() at time zone 'America/Sao_Paulo')::date then
  raise exception 'Selecione uma ação e uma data válida, até hoje. Agendamentos futuros não estão disponíveis.';
 end if;
 if length(coalesce(payload->>'note',''))>500 then raise exception 'A observação deve ter até 500 caracteres.';end if;
 select * into source from public.gi_sellers where id=(payload->>'sellerId')::uuid;
 if not found then raise exception 'Vendedor não encontrado.';end if;
 perform pg_advisory_xact_lock(hashtextextended(source.person_id::text,27));
 select * into source from public.gi_sellers where id=source.id for update;
 if source.updated_at is distinct from (payload->>'expected')::timestamptz then raise exception 'O cadastro mudou. Atualize os dados e confira a movimentação novamente.' using errcode='40001';end if;
 select name into actor_name from public.gi_profiles where id=auth.uid();
 select * into period from public.gi_seller_periods where seller_id=source.id and ended_on is null for update;
 goal_month:=date_trunc('month',day)::date;
 adjust:=coalesce((payload->>'adjustGoals')::boolean,false);
 if adjust and action<>'transfer' then raise exception 'O ajuste de metas está disponível na transferência.';end if;
 if action='reactivate' then
  if source.active then raise exception 'Este vendedor já está ativo.';end if;
  if not exists(select 1 from public.gi_stores where id=source.store_id and active) then raise exception 'Reative a loja antes de reativar o vendedor.';end if;
  if exists(select 1 from public.gi_sellers where person_id=source.person_id and active) then raise exception 'Esta pessoa já está ativa em outra loja. Use Transferir no vínculo ativo.';end if;
  if exists(select 1 from public.gi_seller_periods p join public.gi_sellers s on s.id=p.seller_id where s.person_id=source.person_id and (p.ended_on is null or p.ended_on>=day)) or exists(select 1 from public.gi_entries where seller_id=source.id and date>=day) then
   raise exception 'A reativação deve começar depois dos vínculos e resultados anteriores.';
  end if;
  perform set_config('gi.lifecycle_operation','on',true);
  update public.gi_sellers set active=true where id=source.id returning * into target;
  insert into public.gi_seller_periods(seller_id,store_id,started_on) values(target.id,target.store_id,day);
 else
  if not source.active or period.id is null then raise exception 'Este vínculo não está ativo. Atualize o cadastro.';end if;
  last_day:=case when action='transfer' then day-1 else day end;
  if last_day<coalesce(period.started_on,'2000-01-01') then raise exception 'A data é anterior ao início deste vínculo.';end if;
  if exists(select 1 from public.gi_entries where seller_id=source.id and date>last_day) then
   raise exception 'Há vendas ou um bloco semanal após o último dia na loja. Confira esses lançamentos antes de movimentar. Nenhum valor foi alterado.';
  end if;
  if action='transfer' then
   target_store:=(payload->>'targetStoreId')::uuid;
   if target_store is null or target_store=source.store_id or not exists(select 1 from public.gi_stores where id=target_store and active) then raise exception 'Selecione outra loja ativa.';end if;
   select * into target from public.gi_sellers where store_id=target_store and person_id=source.person_id for update;
   if target.id is not null and target.active then raise exception 'Esta pessoa já está ativa na loja de destino.';end if;
   if target.id is null and exists(select 1 from public.gi_sellers where store_id=target_store and lower(name)=lower(source.name)) then
    raise exception 'Já existe um cadastro com este nome na loja de destino. Confira a identidade antes de transferir; históricos não são unidos pelo nome.';
   end if;
   if target.id is not null and exists(select 1 from public.gi_seller_periods where seller_id=target.id and (ended_on is null or ended_on>=day)) then raise exception 'O destino possui um vínculo que sobrepõe esta data.';end if;
   if target.id is not null and exists(select 1 from public.gi_profiles where seller_id=target.id) then raise exception 'O destino já possui uma conta vinculada. Confira os acessos antes da transferência.';end if;
   if adjust then
    source_cents:=(payload->>'sourceGoalCents')::bigint;target_cents:=(payload->>'targetGoalCents')::bigint;
    if source_cents is null or target_cents is null or source_cents not between 0 and 100000000000 or target_cents not between 0 and 100000000000 then raise exception 'Confira os valores das duas metas.';end if;
    select * into source_goal from public.gi_seller_goals where seller_id=source.id and public.gi_seller_goals.month=goal_month for update;
    if target.id is not null then select * into target_goal from public.gi_seller_goals where seller_id=target.id and public.gi_seller_goals.month=goal_month for update;end if;
    if source_goal.updated_at is distinct from (payload->>'sourceGoalExpected')::timestamptz or target_goal.updated_at is distinct from (payload->>'targetGoalExpected')::timestamptz then raise exception 'As metas mudaram. Atualize os dados e confira os valores novamente.' using errcode='40001';end if;
    changes:=jsonb_build_object('month',goal_month,'sourceBefore',source_goal.cents,'sourceAfter',source_cents,'targetBefore',target_goal.cents,'targetAfter',target_cents);
   end if;
  end if;
  perform set_config('gi.lifecycle_operation','on',true);
  -- Adjust the old monthly target while its store-specific seller is still active.
  if adjust then
   if source_cents=0 then delete from public.gi_seller_goals where id=source_goal.id;
   else insert into public.gi_seller_goals(store_id,seller_id,month,cents) values(source.store_id,source.id,goal_month,source_cents) on conflict(seller_id,month) do update set cents=excluded.cents;end if;
  end if;
  update public.gi_seller_periods set ended_on=last_day,end_reason=action where id=period.id;
  update public.gi_sellers set active=false where id=source.id;
  if action='transfer' then
   if target.id is null then insert into public.gi_sellers(store_id,name,person_id) values(target_store,source.name,source.person_id) returning * into target;
   else update public.gi_sellers set active=true where id=target.id returning * into target;end if;
   insert into public.gi_seller_periods(seller_id,store_id,started_on) values(target.id,target.store_id,day);
   update public.gi_profiles set store_id=target.store_id,seller_id=target.id where seller_id=source.id and role='seller';
   if adjust then
    if target_cents=0 then delete from public.gi_seller_goals where id=target_goal.id;
    else insert into public.gi_seller_goals(store_id,seller_id,month,cents) values(target.store_id,target.id,goal_month,target_cents) on conflict(seller_id,month) do update set cents=excluded.cents;end if;
   end if;
  else
   update public.gi_profiles set active=false where role='seller' and seller_id in(select id from public.gi_sellers where person_id=source.person_id);
  end if;
 end if;
 insert into public.gi_seller_movements(person_id,from_seller_id,to_seller_id,action,effective_on,note,actor_id,actor_name,goal_changes)
 values(source.person_id,source.id,case when action in('transfer','reactivate') then target.id else null end,action,day,coalesce(payload->>'note',''),auth.uid(),actor_name,changes);
 perform set_config('gi.lifecycle_operation','off',true);
 return jsonb_build_object('sellerId',source.id,'targetSellerId',target.id,'action',action);
end;$$;
create function public.gi_manage_seller(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select gi_private.manage_seller(payload); $$;
revoke all on function gi_private.seed_seller_period(),gi_private.seller_identity_guard(),gi_private.seller_period_guard(),gi_private.manage_seller(jsonb),public.gi_manage_seller(jsonb) from public,anon,authenticated;
grant execute on function gi_private.manage_seller(jsonb),public.gi_manage_seller(jsonb) to authenticated;
create trigger audit_row after insert or update or delete on public.gi_seller_periods for each row execute function gi_private.audit_row();
create trigger audit_row after insert or update or delete on public.gi_seller_movements for each row execute function gi_private.audit_row();
comment on column public.gi_sellers.person_id is 'Permanent identity shared only through an explicit, audited transfer; store-specific IDs and historical sales are preserved.';
comment on table public.gi_seller_periods is 'Dated store assignments. NULL initial admission dates mean unknown, not an invented historical date.';
comment on table public.gi_seller_movements is 'Append-only through gi_manage_seller; no client write grants. Dismissal/archive blocks linked seller accounts; reactivation never re-enables an account automatically.';
commit;
