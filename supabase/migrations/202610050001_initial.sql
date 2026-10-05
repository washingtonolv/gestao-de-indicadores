-- One business per Supabase project. No account is automatically an administrator.
begin;
create schema gi_private;
revoke all on schema gi_private from public, anon, authenticated;

create table public.gi_stores (
 id uuid primary key default gen_random_uuid(),
 name text not null check (name = btrim(name) and length(name) between 1 and 80),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index gi_stores_name on public.gi_stores(lower(name));
create table public.gi_sellers (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.gi_stores(id),
 name text not null check (name = btrim(name) and length(name) between 1 and 80),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id, store_id)
);
create unique index gi_sellers_name on public.gi_sellers(store_id,lower(name));
create table public.gi_profiles (
 id uuid primary key references auth.users(id),
 name text not null check (length(btrim(name)) between 1 and 80),
 role text not null check (role in ('admin','manager','seller')),
 store_id uuid references public.gi_stores(id),
 seller_id uuid,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(seller_id,store_id) references public.gi_sellers(id,store_id),
 check ((role='admin' and store_id is null and seller_id is null)
   or (role='manager' and store_id is not null and seller_id is null)
   or (role='seller' and store_id is not null and seller_id is not null)),
 unique(seller_id)
);
create index gi_profiles_store on public.gi_profiles(store_id);
create table public.gi_entries (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.gi_stores(id),
 seller_id uuid not null,
 date date not null check (date between '2000-01-01' and '2099-12-31'),
 cents bigint not null check (cents between 0 and 100000000000),
 orders integer not null check (orders between 0 and 1000000),
 pieces integer not null check (pieces between 0 and 1000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(seller_id,store_id) references public.gi_sellers(id,store_id),
 check (orders>0 or (cents=0 and pieces=0))
);
create index gi_entries_store_date on public.gi_entries(store_id,date);
create index gi_entries_seller_date on public.gi_entries(seller_id,date);
create table public.gi_store_goals (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.gi_stores(id),
 month date not null check (extract(day from month)=1 and month between '2000-01-01' and '2099-12-01'),
 cents bigint not null check (cents between 1 and 100000000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id,month)
);
create table public.gi_seller_goals (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.gi_stores(id),
 seller_id uuid not null,
 month date not null check (extract(day from month)=1 and month between '2000-01-01' and '2099-12-01'),
 cents bigint not null check (cents between 1 and 100000000000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(seller_id,store_id) references public.gi_sellers(id,store_id),
 unique(seller_id,month)
);
create index gi_seller_goals_store on public.gi_seller_goals(store_id);
create table public.gi_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid,
 table_name text not null,
 record_id uuid not null,
 operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
 occurred_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb
);
create index gi_audit_time on public.gi_audit(occurred_at desc);

-- Read current membership from the database, never from editable JWT metadata.
create function gi_private.has_access(target_store uuid, target_seller uuid, writing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.gi_profiles p
  where p.id=(select auth.uid()) and p.active and (
   p.role='admin'
   or (p.store_id=target_store and exists(select 1 from public.gi_stores s where s.id=p.store_id and s.active)
       and (p.role='manager' or (not writing and p.role='seller' and p.seller_id=target_seller
            and exists(select 1 from public.gi_sellers v where v.id=p.seller_id and v.active))))
  )
 );
$$;
create function gi_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.gi_profiles where id=(select auth.uid()) and active and role='admin');
$$;
create function gi_private.can_read_store(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.gi_profiles p where p.id=(select auth.uid()) and p.active
  and (p.role='admin' or (p.store_id=target
   and exists(select 1 from public.gi_stores s where s.id=target and s.active)
   and (p.role='manager' or exists(select 1 from public.gi_sellers v where v.id=p.seller_id and v.active)))));
$$;

create function gi_private.prepare_row()
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
 if TG_TABLE_NAME in ('gi_entries','gi_store_goals','gi_seller_goals') then
  if not exists(select 1 from public.gi_stores where id=new.store_id and active) then
   raise exception 'Store is archived or inaccessible';
  end if;
  if TG_TABLE_NAME in ('gi_entries','gi_seller_goals') then
   if not exists(select 1 from public.gi_sellers where id=new.seller_id and store_id=new.store_id and active) then
    raise exception 'Seller is archived or inaccessible';
   end if;
  end if;
 end if;
 return new;
end;
$$;
create function gi_private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.gi_audit(actor_id,table_name,record_id,operation,before_data,after_data)
 values(auth.uid(),TG_TABLE_NAME,case when TG_OP='DELETE' then old.id else new.id end,TG_OP,
  case when TG_OP<>'INSERT' then to_jsonb(old) end,
  case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return null;
end;
$$;

do $$ declare t text; begin
 foreach t in array array['gi_stores','gi_sellers','gi_profiles','gi_entries','gi_store_goals','gi_seller_goals','gi_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
  if t<>'gi_audit' then
   execute format('grant insert, update on table public.%I to authenticated',t);
   execute format('create trigger prepare_row before insert or update on public.%I for each row execute function gi_private.prepare_row()',t);
   execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function gi_private.audit_row()',t);
  end if;
 end loop;
end $$;
grant delete on public.gi_entries, public.gi_store_goals, public.gi_seller_goals to authenticated;
revoke all on all functions in schema gi_private from public, anon, authenticated;
grant usage on schema gi_private to authenticated;
grant execute on function gi_private.has_access(uuid,uuid,boolean), gi_private.is_admin(), gi_private.can_read_store(uuid) to authenticated;

create policy stores_read on public.gi_stores for select to authenticated using (gi_private.can_read_store(id));
create policy stores_insert on public.gi_stores for insert to authenticated with check (gi_private.is_admin());
create policy stores_update on public.gi_stores for update to authenticated using (gi_private.is_admin()) with check (gi_private.is_admin());
create policy sellers_read on public.gi_sellers for select to authenticated using (gi_private.has_access(store_id,id,false));
create policy sellers_insert on public.gi_sellers for insert to authenticated with check (gi_private.is_admin());
create policy sellers_update on public.gi_sellers for update to authenticated using (gi_private.is_admin()) with check (gi_private.is_admin());
create policy profiles_read on public.gi_profiles for select to authenticated using ((id=(select auth.uid()) and active) or gi_private.is_admin());
create policy profiles_insert on public.gi_profiles for insert to authenticated with check (gi_private.is_admin());
create policy profiles_update on public.gi_profiles for update to authenticated using (gi_private.is_admin()) with check (gi_private.is_admin());
create policy audit_read on public.gi_audit for select to authenticated using (gi_private.is_admin());

do $$ declare t text; seller_expr text; begin
 foreach t in array array['gi_entries','gi_store_goals','gi_seller_goals'] loop
  seller_expr:=case when t='gi_store_goals' then 'null::uuid' else 'seller_id' end;
  execute format('create policy results_read on public.%I for select to authenticated using (gi_private.has_access(store_id,%s,false))',t,seller_expr);
  execute format('create policy results_insert on public.%I for insert to authenticated with check (gi_private.has_access(store_id,%s,true))',t,seller_expr);
  execute format('create policy results_update on public.%I for update to authenticated using (gi_private.has_access(store_id,%s,true)) with check (gi_private.has_access(store_id,%s,true))',t,seller_expr,seller_expr);
  execute format('create policy results_delete on public.%I for delete to authenticated using (gi_private.has_access(store_id,%s,true))',t,seller_expr);
 end loop;
end $$;
comment on table public.gi_profiles is 'Explicit membership. Auth signup alone grants no business data access. First admin provisioned by project owner.';
comment on table public.gi_audit is 'Database-generated audit. Application clients cannot write or delete. Project owners remain privileged.';
commit;
