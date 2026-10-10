const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const uuid='00000000-0000-4000-8000-000000000001';
const targetId='00000000-0000-4000-8000-000000000002',ownerId='828cf271-af97-4d61-a1e3-5a89dd93a78c',stamp='2026-10-10T12:00:00+00:00';
let scenario={},creates=0,inserted=null,cleanups=0,updates=[],profileUpdate=null,audits=[];
const caller={auth:{signInWithPassword:async()=>scenario.badPassword?{error:{}}:{data:{user:{id:uuid},session:{access_token:'test-access',refresh_token:'test-refresh'}}},getUser:async()=>scenario.unauth?{error:{}}:{data:{user:{id:uuid}}}},from:table=>{
 let field,fields={},updating=false;const query={select(){return this;},eq(k,v){field=k;fields[k]=v;return this;},update(row){profileUpdate=row;updating=true;return this;},async maybeSingle(){
  if(updating)return scenario.updateFail?{error:{}}:{data:{id:fields.id}};
  if(table==='gi_profiles'){
   if(field==='seller_id')return {data:scenario.existing?{id:scenario.existing}:null};
   if(field==='login_name')return {data:scenario.loginDuplicate?{id:uuid}:null};
   if(fields.id===(scenario.actorOwner?ownerId:uuid))return {data:{id:fields.id,role:scenario.role||'admin',active:!scenario.blocked,updated_at:stamp,login_name:fields.id===ownerId?'washingtonolv':'admin.test'}};
   return {data:scenario.missing?null:{id:fields.id,name:'Target',role:'admin',login_name:fields.id===ownerId?'washingtonolv':'target',updated_at:stamp,active:true}};
  }
  if(table==='gi_stores')return {data:{id:uuid,active:!scenario.archived}};
  return {data:{id:uuid,store_id:scenario.wrongStore?'other':uuid,active:true}};
 },async insert(row){inserted=row;return scenario.insertFail?{error:{}}:{};}};return query;
}};
const service={from:()=>({select(){return this;},eq(){return this;},async insert(row){audits.push(row);return scenario.auditFail?{error:{}}:{};},async maybeSingle(){return {data:scenario.unknown?null:{id:uuid,active:!scenario.blocked}};}}),auth:{signInWithPassword:async()=>({}),admin:{getUserById:async()=>({data:{user:{id:uuid,email:"admin@example.test",user_metadata:{name:'Old'}}}}),updateUserById:async(id,body)=>{updates.push({id,body});return scenario.authUpdateFail?{error:{}}:{};},createUser:async body=>{creates++;assert.equal(body.email_confirm,true);assert.ok(body.password);return scenario.duplicate?{error:{}}:{data:{user:{id:uuid}}};},deleteUser:async()=>{cleanups++;return scenario.deleteFail?{error:{}}:{};}}}};
const source=fs.readFileSync('supabase/functions/manage-users/index.ts','utf8').replace(/^import .*;\s*/,'').replaceAll('export ','').replace('Deno.serve(handler);','');
const ctx=vm.createContext({Request,Response,Set,Error,JSON,Deno:{env:{get:key=>key}},createClient:(url,key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?service:caller});vm.runInContext(source,ctx);
const password='test-only-not-a-real-password';
const base={name:'Conta de teste',email:'admin@example.test',username:'admin.test',password,role:'admin'};
async function call(body=base,settings={}){scenario=settings;creates=0;inserted=null;cleanups=0;updates=[];profileUpdate=null;audits=[];caller.auth.getUser=async()=>scenario.unauth?{error:{}}:{data:{user:{id:scenario.actorOwner?ownerId:uuid}}};return ctx.handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://washingtonolv.github.io',authorization:'Bearer test'},body:JSON.stringify(body)}));}
(async()=>{
 for(const role of ['manager','seller']){assert.equal((await call(base,{role})).status,403);assert.equal(creates,0);}
 assert.equal((await call(base,{blocked:true})).status,403);assert.equal(creates,0);
 assert.equal((await call(base,{unauth:true})).status,401);
 assert.equal((await call({...base,password:'short'})).status,400);assert.equal(creates,0);
 for(const length of [0,7,129]){assert.equal((await call({...base,password:'x'.repeat(length)})).status,400);assert.equal(creates,0);}
 for(const length of [8,11,12,128]){assert.equal((await call({...base,password:'x'.repeat(length)})).status,201);assert.equal(creates,1);}
 assert.match(fs.readFileSync('beta/admin.html','utf8'),/id="admin-password"[^>]*minlength="8"/);
 assert.equal((await call(base)).status,201);assert.equal(inserted.login_name,base.username);assert.equal(inserted.role,'admin');assert.ok(!('password'in inserted));
 const seller={...base,email:'',username:'Ana.Silva',role:'seller',storeId:uuid,sellerId:uuid};
 assert.equal((await call(seller)).status,201);assert.equal(inserted.login_name,'ana.silva');assert.equal(inserted.store_id,uuid);
 assert.equal((await call({...seller,username:'a@b.com'})).status,400);
 assert.equal((await call(seller,{wrongStore:true})).status,400);assert.equal(creates,0);
 assert.equal((await call(seller,{existing:uuid})).status,409);assert.equal(creates,0);
 assert.equal((await call(seller,{archived:true})).status,400);assert.equal(creates,0);
 assert.equal((await call(base,{insertFail:true})).status,409);assert.equal(cleanups,1);
 assert.equal((await call(base,{duplicate:true})).status,400);assert.equal(inserted,null);
 assert.equal((await ctx.handler(new Request('https://example.test',{method:'POST'}))).status,400);
 assert.equal((await ctx.handler(new Request('https://example.test',{method:'OPTIONS',headers:{origin:'https://evil.test'}}))).status,403);
 for(const settings of [{},{unknown:true},{blocked:true},{badPassword:true}]){const res=await call({action:'login',username:'admin.test',password},settings);assert.equal(res.status,Object.keys(settings).length?401:200);const body=await res.json();assert.ok(!('email' in body));}
 const edit={...base,action:'update',id:targetId,expected:stamp,email:'',password:undefined};
 assert.equal((await call(edit)).status,200);assert.equal(updates[0].body.email,'admin@example.test');assert.equal(profileUpdate.login_name,'admin.test');assert.ok(!('password' in profileUpdate));
 assert.equal((await call(edit,{updateFail:true})).status,409);assert.equal(updates.length,2);assert.equal(updates[1].body.user_metadata.name,'Old');
 assert.equal((await call(edit,{authUpdateFail:true})).status,409);assert.equal(profileUpdate,null);
 assert.equal((await call(edit,{loginDuplicate:true})).status,409);assert.equal(updates.length,0);
 assert.equal((await call({...edit,expected:'stale'})).status,409);assert.equal(updates.length,0);
 assert.equal((await call(edit,{missing:true})).status,404);
 for(const action of ['update','delete','password']){
  const body={...edit,id:ownerId,action,password:'12345678',username:'washingtonolv'};
  assert.equal((await call(body)).status,403);assert.equal(updates.length+cleanups,0);
 }
 assert.equal((await call({...edit,id:ownerId,username:'washingtonolv'},{actorOwner:true})).status,200);
 assert.equal((await call({...edit,id:ownerId,username:'changed'},{actorOwner:true})).status,403);
 assert.equal((await call({...edit,id:ownerId,role:'manager',storeId:uuid},{actorOwner:true})).status,403);
 const pw={action:'password',id:targetId,expected:stamp,password:'12345678'};
 assert.equal((await call(pw)).status,200);assert.equal(updates[0].body.password,'12345678');assert.equal(audits[0].actor_id,uuid);assert.ok(!JSON.stringify(audits).includes('12345678'));
 assert.equal((await call({...pw,password:'1234567'})).status,400);assert.equal(updates.length,0);
 assert.equal((await call({...pw,id:ownerId},{actorOwner:true})).status,200);
 assert.equal((await call({...pw},{authUpdateFail:true})).status,400);
 for(const role of ['manager','seller']){assert.equal((await call(pw,{role})).status,403);assert.equal(updates.length,0);}
 assert.equal((await call({...pw,action:'delete'})).status,200);assert.equal(cleanups,1);
 assert.equal((await call({...pw,action:'delete'},{deleteFail:true})).status,409);
 assert.equal((await call({...pw,action:'delete',id:ownerId},{actorOwner:true})).status,403);assert.equal(cleanups,0);
 assert.equal((await call({...pw,action:'delete',id:uuid})).status,400);assert.equal(cleanups,0);
 assert.equal((await call({...edit,id:uuid,role:'manager',storeId:uuid})).status,400);
 assert.equal((await call({...pw,action:'other'})).status,400);
 assert.equal((await call({...pw,id:'invalid'})).status,400);
 console.log('Account function: create/edit/delete/password, authorization, owner protection, stale edits, password secrecy and rollback checks passed. No real accounts changed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
