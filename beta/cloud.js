import {createClient} from '@supabase/supabase-js';
import {tables,toLocal,changesFor} from './cloud-model.js';
const client=createClient('https://wyvtuvmsgncllwxxotjp.supabase.co','sb_publishable_DoCvT-BGsojQyt8giUy_Ow_m4vou2II',{
 auth:{storage:sessionStorage,storageKey:'gi-cloud-session-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
 global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}
});
const frame=document.getElementById('codex-visualization');
frame.style.display='none';
const style=document.createElement('style');style.textContent=`
#cloud-login{font:16px system-ui;color:#171717;max-width:420px;margin:8vh auto;padding:32px;background:linear-gradient(140deg,#fff,#fff9f5);border:1px solid #dedede;border-radius:24px;box-shadow:0 16px 60px #1717170b}
#cloud-login h1{font-size:26px;margin:12px 0}#cloud-login p{line-height:1.6}#cloud-login label{display:grid;gap:8px;margin:18px 0}#cloud-login input{min-width:0;padding:14px;border:1px solid #888;border-radius:10px;font:inherit;background:#fff;color:#171717}
#cloud-login button,#cloud-bar button{font:inherit;padding:12px 16px;border:1px solid #bbb;border-radius:10px;background:#fff;color:#171717;cursor:pointer;min-height:44px}#cloud-login button[type=submit]{background:#FF5E2C;border-color:#FF5E2C;font-weight:650;width:100%}#cloud-login button:disabled{opacity:.6;cursor:wait}#cloud-error{color:#a40000;min-height:24px}#cloud-bar{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;max-width:1680px;margin:0 auto 8px;font:14px system-ui;color:#171717}#cloud-bar span{margin-right:auto}#cloud-local{margin-top:12px}#cloud-login [hidden],#cloud-bar[hidden]{display:none!important}@media(max-width:500px){#cloud-login{margin:24px 12px;padding:22px}#cloud-bar{padding:8px;font-size:12px}}
` + `@media(max-width:760px),(max-width:1000px) and (max-height:500px){#codex-visualization{height:calc(100dvh - var(--gi-bar-height,0px))!important;min-height:calc(100dvh - var(--gi-bar-height,0px))!important}}`;document.head.append(style);
const login=document.createElement('section');login.id='cloud-login';login.innerHTML=`<b>gi · Gestão de indicadores</b><h1>Entre no seu painel</h1><p>Acompanhe os dados da sua operação em qualquer dispositivo.</p><form id="cloud-form"><label>E-mail ou usuário<input id="cloud-email" type="text" autocomplete="username" required></label><label>Senha<input id="cloud-password" type="password" autocomplete="current-password" required minlength="6"></label><button type="submit">Entrar</button></form><p id="cloud-error" role="alert"></p><button id="cloud-retry" hidden>Tentar novamente</button><button id="cloud-exit" hidden>Sair da conta</button><p><small>Use uma conta cadastrada pelo administrador. A sessão permanece somente nesta aba.</small></p><button id="cloud-local" hidden>Baixar meus dados da beta local</button>`;
document.body.prepend(login);
const bar=document.createElement('div');bar.id='cloud-bar';bar.hidden=true;bar.innerHTML='<span id="cloud-identity"></span><button id="cloud-refresh">Atualizar dados</button><button id="cloud-logout">Sair</button>';login.after(bar);new ResizeObserver(()=>document.documentElement.style.setProperty('--gi-bar-height',(bar.hidden?0:bar.getBoundingClientRect().height+8)+'px')).observe(bar);
const loginEmail=value=>{const login=value.trim().toLowerCase();return login.includes('@')?login:login+'@usuarios.gi.invalid';};
const el=id=>document.getElementById(id);
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
try{el('cloud-local').hidden=!localStorage.getItem('gestao-indicadores:beta:v1');}catch{}
el('cloud-local').onclick=()=>{try{const old=JSON.parse(localStorage.getItem('gestao-indicadores:beta:v1'));download(old.data,'gestao-backup-local.json');}catch{el('cloud-error').textContent='Não foi possível ler os dados locais.';}};
let session=null,profile=null,base=null,revision=0,saving=false,loadedProfiles=[];
function fail(message){frame.style.display='none';bar.hidden=true;login.hidden=false;el('cloud-error').textContent=message;el('cloud-form').hidden=!!session;el('cloud-exit').hidden=!session;el('cloud-retry').hidden=!session;}
function errorMessage(e){if(e?.code==='40001')return 'Outra pessoa alterou este registro. Use Atualizar dados antes de salvar novamente.';if(e?.code==='23505')return 'Já existe um cadastro ou meta com esses dados.';if(e?.code==='42501')return 'Seu perfil não permite esta operação.';return 'Não foi possível confirmar a operação. Confira a conexão e atualize os dados antes de tentar novamente.';}
async function rows(table){let list=[];for(let offset=0;;offset+=500){const {data,error}=await client.from(table).select('*').order('id').range(offset,offset+499);if(error)throw error;list.push(...data);if(list.length>10000)throw Error('Limite de consulta atingido.');if(data.length<500)return list;}}
async function read(){
 const {data:auth,error}=await client.auth.getUser();if(error||!auth.user){fail('Entre novamente para continuar.');throw Error('Sessão encerrada.');}
 const {data:p,error:pe}=await client.from('gi_profiles').select('*').eq('id',auth.user.id).maybeSingle();if(pe)throw pe;
 if(!p?.active){fail('Esta conta ainda não tem acesso ativo. Contate o administrador.');throw Error('Conta sem acesso ativo.');}
 const result=await Promise.all(tables.map(async t=>[t,await rows(t)]));const next=Object.fromEntries(result);
 if(p.role!=='admin'&&!next.gi_stores.some(s=>s.id===p.store_id&&s.active)||p.role==='seller'&&!next.gi_sellers.some(s=>s.id===p.seller_id&&s.active)){fail('Seu vínculo com a loja ou vendedor está inativo. Contate o administrador.');throw Error('Vínculo inativo.');}
 const profiles=await rows('gi_profiles');
 const {data:audit,error:ae}=await client.from('gi_audit').select('id,actor_id,table_name,operation,occurred_at').order('occurred_at',{ascending:false}).limit(200);if(ae)throw ae;
 const data=toLocal(next);data.admin.audit=(audit||[]).reverse().map(r=>({id:r.id,at:r.occurred_at,actor:profiles.find(x=>x.id===r.actor_id)?.name||'Administração do banco',action:`${r.operation} · ${r.table_name}`}));
 base=next;profile=p;loadedProfiles=profiles;revision++;
 el('cloud-identity').textContent=`${p.name} · ${{admin:'Administrador',manager:'Gestor',seller:'Vendedor'}[p.role]}`;
 login.hidden=true;bar.hidden=false;frame.style.display='block';
 return {data,revision,cloud:true,profile:{id:p.id,name:p.name,role:p.role,sellerId:p.seller_id,storeId:p.store_id},profiles:loadedProfiles.map(({id,name,role,active,login_name})=>({id,name,role,active,login:login_name}))};
}
async function save(payload){
 if(saving)throw Error('Aguarde o salvamento.');if(!base||payload.revision!==revision)throw Error('Atualize os dados antes de salvar.');if(profile.role==='seller')throw Error('O vendedor tem acesso somente para consulta.');
 saving=true;try{if([...payload.data.admin.stores,...payload.data.admin.sellers].some(x=>x.id.startsWith('legacy-')))throw Error('Cadastre a loja e o vendedor em Admin antes de lançar resultados ou metas.');const changes=changesFor(payload.data,base);if(changes.length){const {error}=await client.rpc('gi_apply_changes',{changes});if(error)throw Error(errorMessage(error));}try{return await read();}catch{base=null;throw Error('A operação foi enviada, mas a leitura de confirmação falhou. Atualize os dados antes de tentar novamente.');}}finally{saving=false;}
}
el('cloud-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;el('cloud-error').textContent='Conectando…';try{const {error}=await client.auth.signInWithPassword({email:loginEmail(el('cloud-email').value),password:el('cloud-password').value});el('cloud-password').value='';if(error){el('cloud-error').textContent='Não foi possível entrar. Confira seu login e senha ou tente novamente mais tarde.';return;}location.reload();}catch{el('cloud-error').textContent='Não foi possível conectar. Verifique sua internet.';}finally{button.disabled=false;}};
const logout=async()=>{frame.style.display='none';await client.auth.signOut({scope:'local'});sessionStorage.removeItem('gi-cloud-session-v1');location.reload();};
el('cloud-logout').onclick=logout;el('cloud-exit').onclick=logout;el('cloud-refresh').onclick=()=>location.reload();el('cloud-retry').onclick=()=>location.reload();
const ready=client.auth.getSession().then(({data,error})=>{if(error)throw error;session=data.session;if(!session)fail('');return !!session;}).catch(()=>{fail('Não foi possível iniciar a sessão. Atualize a página.');return false;});
client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&session){session=null;base=null;fail('Sua sessão foi encerrada. Entre novamente.');}});
async function createAccount(payload){
 if(profile?.role!=='admin')throw Error('Somente administradores podem cadastrar usuários.');
 const {data,error}=await client.functions.invoke('manage-users',{body:payload});
 if(error){let message='Não foi possível confirmar o cadastro. Atualize a lista antes de tentar novamente.';try{const detail=await error.context.json();if(detail.error)message=detail.error;}catch{}throw Error(message);}
 if(!data?.id)throw Error('O servidor não confirmou o cadastro.');
 return await read();
}
window.GICloud={createAccount,ready,read:async()=>{try{return await read();}catch(e){fail(e.message||'Não foi possível carregar os dados. Tente novamente.');throw e;}},save,download};
