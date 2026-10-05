let cloudProfile=null,cloudProfiles=[];
function acceptCloud(result){db=validateDB(result.data);revision=result.revision;cloudProfile=result.profile;cloudProfiles=result.profiles||[];}
function renderCloudProfiles(){
 $('#admin-form').hidden=true;$('#admin-permissions').hidden=true;
 $('#admin-list-title').textContent='Contas com acesso ao painel';
 $('#admin-list-help').textContent='Nesta etapa, criação de contas e alterações de permissão são feitas no Supabase pelo proprietário do projeto.';
 all('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab==='users')));
 $('#admin-list').innerHTML=cloudProfiles.map(p=>`<div class="admin-row"><div><strong>${esc(p.name)}</strong><small>${esc(roleLabels[p.role])} · ${p.active?'Ativo':'Bloqueado'}</small></div></div>`).join('')||'<p>Nenhuma conta acessível.</p>';
}
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
 const counts=all('#admin-counts strong');if(counts[2])counts[2].textContent=cloudProfiles.length;
 if(cloudProfile.role==='manager')$('#entry-store').value=db.admin.stores.find(s=>s.id===cloudProfile.storeId)?.name||'';
}
