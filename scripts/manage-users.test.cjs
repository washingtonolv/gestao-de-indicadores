const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const uuid='00000000-0000-4000-8000-000000000001';
let scenario={},creates=0,inserted=null,cleanups=0;
const caller={auth:{getUser:async()=>scenario.unauth?{error:{}}:{data:{user:{id:uuid}}}},from:table=>{
 let field;const query={select(){return this;},eq(k){field=k;return this;},async maybeSingle(){
  if(table==='gi_profiles')return {data:field==='seller_id'?scenario.existing?{id:uuid}:null:{id:uuid,role:scenario.role||'admin',active:!scenario.blocked}};
  if(table==='gi_stores')return {data:{id:uuid,active:!scenario.archived}};
  return {data:{id:uuid,store_id:scenario.wrongStore?'other':uuid,active:true}};
 },async insert(row){inserted=row;return scenario.insertFail?{error:{}}:{};}};return query;
}};
const service={auth:{admin:{createUser:async body=>{creates++;assert.equal(body.email_confirm,true);assert.ok(body.password);return scenario.duplicate?{error:{}}:{data:{user:{id:uuid}}};},deleteUser:async()=>{cleanups++;return {};}}}};
const source=fs.readFileSync('supabase/functions/manage-users/index.ts','utf8').replace(/^import .*;\s*/,'').replaceAll('export ','').replace('Deno.serve(handler);','');
const ctx=vm.createContext({Request,Response,Set,Error,JSON,Deno:{env:{get:key=>key}},createClient:(url,key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?service:caller});vm.runInContext(source,ctx);
const password='test-only-not-a-real-password';
const base={name:'Conta de teste',email:'admin@example.test',password,role:'admin'};
async function call(body=base,settings={}){scenario=settings;creates=0;inserted=null;cleanups=0;return ctx.handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://washingtonolv.github.io',authorization:'Bearer test'},body:JSON.stringify(body)}));}
(async()=>{
 for(const role of ['manager','seller']){assert.equal((await call(base,{role})).status,403);assert.equal(creates,0);}
 assert.equal((await call(base,{blocked:true})).status,403);assert.equal(creates,0);
 assert.equal((await call(base,{unauth:true})).status,401);
 assert.equal((await call({...base,password:'short'})).status,400);assert.equal(creates,0);
 for(const length of [0,7,129]){assert.equal((await call({...base,password:'x'.repeat(length)})).status,400);assert.equal(creates,0);}
 for(const length of [8,11,12,128]){assert.equal((await call({...base,password:'x'.repeat(length)})).status,201);assert.equal(creates,1);}
 assert.match(fs.readFileSync('beta/admin.html','utf8'),/id="admin-password"[^>]*minlength="8"/);
 assert.equal((await call(base)).status,201);assert.equal(inserted.login_name,base.email);assert.equal(inserted.role,'admin');assert.ok(!('password'in inserted));
 const seller={...base,email:'',username:'Ana.Silva',role:'seller',storeId:uuid,sellerId:uuid};
 assert.equal((await call(seller)).status,201);assert.equal(inserted.login_name,'ana.silva');assert.equal(inserted.store_id,uuid);
 assert.equal((await call({...seller,username:'a@b.com'})).status,400);
 assert.equal((await call(seller,{wrongStore:true})).status,400);assert.equal(creates,0);
 assert.equal((await call(seller,{existing:true})).status,409);assert.equal(creates,0);
 assert.equal((await call(seller,{archived:true})).status,400);assert.equal(creates,0);
 assert.equal((await call(base,{insertFail:true})).status,409);assert.equal(cleanups,1);
 assert.equal((await call(base,{duplicate:true})).status,400);assert.equal(inserted,null);
 assert.equal((await ctx.handler(new Request('https://example.test',{method:'POST'}))).status,401);
 assert.equal((await ctx.handler(new Request('https://example.test',{method:'OPTIONS',headers:{origin:'https://evil.test'}}))).status,403);
 console.log('Account function: authorization, username/email rules, active links, duplicate and rollback checks passed. No real accounts created.');
})().catch(e=>{console.error(e);process.exitCode=1;});
