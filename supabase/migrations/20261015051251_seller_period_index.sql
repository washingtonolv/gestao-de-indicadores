begin;
-- Cover the complete composite foreign key used by dated assignments.
drop index public.gi_seller_periods_seller;
create index gi_seller_periods_seller on public.gi_seller_periods(seller_id,store_id,started_on);
-- The unique person/store index already supports lookups by person_id.
drop index public.gi_sellers_person;
commit;
