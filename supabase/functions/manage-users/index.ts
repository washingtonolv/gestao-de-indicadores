import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const origins = new Set(['https://washingtonolv.github.io', 'http://127.0.0.1:8766']);
export function validateAccount(body) {
 const name=typeof body?.name==='string'?body.name.trim():'';
 const suppliedEmail=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
 const password=body?.password;
 const role=body?.role;
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 if(!name||name.length>80||/[\u0000-\u001f]/.test(name))throw Error('Informe um nome com até 80 caracteres.');
 if(role==='admin'&&(suppliedEmail.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)||suppliedEmail.endsWith('@usuarios.gi.invalid')))throw Error('Informe um e-mail válido para o administrador.');
 if(role!=='admin'&&!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))throw Error('Use um login de 3 a 40 caracteres: letras sem acentos, números, ponto, hífen ou sublinhado.');
 const email=role==='admin'?suppliedEmail:username+'@usuarios.gi.invalid';
 const loginName=role==='admin'?suppliedEmail:username;
 if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Use uma senha de 8 a 128 caracteres.');
 if(!['admin','manager','seller'].includes(role))throw Error('Perfil inválido.');
 const storeId=role==='admin'?null:body.storeId;
 const sellerId=role==='seller'?body.sellerId:null;
 if(role!=='admin'&&!uuid(storeId))throw Error('Selecione a loja do usuário.');
 if(role==='seller'&&!uuid(sellerId))throw Error('Selecione o cadastro do vendedor.');
 return {name,email,loginName,password,role,storeId,sellerId};
}

export async function handler(req) {
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store',
  'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://washingtonolv.github.io',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Origem não permitida.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método não permitido.'});
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply(401,{error:'Entre novamente no painel.'});
 try {
  const url=Deno.env.get('SUPABASE_URL');
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await caller.auth.getUser(authorization.slice(7));
  if(identityError||!identity?.user)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  const {data:actor,error:actorError}=await caller.from('gi_profiles').select('id,role,active').eq('id',identity.user.id).maybeSingle();
  if(actorError||!actor?.active||actor.role!=='admin')return reply(403,{error:'Somente administradores podem cadastrar usuários.'});
  const text=await req.text();if(text.length>4096)return reply(413,{error:'Cadastro excede o limite permitido.'});
  let account;try{account=validateAccount(JSON.parse(text));}catch(e){return reply(400,{error:e instanceof SyntaxError?'Cadastro inválido.':e.message});}
  if(account.storeId){
   const {data:store,error}=await caller.from('gi_stores').select('id,active').eq('id',account.storeId).maybeSingle();
   if(error||!store?.active)return reply(400,{error:'Selecione uma loja ativa.'});
  }
  if(account.sellerId){
   const {data:seller,error}=await caller.from('gi_sellers').select('id,store_id,active').eq('id',account.sellerId).maybeSingle();
   if(error||!seller?.active||seller.store_id!==account.storeId)return reply(400,{error:'Vendedor não pertence à loja selecionada ou está arquivado.'});
   const {data:existing,error:lookupError}=await caller.from('gi_profiles').select('id').eq('seller_id',account.sellerId).maybeSingle();
   if(lookupError)return reply(500,{error:'Não foi possível verificar o vínculo do vendedor.'});
   if(existing)return reply(409,{error:'Este vendedor já possui uma conta vinculada.'});
  }
  // The privileged key stays exclusively in the Edge Function environment.
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:created,error:createError}=await service.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{name:account.name}});
  account.password='';
  if(createError||!created?.user)return reply(400,{error:'Não foi possível criar a conta. Verifique se o e-mail ou login já está cadastrado e se a senha atende aos requisitos.'});
  // Insert with the administrator's JWT: RLS is checked again and audit records the actor.
  const {error:profileError}=await caller.from('gi_profiles').insert({id:created.user.id,name:account.name,login_name:account.loginName,role:account.role,store_id:account.storeId,seller_id:account.sellerId,active:true});
  if(profileError){
   const {error:cleanupError}=await service.auth.admin.deleteUser(created.user.id);
   return reply(409,{error:cleanupError?'A conta ficou sem acesso ao painel. Contate o proprietário para revisar o cadastro no Supabase.':'Não foi possível vincular o perfil. Confira a loja e o vendedor antes de tentar novamente.'});
  }
  return reply(201,{id:created.user.id,name:account.name,role:account.role});
 }catch{return reply(500,{error:'Não foi possível concluir o cadastro. Consulte a lista de usuários antes de tentar novamente.'});}
}

Deno.serve(handler);
