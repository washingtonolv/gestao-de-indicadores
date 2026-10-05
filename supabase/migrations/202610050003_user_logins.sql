begin;
alter table public.gi_profiles add column login_name text;
create unique index gi_profiles_login_name on public.gi_profiles(lower(login_name)) where login_name is not null;
alter table public.gi_profiles add constraint gi_profile_login_length check(login_name is null or length(login_name) between 3 and 160);
-- Existing administrator accounts retain their verified Auth email as login.
update public.gi_profiles p set login_name=lower(u.email)
from auth.users u where u.id=p.id and p.role='admin' and p.login_name is null;
commit;
