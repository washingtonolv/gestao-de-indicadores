// Included inside the app closure by scripts/build.py.
let adminTab='stores';
const adminLabels={stores:'loja',sellers:'vendedor',users:'usuário'},roleLabels={admin:'Administrador',manager:'Gestor',seller:'Vendedor'};
const adminState=()=>validateDB(db).admin;
function adminOptions(){
 const a=adminState(),storeValue=$('#admin-store').value,sellerValue=$('#admin-seller').value;
 $('#admin-store').innerHTML='<option value="">Selecione uma loja</option>'+a.stores.map(x=>`<option value="${x.id}">${esc(x.name)}${x.active?'':' (arquivada)'}</option>`).join('');
 $('#admin-store').value=storeValue;
 $('#admin-seller').innerHTML='<option value="">Selecione um vendedor</option>'+a.sellers.filter(x=>x.storeId===$('#admin-store').value).map(x=>`<option value="${x.id}">${esc(x.name)}${x.active?'':' (arquivado)'}</option>`).join('');$('#admin-seller').value=sellerValue;
}
function adminFields(){
 const user=adminTab==='users',seller=adminTab==='sellers',role=$('#admin-role').value;
 for(const [id,visible] of [['email',user&&role==='admin'],['username',user],['password',user],['role',user],['store',seller||(user&&role!=='admin')],['seller',user&&role==='seller']]){
  $('#admin-'+id+'-label').hidden=!visible;$('#admin-'+id).disabled=!visible;$('#admin-'+id).required=visible;
 }
 $('#admin-form-help').textContent=user?'Administrador pode entrar com e-mail ou nome de usuário; gestor e vendedor usam nome de usuário. Entregue as credenciais diretamente à pessoa cadastrada.':seller?'Vincule o vendedor a uma loja ativa.':'A loja ficará disponível nos lançamentos e nas metas.';
}
function resetAdmin(){ $('#admin-form').reset();$('#admin-id').value='';$('#admin-error').textContent='';$('#admin-cancel').hidden=true;$('#admin-form-title').textContent='Cadastrar '+(adminLabels[adminTab]||'cadastro');adminOptions();adminFields(); }
function renderAdmin(){if(cloudProfile&&adminTab==='users'){renderCloudProfiles();return;}
 const a=adminState();$('#admin-counts').innerHTML=[['Lojas ativas',a.stores.filter(x=>x.active).length],['Vendedores ativos',a.sellers.filter(x=>x.active).length],['Usuários cadastrados',a.users.length]].map(([label,count])=>`<div class="card"><strong>${count}</strong>${label}</div>`).join('');
 $('#admin-form').hidden=adminTab==='audit';$('#admin-permissions').hidden=adminTab!=='users';
 $('#admin-list-title').textContent={stores:'Lojas cadastradas',sellers:'Vendedores cadastrados',users:'Usuários cadastrados',audit:'Histórico de alterações'}[adminTab];
 $('#admin-list-help').textContent=adminTab==='audit'?'Últimas 200 alterações registradas pelo banco, com identificação do responsável.':adminTab==='users'?'Status e perfis são preparatórios. O bloqueio de acesso depende da futura autenticação.':'Arquivar impede novos lançamentos com o cadastro e preserva o histórico.';
 all('[data-admin-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminTab===adminTab)));
 const query=$('#admin-search').value.trim().toLocaleLowerCase('pt-BR');
 if(adminTab==='audit'){
  $('#admin-list').innerHTML=a.audit.slice().reverse().filter(x=>(x.action+' '+x.actor).toLocaleLowerCase('pt-BR').includes(query)).map(x=>`<div class="admin-row"><div><strong>${esc(x.action)}</strong><small>${new Date(x.at).toLocaleString('pt-BR')} · ${esc(x.actor)}</small></div></div>`).join('')||'<p>Nenhuma alteração encontrada.</p>';return;
 }
 const rows=a[adminTab].filter(x=>(x.name+' '+(x.email||'')).toLocaleLowerCase('pt-BR').includes(query));
 $('#admin-list').innerHTML=rows.map(x=>{const store=a.stores.find(s=>s.id===x.storeId),details=adminTab==='users'?`${roleLabels[x.role]} · ${x.email}${store?' · '+store.name:''}`:adminTab==='sellers'?store?.name||'Loja não encontrada':'Disponível para metas e lançamentos';return `<div class="admin-row"><div><strong>${esc(x.name)}</strong><small>${esc(details)}</small><span class="admin-status">${x.active?'Ativo':adminTab==='users'?'Bloqueado (pré-cadastro)':'Arquivado'}</span></div><div class="actions"><button data-admin-edit="${x.id}">Editar</button><button data-admin-toggle="${x.id}">${x.active?(adminTab==='users'?'Bloquear cadastro':'Arquivar'):'Reativar'}</button>${adminTab==='sellers'?`<button data-admin-delete="${x.id}" class="admin-delete">Excluir</button>`:''}</div></div>`;}).join('')||'<p>Nenhum cadastro encontrado. Use o formulário para começar.</p>';
 adminOptions();adminFields();
}
$('#admin-role').onchange=adminFields;$('#admin-store').onchange=adminOptions;$('#admin-search').oninput=renderAdmin;$('#admin-cancel').onclick=resetAdmin;
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.adminTab){adminTab=b.dataset.adminTab;$('#admin-search').value='';$('#admin-feedback').textContent='';resetAdmin();renderAdmin();return;}
 if(b.dataset.adminEdit){const item=adminState()[adminTab].find(x=>x.id===b.dataset.adminEdit);if(!item)return;resetAdmin();$('#admin-id').value=item.id;$('#admin-name').value=item.name;$('#admin-email').value=item.email||'';$('#admin-role').value=item.role||'admin';$('#admin-store').value=item.storeId||'';adminOptions();$('#admin-seller').value=item.sellerId||'';adminFields();$('#admin-form-title').textContent='Editar '+adminLabels[adminTab];$('#admin-cancel').hidden=false;$('#admin-name').focus();}
 if(b.dataset.adminDelete&&adminTab==='sellers'){
  const item=adminState().sellers.find(x=>x.id===b.dataset.adminDelete);if(!item)return;
  const store=adminState().stores.find(x=>x.id===item.storeId);
  if(db.entries.some(x=>same(x.store,store?.name||'')&&same(x.seller,item.name))||adminState().sellerGoals.some(x=>x.sellerId===item.id)||cloudProfiles.some(x=>x.sellerId===item.id||x.seller_id===item.id)){
   $('#admin-feedback').textContent='Este vendedor possui resultados, metas ou uma conta vinculada. Use Arquivar para preservar o histórico.';return;
  }
  $('#confirm-text').textContent=`Excluir ${item.name}? Esta ação remove o cadastro definitivamente e não pode ser desfeita.`;
  confirmAction=async()=>{b.disabled=true;
  try{const next=validateDB(clone());next.admin.sellers=next.admin.sellers.filter(x=>x.id!==item.id);await save(next,`Excluiu vendedor: ${item.name}`);resetAdmin();renderAdmin();$('#admin-feedback').textContent='Vendedor excluído.';}
  catch(err){$('#admin-feedback').textContent=/foreign key|23503/i.test(err.message)?'Este vendedor possui vínculos. Use Arquivar para preservar o histórico.':err.message;b.disabled=false;}
  };$('#confirm-dialog').showModal();return;
 }
 if(b.dataset.adminToggle){try{const next=validateDB(clone()),item=next.admin[adminTab].find(x=>x.id===b.dataset.adminToggle);if(!item)return;item.active=!item.active;await save(next,`${item.active?'Reativou':'Desativou'} ${adminLabels[adminTab]}: ${item.name}`);$('#admin-feedback').textContent='Status do cadastro atualizado.';}catch(err){$('#admin-feedback').textContent=err.message;}}
});
$('#admin-form').onsubmit=async e=>{
 e.preventDefault();if(cloudProfile&&adminTab==='users'){await createCloudAccount();return;}$('#admin-error').textContent='';try{
  const next=validateDB(clone()),a=next.admin,list=a[adminTab],id=$('#admin-id').value||crypto.randomUUID(),old=list.find(x=>x.id===id);
  const item={id,name:normal($('#admin-name').value),active:old?.active??true};
  if(!item.name)throw Error('Informe um nome.');
  if(adminTab==='sellers')item.storeId=$('#admin-store').value;
  if(adminTab==='users'){item.email=$('#admin-email').value.trim().toLowerCase();item.role=$('#admin-role').value;item.storeId=item.role==='admin'?'':$('#admin-store').value;item.sellerId=item.role==='seller'?$('#admin-seller').value:'';}
  if(adminTab!=='users'&&list.some(x=>x.id!==id&&same(x.name,item.name)&&(adminTab==='stores'||x.storeId===item.storeId)))throw Error('Este cadastro já existe, inclusive entre os arquivados.');
  if(adminTab==='users'&&list.some(x=>x.id!==id&&x.email===item.email))throw Error('Este e-mail já está cadastrado.');
  if(item.storeId&&!a.stores.find(x=>x.id===item.storeId&&x.active))throw Error('Selecione uma loja ativa.');
  if(item.sellerId&&!a.sellers.find(x=>x.id===item.sellerId&&x.active&&x.storeId===item.storeId))throw Error('Selecione um vendedor ativo da loja.');
  if(old&&adminTab==='stores'){for(const x of [...next.entries,...next.goals])if(same(x.store,old.name))x.store=item.name;}
  if(old&&adminTab==='sellers'){
   if(item.storeId!==old.storeId)throw Error('Para preservar vínculos e histórico, arquive este cadastro e crie outro na nova loja.');
   const store=a.stores.find(x=>x.id===old.storeId);for(const x of next.entries)if(same(x.store,store.name)&&same(x.seller,old.name))x.seller=item.name;
  }
  if(old)list[list.indexOf(old)]=item;else list.push(item);
  await save(next,`${old?'Editou':'Cadastrou'} ${adminLabels[adminTab]}: ${item.name}`);resetAdmin();renderAdmin();$('#admin-feedback').textContent='Cadastro salvo no Supabase.';
 }catch(err){$('#admin-error').textContent=err.message;}
};
$('#admin-form button[type=submit]').addEventListener('click',e=>{e.preventDefault();if($('#admin-form').reportValidity())$('#admin-form').onsubmit(e);});
$('#admin-form').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();if($('#admin-form').reportValidity())$('#admin-form').onsubmit(e);}});
