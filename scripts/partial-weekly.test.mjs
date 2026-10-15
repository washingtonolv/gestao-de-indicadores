import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';

const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
for(const name of readdirSync('supabase/migrations').sort())
 await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));

await db.exec(`insert into auth.users(id) values('${id(1)}');
 insert into public.gi_stores(id,name) values('${id(11)}','Centro'),('${id(12)}','Norte');
 insert into public.gi_sellers(id,store_id,name) values('${id(21)}','${id(11)}','Ana');
 insert into public.gi_profiles(id,name,role) values('${id(1)}','Admin','admin');
 select set_config('request.jwt.claim.sub','${id(1)}',false);
 set role authenticated;`);
const entry=(seller,store,start,end,cents=10000)=>`insert into public.gi_entries(store_id,seller_id,period_start,date,cents,orders,pieces)
 values('${store}','${seller}','${start}','${end}',${cents},2,3)`;

await db.exec(entry(id(21),id(11),'2026-10-09','2026-10-11'));
const original=(await rows('select id from public.gi_entries'))[0].id;
await assert.rejects(()=>db.exec(entry(id(21),id(11),'2026-10-10','2026-10-10')),/Já existe lançamento/);
await assert.rejects(()=>db.exec(entry(id(21),id(11),'2026-10-08','2026-10-09')),/mesmo bloco semanal/);
await assert.rejects(()=>db.exec(entry(id(21),id(11),'2026-10-09','2026-10-16')),/período futuro/);
await db.exec(`update public.gi_entries set date='2026-10-14',cents=20000 where id='${original}'`);
const updated=(await rows('select id,date,cents from public.gi_entries'))[0];
assert.equal(updated.id,original);
assert.equal(updated.date.toISOString().slice(0,10),'2026-10-14');
assert.equal(updated.cents,20000);
const expected=(await rows(`select updated_at from public.gi_sellers where id='${id(21)}'`))[0].updated_at.toISOString();
const movement=(await rows('select public.gi_manage_seller($1::jsonb) as result',[
 JSON.stringify({action:'transfer',sellerId:id(21),expected,date:'2026-10-15',targetStoreId:id(12)})
]))[0].result;
const target=movement.targetSellerId;
await db.exec(entry(target,id(12),'2026-10-15','2026-10-15',5000));
assert.equal((await rows('select count(*)::int as n from public.gi_entries'))[0].n,2);
await assert.rejects(()=>db.exec(`update public.gi_entries set period_start='2026-10-14' where seller_id='${target}'`),/fora do vínculo/);
await assert.rejects(()=>db.exec(entry(id(21),id(11),'2026-10-15','2026-10-15')),/archived or inaccessible|inativo/);
console.log('Partial weekly entries: cumulative update, future/cross-block/overlap guards and mid-week transfer passed.');
await db.close();
