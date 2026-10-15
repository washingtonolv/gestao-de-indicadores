let cloudProfile=null,cloudProfiles=[];
const GENERAL_ADMIN_ID='828cf271-af97-4d61-a1e3-5a89dd93a78c';
function acceptCloud(result){db=validateDB(result.data);revision=result.revision;cloudProfile=result.profile;cloudProfiles=result.profiles||[];}
function renderCloudProfiles(){
 $('#admin-form').hidden=false;$('#admin-permissions').hidden=false;adminOptions();adminFields();
 $('#admin-list-title').textContent='Contas com acesso ao painel';
 $('#admin-list-help').textContent='Edite os dados, altere a senha ou exclua o acesso. Excluir uma conta preserva os vendedores e seus resultados. A conta do administrador geral é protegida.';
 all('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab==='users')));
 const search=$('#admin-search').value.trim().toLowerCase();
 $('#admin-list').innerHTML=cloudProfiles.filter(p=>(p.name+' '+(p.login||'')).toLowerCase().includes(search)).map(p=>{const owner=p.id===GENERAL_ADMIN_ID,locked=owner&&cloudProfile.id!==GENERAL_ADMIN_ID,self=p.id===cloudProfile.id;return `<div class="admin-row cloud-user-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.login||'Login cadastrado')}</small><span class="profile-role ${p.role==='admin'?'role-admin':''}">${esc(owner?'Administrador geral':roleLabels[p.role])}</span><span class="admin-status ${p.active?'':'inactive'}">${p.active?'Ativo':'Bloqueado'}</span></div><div class="actions">${locked?'<small>Conta protegida</small>':`<button type="button" data-cloud-edit="${p.id}" aria-label="Editar usuário ${esc(p.name)}">Editar</button><button type="button" data-cloud-password="${p.id}" aria-label="Alterar senha de ${esc(p.name)}">Alterar senha</button>${owner||self?'':`<button type="button" data-cloud-delete="${p.id}" class="admin-delete" aria-label="Excluir usuário ${esc(p.name)}">Excluir</button>`}`}</div></div>`;}).join('')||'<p>Nenhuma conta acessível.</p>';
}
async function handleCloudUserAction(button){
 const id=button.dataset.cloudEdit||button.dataset.cloudPassword||button.dataset.cloudDelete,p=cloudProfiles.find(p=>p.id===id);if(!p||busy||demo)return;
 if(p.id===GENERAL_ADMIN_ID&&cloudProfile.id!==GENERAL_ADMIN_ID)return;
 $('#admin-feedback').textContent='';
 if(button.dataset.cloudEdit){resetAdmin();$('#admin-id').value=p.id;$('#admin-name').value=p.name;$('#admin-username').value=p.login||'';$('#admin-role').value=p.role;$('#admin-store').value=p.storeId||'';adminOptions();$('#admin-seller').value=p.sellerId||'';adminFields();$('#admin-form-title').textContent='Editar usuário';$('#admin-cancel').hidden=false;redesignSync();$('#admin-form').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});$('#admin-name').focus({preventScroll:true});return;}
 if(button.dataset.cloudPassword){const dialog=$('#user-password-dialog');dialog.dataset.userId=p.id;dialog.dataset.expected=p.updatedAt;$('#user-password-form').reset();$('#user-password-error').textContent='';$('#user-password-name').textContent='Nova senha para '+p.name;dialog.showModal();return;}
 if(p.id===GENERAL_ADMIN_ID||p.id===cloudProfile.id)return;
 $('#confirm-text').textContent=`Excluir o acesso de ${p.name} (${p.login})? A pessoa deixará de entrar no painel. Os vendedores, metas e resultados serão preservados. Esta ação não pode ser desfeita.`;
 confirmAction=async()=>{if(busy)return;busy=true;button.disabled=true;try{const result=await request('create-account',{action:'delete',id:p.id,expected:p.updatedAt});acceptCloud(result);resetAdmin();render();$('#admin-feedback').textContent=result.warning||'Conta de acesso excluída. Resultados preservados.';}catch(e){$('#admin-feedback').textContent=e.message;}finally{busy=false;button.disabled=false;}};$('#confirm-dialog').showModal();
}
$('#user-password-cancel').onclick=()=>$('#user-password-dialog').close();
$('#user-password-dialog').addEventListener('close',()=>{$('#user-password-form').reset();delete $('#user-password-dialog').dataset.userId;delete $('#user-password-dialog').dataset.expected;});
async function changeCloudPassword(event){
 event.preventDefault();const form=$('#user-password-form');if(!form.reportValidity()||busy)return;
 if(demo){$('#user-password-error').textContent='Saia do exemplo para alterar contas.';return;}
 const dialog=$('#user-password-dialog'),password=$('#user-new-password').value;$('#user-password-error').textContent='';
 if(password!==$('#user-confirm-password').value){$('#user-password-error').textContent='As senhas não coincidem.';return;}
 const button=form.querySelector('button[type=submit]');busy=true;button.disabled=true;
 try{const result=await request('create-account',{action:'password',id:dialog.dataset.userId,expected:dialog.dataset.expected,password});acceptCloud(result);dialog.close();render();$('#admin-feedback').textContent=result.warning||'Senha alterada. Informe a nova senha diretamente ao usuário.';}
 catch(e){$('#user-password-error').textContent=e.message;}finally{busy=false;button.disabled=false;$('#user-new-password').value='';$('#user-confirm-password').value='';}
}
$('#user-password-form').onsubmit=changeCloudPassword;
$('#user-password-form button[type=submit]').onclick=changeCloudPassword;
$('#user-password-form').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT')changeCloudPassword(event);});
function renderGreeting(){
 if(!cloudProfile||!['dashboard','evolution'].includes(view))return;
 const hour=new Date().getHours(),greeting=hour>=5&&hour<12?'Bom dia':hour>=12&&hour<18?'Boa tarde':'Boa noite';
 const name=typeof cloudProfile.name==='string'?cloudProfile.name.trim():'';
 $('#page-title').textContent=name?`${greeting}, ${name}!`:`${greeting}!`;
}
setInterval(renderGreeting,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderGreeting();});
function renderCloudUI(){
 $('#storage-status').textContent=demo?'Exemplo · não salvo':ready?'Indicadores atualizados':'Carregando indicadores…';
 $('#footer-mode').textContent=demo?'Dados fictícios · modo de exemplo':'Dados salvos na nuvem';
 if(!$('#saved-at').textContent.startsWith('Confirmado')){const updated=data().entries.map(e=>e.updatedAt).filter(Boolean).sort().at(-1);$('#saved-at').textContent=demo?'Dados fictícios · prévia':ready?(updated?'Atualizado '+new Date(updated).toLocaleString('pt-BR'):'Dados carregados da nuvem'):'Aguardando conexão';}
 $('#restore-file').disabled=true;$('#restore-file').closest('label').hidden=true;$('#restore-preview').hidden=true;
 if(!cloudProfile)return;
 const seller=cloudProfile.role==='seller';
 for(const b of all('[data-view]'))b.hidden=(seller&&!['evolution','backup'].includes(b.dataset.view))||(cloudProfile.role!=='admin'&&b.dataset.view==='admin');
 $('#new-entry').hidden=seller||['evolution','ranking','admin'].includes(view);$('#demo').hidden=seller;
 if(seller){$('#evo-mode').value='individual';$('#evo-mode').disabled=true;$('#evo-seller').value=cloudProfile.sellerId;$('#evo-seller').disabled=true;renderEvolution();}
 renderGreeting();
 const counts=all('#admin-counts strong');if(counts[2])counts[2].textContent=cloudProfiles.length;
 if(cloudProfile.role==='manager')$('#entry-store').value=db.admin.stores.find(s=>s.id===cloudProfile.storeId)?.name||'';
}

async function createCloudAccount(){
 $('#admin-error').textContent='';if(busy)return;
 if(demo){$('#admin-error').textContent='Saia do exemplo para alterar contas.';return;}
 if(cloudProfile?.role!=='admin'){$('#admin-error').textContent='Somente administradores podem cadastrar usuários.';return;}
 const id=$('#admin-id').value,existing=cloudProfiles.find(p=>p.id===id);
 const payload={action:id?'update':'create',...(id?{id,expected:existing?.updatedAt}:{}),name:normal($('#admin-name').value),email:$('#admin-email').value.trim(),username:$('#admin-username').value.trim(),...(id?{}:{password:$('#admin-password').value}),role:$('#admin-role').value,storeId:$('#admin-store').value,sellerId:$('#admin-seller').value};
 const button=$('#admin-form button[type=submit]');busy=true;button.disabled=true;
 try{const response=await request('create-account',payload);acceptCloud(response);resetAdmin();render();$('#admin-feedback').textContent=response.warning||(id?'Conta atualizada. A senha foi mantida.':'Conta criada. O usuário já pode entrar com as credenciais cadastradas.');}
 catch(e){$('#admin-error').textContent=e.message;}
 finally{$('#admin-password').value='';payload.password='';busy=false;button.disabled=false;}
}
