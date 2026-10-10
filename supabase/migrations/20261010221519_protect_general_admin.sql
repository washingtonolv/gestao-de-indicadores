begin;
-- This identity was verified against the existing account. Protection never
-- depends on an editable username or user_metadata.
create function gi_private.protect_general_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
 if old.id='828cf271-af97-4d61-a1e3-5a89dd93a78c'::uuid then
  if TG_OP='DELETE' then
   raise exception 'O administrador geral não pode ser excluído.' using errcode='42501';
  end if;
  if auth.uid() is distinct from old.id then
   raise exception 'Somente o administrador geral pode alterar sua própria conta.' using errcode='42501';
  end if;
  if new.role<>'admin' or not new.active or new.login_name is distinct from old.login_name
     or new.id<>old.id or new.store_id is not null or new.seller_id is not null then
   raise exception 'O login e os privilégios do administrador geral são permanentes.' using errcode='42501';
  end if;
 end if;
 if TG_OP='UPDATE' and old.id=auth.uid() and old.role='admin'
    and (new.role<>'admin' or not new.active) then
  raise exception 'Você não pode retirar seu próprio acesso administrativo.' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function gi_private.protect_general_admin() from public, anon, authenticated;
create trigger protect_general_admin before update or delete on public.gi_profiles
 for each row execute function gi_private.protect_general_admin();
-- Auth deletion and access-profile deletion are one transaction. Business
-- records reference sellers/stores, so their history remains intact.
alter table public.gi_profiles drop constraint gi_profiles_id_fkey;
alter table public.gi_profiles add constraint gi_profiles_id_fkey
 foreign key(id) references auth.users(id) on delete cascade;
commit;
