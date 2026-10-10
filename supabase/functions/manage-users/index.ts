import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const origins = new Set(['https://washingtonolv.github.io', 'http://127.0.0.1:8766']);
export const GENERAL_ADMIN_ID='828cf271-af97-4d61-a1e3-5a89dd93a78c';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function validatePassword(password){if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Use uma senha de 8 a 128 caracteres.');}
export function validateAccount(body,editing=false) {
 const name=typeof body?.name==='string'?body.name.trim():'';
 const suppliedEmail=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
 const password=body?.password;
 const role=body?.role;
 if(!name||name.length>80||/[\u0000-\u001f]/.test(name))throw Error('Informe um nome com até 80 caracteres.');
 if(role==='admin'&&(suppliedEmail.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)||suppliedEmail.endsWith('@usuarios.gi.invalid')))throw Error('Informe um e-mail válido para o administrador.');
 if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))throw Error('Use um login de 3 a 40 caracteres: letras sem acentos, números, ponto, hífen ou sublinhado.');
 const email=role==='admin'?suppliedEmail:username+'@usuarios.gi.invalid';
 const loginName=username;
 if(!editing)validatePassword(password);
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
 const text=await req.text();if(text.length>4096)return reply(413,{error:'Requisição excede o limite permitido.'});
 let body;try{body=JSON.parse(text);}catch{return reply(400,{error:'Requisição inválida.'});}
 if(body?.action==='login'){
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)||typeof body.password!=='string'||body.password.length>128)return reply(401,{error:'Login ou senha inválidos.'});
  try{
   const url=Deno.env.get('SUPABASE_URL');
   const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:profile,error:lookupError}=await service.from('gi_profiles').select('id,active').eq('login_name',username).maybeSingle();
   if(lookupError)return reply(401,{error:'Login ou senha inválidos.'});
   let email='unknown-login@usuarios.gi.invalid';
   if(profile?.active){const {data}=await service.auth.admin.getUserById(profile.id);email=data?.user?.email||email;}
   const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await auth.auth.signInWithPassword({email,password:body.password});
   if(error||!profile?.active||!data?.session||data.user?.id!==profile.id)return reply(401,{error:'Login ou senha inválidos.'});
   return reply(200,{access_token:data.session.access_token,refresh_token:data.session.refresh_token});
  }catch{return reply(401,{error:'Login ou senha inválidos.'});}
 }
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer '))return reply(401,{error:'Entre novamente no painel.'});
 try {
  const url=Deno.env.get('SUPABASE_URL');
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY'),{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await caller.auth.getUser(authorization.slice(7));
  if(identityError||!identity?.user)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  const {data:actor,error:actorError}=await caller.from('gi_profiles').select('id,role,active').eq('id',identity.user.id).maybeSingle();
  if(actorError||!actor?.active||actor.role!=='admin')return reply(403,{error:'Somente administradores podem gerenciar usuários.'});
  const action=body.action||'create';
  if(!['create','update','delete','password'].includes(action))return reply(400,{error:'Operação inválida.'});
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  let target=null;
  if(action!=='create'){
   if(!uuid(body.id)||typeof body.expected!=='string')return reply(400,{error:'Selecione uma conta e atualize a lista.'});
   const {data,error}=await caller.from('gi_profiles').select('*').eq('id',body.id).maybeSingle();
   if(error)return reply(500,{error:'Não foi possível consultar a conta.'});
   if(!data)return reply(404,{error:'Conta não encontrada. Atualize a lista.'});
   target=data;
   if(target.id===GENERAL_ADMIN_ID&&(action==='delete'||actor.id!==GENERAL_ADMIN_ID))return reply(403,{error:'Esta conta é do administrador geral e está protegida.'});
   if(action==='delete'&&target.id===actor.id)return reply(400,{error:'Você não pode excluir a conta que está usando.'});
   if(target.updated_at!==body.expected)return reply(409,{error:'Esta conta foi alterada. Atualize a lista antes de continuar.'});
  }
  // Passwords never enter profile rows or audit payloads.
  const audit=async operation=>{const {error}=await service.from('gi_audit').insert({actor_id:actor.id,table_name:'gi_account_access',record_id:target.id,operation,after_data:{action}});return error?'A operação foi concluída, mas seu registro no histórico não foi confirmado.':null;};
  if(action==='password'){
   try{validatePassword(body.password);}catch(e){return reply(400,{error:e.message});}
   const {error}=await service.auth.admin.updateUserById(target.id,{password:body.password});
   body.password='';
   if(error)return reply(400,{error:'Não foi possível alterar a senha. Confira os requisitos e tente novamente.'});
   return reply(200,{id:target.id,warning:await audit('UPDATE')});
  }
  if(action==='delete'){
   const {error}=await service.auth.admin.deleteUser(target.id);
   if(error)return reply(409,{error:'Não foi possível excluir a conta. Os dados foram preservados; atualize a lista.'});
   return reply(200,{id:target.id,warning:await audit('DELETE')});
  }
  let previousAuth=null;
  if(action==='update'){
   const {data,error}=await service.auth.admin.getUserById(target.id);
   if(error||!data?.user)return reply(404,{error:'Conta de acesso não encontrada.'});
   previousAuth=data.user;
  }
  let account;try{account=validateAccount({...body,email:body.email||previousAuth?.email},action==='update');}catch(e){return reply(400,{error:e.message});}
  if(target?.id===GENERAL_ADMIN_ID&&(account.role!=='admin'||account.loginName!==target.login_name))return reply(403,{error:'O login e os privilégios do administrador geral são permanentes.'});
  if(target?.id===actor.id&&account.role!=='admin')return reply(400,{error:'Você não pode retirar seu próprio acesso administrativo.'});
  const {data:loginMatch,error:loginError}=await caller.from('gi_profiles').select('id').eq('login_name',account.loginName).maybeSingle();
  if(loginError)return reply(500,{error:'Não foi possível verificar o login.'});
  if(loginMatch&&loginMatch.id!==target?.id)return reply(409,{error:'Este nome de usuário já está cadastrado.'});
  if(account.storeId){
   const {data:store,error}=await caller.from('gi_stores').select('id,active').eq('id',account.storeId).maybeSingle();
   if(error||!store?.active)return reply(400,{error:'Selecione uma loja ativa.'});
  }
  if(account.sellerId){
   const {data:seller,error}=await caller.from('gi_sellers').select('id,store_id,active').eq('id',account.sellerId).maybeSingle();
   if(error||!seller?.active||seller.store_id!==account.storeId)return reply(400,{error:'Vendedor não pertence à loja selecionada ou está arquivado.'});
   const {data:existing,error:lookupError}=await caller.from('gi_profiles').select('id').eq('seller_id',account.sellerId).maybeSingle();
   if(lookupError)return reply(500,{error:'Não foi possível verificar o vínculo do vendedor.'});
   if(existing&&existing.id!==target?.id)return reply(409,{error:'Este vendedor já possui uma conta vinculada.'});
  }
  // The privileged key stays exclusively in the Edge Function environment.
  if(action==='update'){
   const {error:authError}=await service.auth.admin.updateUserById(target.id,{email:account.email,email_confirm:true,user_metadata:{...previousAuth.user_metadata,name:account.name}});
   if(authError)return reply(409,{error:'Não foi possível atualizar o acesso. Confira se o e-mail ou login já está em uso.'});
   const {data:updated,error:profileError}=await caller.from('gi_profiles').update({name:account.name,login_name:account.loginName,role:account.role,store_id:account.storeId,seller_id:account.sellerId}).eq('id',target.id).eq('updated_at',body.expected).select('id').maybeSingle();
   if(profileError||!updated){
    const {error:rollbackError}=await service.auth.admin.updateUserById(target.id,{email:previousAuth.email,email_confirm:true,user_metadata:previousAuth.user_metadata||{}});
    return reply(409,{error:rollbackError?'Não foi possível confirmar a edição. O proprietário deve revisar o acesso desta conta no Supabase.':'A edição não foi aplicada. Atualize a lista e confira os vínculos antes de tentar novamente.'});
   }
   return reply(200,{id:target.id});
  }
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
