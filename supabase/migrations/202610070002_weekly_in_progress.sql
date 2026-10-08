begin;
create or replace function gi_private.entry_period_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare day date; first_day date; working integer:=0; boundary date; valid boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtext(new.seller_id::text));
 if coalesce(new.period_start,new.date)>current_date then raise exception 'Não é permitido lançar um período futuro.'; end if;
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

commit;
