let cloudProfile=null,cloudProfiles=[];
function acceptCloud(result){db=validateDB(result.data);revision=result.revision;cloudProfile=result.profile;cloudProfiles=result.profiles||[];}
function renderCloudProfiles(){
 $('#admin-form').hidden=false;$('#admin-permissions').hidden=false;adminOptions();adminFields();
 $('#admin-list-title').textContent='Contas com acesso ao painel';
 $('#admin-list-help').textContent='Cadastre uma conta usando o formulário. Senhas são protegidas pelo serviço de autenticação e não podem ser consultadas.';
 all('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab==='users')));
 const search=$('#admin-search').value.trim().toLowerCase();
 $('#admin-list').innerHTML=cloudProfiles.filter(p=>(p.name+' '+(p.login||'')).toLowerCase().includes(search)).map(p=>`<div class="admin-row"><div><strong>${esc(p.name)}</strong><small>${esc(roleLabels[p.role])} · ${esc(p.login||'Login cadastrado')} · ${p.active?'Ativo':'Bloqueado'}</small></div></div>`).join('')||'<p>Nenhuma conta acessível.</p>';
}
function renderGreeting(){
 if(!cloudProfile||!['dashboard','evolution'].includes(view))return;
 const hour=new Date().getHours(),greeting=hour>=5&&hour<12?'Bom dia':hour>=12&&hour<18?'Boa tarde':'Boa noite';
 const name=typeof cloudProfile.name==='string'?cloudProfile.name.trim():'';
 $('#page-title').textContent=name?`${greeting}, ${name}!`:`${greeting}!`;
}
setInterval(renderGreeting,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderGreeting();});
function renderCloudUI(){
 $('#storage-status').textContent=demo?'Exemplo · não salvo':ready?'Dados do Supabase':'Conectando…';
 $('#footer-mode').textContent=demo?'Dados fictícios · modo de exemplo':'Beta online · salvamento no Supabase';
 if(!$('#saved-at').textContent.startsWith('Confirmado'))$('#saved-at').textContent=ready?'Dados carregados da nuvem':'Aguardando conexão';
 $('#restore-file').disabled=true;$('#restore-file').closest('label').hidden=true;$('#restore-preview').hidden=true;
 if(!cloudProfile)return;
 const seller=cloudProfile.role==='seller';
 for(const b of all('[data-view]'))b.hidden=(seller&&!['evolution','backup'].includes(b.dataset.view))||(cloudProfile.role!=='admin'&&b.dataset.view==='admin');
 $('#new-entry').hidden=seller||['evolution','admin'].includes(view);$('#demo').hidden=seller;
 if(seller){$('#evo-mode').value='individual';$('#evo-mode').disabled=true;$('#evo-seller').value=cloudProfile.sellerId;$('#evo-seller').disabled=true;renderEvolution();}
 renderGreeting();
 const counts=all('#admin-counts strong');if(counts[2])counts[2].textContent=cloudProfiles.length;
 if(cloudProfile.role==='manager')$('#entry-store').value=db.admin.stores.find(s=>s.id===cloudProfile.storeId)?.name||'';
}

async function createCloudAccount(){
 $('#admin-error').textContent='';if(busy)return;
 if(cloudProfile?.role!=='admin'){$('#admin-error').textContent='Somente administradores podem cadastrar usuários.';return;}
 const payload={name:normal($('#admin-name').value),email:$('#admin-email').value.trim(),username:$('#admin-username').value.trim(),password:$('#admin-password').value,role:$('#admin-role').value,storeId:$('#admin-store').value,sellerId:$('#admin-seller').value};
 const button=$('#admin-form button[type=submit]');busy=true;button.disabled=true;
 try{const response=await request('create-account',payload);acceptCloud(response);resetAdmin();render();$('#admin-feedback').textContent='Conta criada. O usuário já pode entrar com as credenciais cadastradas.';}
 catch(e){$('#admin-error').textContent=e.message;}
 finally{$('#admin-password').value='';payload.password='';busy=false;button.disabled=false;}
}
