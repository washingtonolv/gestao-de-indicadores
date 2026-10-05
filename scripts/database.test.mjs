import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const qid = n => `'${id(n)}'`;
await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;`);
await db.exec(readFileSync(new URL('../supabase/migrations/202610050001_initial.sql',import.meta.url),'utf8'));
await db.exec(`insert into auth.users values (${qid(1)}),(${qid(2)}),(${qid(3)}),(${qid(4)}),(${qid(5)});
 insert into public.gi_stores(id,name) values (${qid(11)},'Centro'),(${qid(12)},'Norte');
 insert into public.gi_sellers(id,store_id,name) values (${qid(21)},${qid(11)},'Ana'),(${qid(22)},${qid(11)},'Bia'),(${qid(23)},${qid(12)},'Caio');
 insert into public.gi_profiles(id,name,role,store_id,seller_id) values
 (${qid(1)},'Admin','admin',null,null),(${qid(2)},'Gestor','manager',${qid(11)},null),
 (${qid(3)},'Ana','seller',${qid(11)},${qid(21)}),(${qid(4)},'Outro gestor','manager',${qid(12)},null);
 insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values
 (${qid(11)},${qid(21)},'2026-10-01',10000,2,3),(${qid(11)},${qid(22)},'2026-10-01',20000,3,4),(${qid(12)},${qid(23)},'2026-10-01',30000,4,5);
 insert into public.gi_store_goals(store_id,month,cents) values (${qid(11)},'2026-10-01',100000),(${qid(12)},'2026-10-01',200000);
 insert into public.gi_seller_goals(store_id,seller_id,month,cents) values
 (${qid(11)},${qid(21)},'2026-10-01',50000),(${qid(11)},${qid(22)},'2026-10-01',50000),(${qid(12)},${qid(23)},'2026-10-01',200000);`);
let checks=0;
async function as(n,role='authenticated') { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${n ? id(n):''}',false); set role ${role};`); }
async function count(table,n) { const {rows}=await db.query(`select count(*)::int as n from public.${table}`); assert.equal(rows[0].n,n,table); checks++; }
async function denied(sql,code='42501') { await assert.rejects(()=>db.exec(sql),e=>e.code===code || (code==='42501' && e.code==='P0001')); checks++; }
async function unchanged(sql){ const r=await db.query(sql+' returning id'); assert.equal(r.rows.length,0); checks++; }
for(const t of ['gi_stores','gi_sellers','gi_profiles','gi_entries','gi_store_goals','gi_seller_goals','gi_audit']) {
 await as(null,'anon'); await denied(`select * from public.${t}`);
 await as(5); await count(t,0);
}
await denied(`insert into public.gi_profiles(id,name,role) values (${qid(5)},'Escalation','admin')`);
await as(3);
await count('gi_entries',1); await count('gi_sellers',1); await count('gi_stores',1);
await count('gi_store_goals',0); await count('gi_seller_goals',1); await count('gi_profiles',1); await count('gi_audit',0);
await denied(`insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values (${qid(11)},${qid(21)},'2026-10-02',100,1,1)`);
await unchanged('update public.gi_entries set cents=99999');
await unchanged('delete from public.gi_entries');
await unchanged("update public.gi_profiles set role='admin',store_id=null,seller_id=null");
await unchanged('update public.gi_seller_goals set cents=99999');
await unchanged('delete from public.gi_seller_goals');
await as(2); await count('gi_entries',2); await count('gi_sellers',2); await count('gi_stores',1); await count('gi_store_goals',1); await count('gi_seller_goals',2);
await db.exec(`insert into public.gi_entries(id,store_id,seller_id,date,cents,orders,pieces,updated_at) values (${qid(31)},${qid(11)},${qid(21)},'2026-10-02',100,1,1,'2000-01-01');`);
const stamp=await db.query(`select updated_at from public.gi_entries where id=${qid(31)}`); assert.ok(new Date(stamp.rows[0].updated_at).getUTCFullYear()>2000); checks++;
await db.exec(`update public.gi_entries set cents=200 where id=${qid(31)}`);
await denied(`update public.gi_entries set store_id=${qid(12)},seller_id=${qid(23)} where id=${qid(31)}`);
await unchanged(`update public.gi_entries set cents=1 where store_id=${qid(12)}`);
await unchanged(`delete from public.gi_entries where store_id=${qid(12)}`);
await denied(`insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values (${qid(12)},${qid(23)},'2026-10-02',100,1,1)`);
await denied(`insert into public.gi_stores(name) values ('Unauthorized')`);
await denied(`insert into public.gi_sellers(store_id,name) values (${qid(11)},'Unauthorized')`);
await db.exec(`delete from public.gi_entries where id=${qid(31)}`); await count('gi_entries',2);
await db.exec(`update public.gi_store_goals set cents=120000; update public.gi_seller_goals set cents=60000`);
await denied(`insert into public.gi_store_goals(store_id,month,cents) values (${qid(12)},'2026-11-01',1000)`);
await denied(`insert into public.gi_seller_goals(store_id,seller_id,month,cents) values (${qid(12)},${qid(23)},'2026-11-01',1000)`);
await denied(`insert into public.gi_audit(table_name,record_id,operation) values ('fake',${qid(31)},'INSERT')`);
await denied('delete from public.gi_audit');
await as(1); await count('gi_entries',3); await count('gi_sellers',3); await count('gi_profiles',4);
const audit=await db.query(`select * from public.gi_audit where record_id=${qid(31)} order by occurred_at`);
assert.deepEqual(audit.rows.map(r=>r.operation),['INSERT','UPDATE','DELETE']);
assert.ok(audit.rows.every(r=>r.actor_id===id(2))); checks++;
await denied(`insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values (${qid(11)},${qid(23)},'2026-10-02',100,1,1)`,'P0001');
await denied(`insert into public.gi_store_goals(store_id,month,cents) values (${qid(11)},'2026-10-02',1000)`,'23514');
await denied(`insert into public.gi_store_goals(store_id,month,cents) values (${qid(11)},'2026-10-01',1000)`,'23505');
await denied(`insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values (${qid(11)},${qid(21)},'2026-10-02',100,0,1)`,'23514');
await db.exec(`update public.gi_profiles set active=false where id=${qid(3)}`);
await as(3); await count('gi_entries',0); await count('gi_sellers',0); await count('gi_profiles',0);
await as(1); await db.exec(`update public.gi_profiles set active=true where id=${qid(3)}; update public.gi_sellers set active=false where id=${qid(21)}`);
await as(3); await count('gi_entries',0); await count('gi_stores',0);
await as(2); await denied(`insert into public.gi_entries(store_id,seller_id,date,cents,orders,pieces) values (${qid(11)},${qid(21)},'2026-10-02',100,1,1)`,'P0001');
await as(1); await db.exec(`update public.gi_stores set active=false where id=${qid(11)}`);
await as(2); await count('gi_entries',0); await count('gi_stores',0);
await as(1); await count('gi_entries',3);
await denied(`update public.gi_sellers set store_id=${qid(12)} where id=${qid(21)}`,'P0001');
await denied('delete from public.gi_profiles');
await db.close();
console.log(`Database: ${checks} checks passed (PostgreSQL/PGlite, isolated auth fixtures).`);

