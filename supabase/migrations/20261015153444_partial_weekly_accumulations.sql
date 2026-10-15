begin;

-- A weekly entry can represent a cumulative portion of its seven-working-day
-- block. Its start and end must stay inside one canonical block.
create or replace function gi_private.entry_period_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 day date;
 first_day date;
 working integer:=0;
 boundary date;
 valid boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtext(new.seller_id::text));
 if new.date>(now() at time zone 'America/Sao_Paulo')::date then
  raise exception 'Não é permitido lançar um período futuro.';
 end if;
 if new.period_start is not null then
  first_day:=date_trunc('month',new.date)::date;
  boundary:=first_day;
  for day in select generate_series(first_day,(first_day+interval '1 month - 1 day')::date,interval '1 day')::date loop
   if extract(dow from day)<>0 then working:=working+1; end if;
   if (working=7 and not(day=(first_day+interval '1 month - 2 day')::date and extract(dow from day+1)=0))
      or day=(first_day+interval '1 month - 1 day')::date then
    if new.period_start>=boundary and new.date<=day then valid:=true; end if;
    boundary:=day+1;
    working:=0;
   end if;
  end loop;
  if not valid then
   raise exception 'O início e o fim do acumulado devem estar no mesmo bloco semanal.';
  end if;
 end if;
 if exists(select 1 from public.gi_entries e
           where e.seller_id=new.seller_id and e.id<>new.id
             and coalesce(e.period_start,e.date)<=new.date
             and coalesce(new.period_start,new.date)<=e.date) then
  raise exception 'Já existe lançamento deste vendedor no período. Edite o registro existente.';
 end if;
 return new;
end;$$;

create or replace function gi_private.seller_period_guard() returns trigger
language plpgsql security definer set search_path='' as $$
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
  raise exception 'O período informado está fora do vínculo do vendedor nesta loja. Ajuste o início e o fim do acumulado semanal conforme a transferência.';
 end if;
 return new;
end;$$;

commit;
