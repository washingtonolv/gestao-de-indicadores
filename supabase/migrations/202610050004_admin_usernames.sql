begin;
-- Existing administrator: email login stays supported by Supabase Auth.
update public.gi_profiles set login_name='washingtonolv'
where id='828cf271-af97-4d61-a1e3-5a89dd93a78c' and role='admin'
and (login_name is null or login_name='washingtonolv@gmail.com');
commit;
