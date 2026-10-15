let sellerMovePending=null,sellerMoveBusy=false,sellerGoalKey='';
function sellerStatusLabel(a,seller){if(seller.active)return 'Ativo';const period=(a.sellerPeriods||[]).filter(p=>p.sellerId===seller.id&&p.endedOn).sort((a,b)=>b.endedOn.localeCompare(a.endedOn))[0];return {transfer:'Transferido',dismiss:'Desligado',archive:'Arquivado'}[period?.endReason]||'Arquivado';}
const sellerMoveLabels={transfer:'Transferência',dismiss:'Desligamento',archive:'Arquivamento',reactivate:'Reativação'};
function sellerMoveFields(){
 const a=adminState(),seller=a.sellers.find(s=>s.id===$('#seller-move-id').value);if(!seller)return;
 const action=$('#seller-move-action').value,transfer=action==='transfer',month=$('#seller-move-date').value.slice(0,7),target=a.sellers.find(s=>(s.personId||s.id)===(seller.personId||seller.id)&&s.storeId===$('#seller-move-target').value);
 $('#seller-move-title').textContent=sellerMoveLabels[action]+' de vendedor';$('#seller-move-date-label').textContent=transfer?'Primeiro dia na nova loja':action==='reactivate'?'Data de retorno':'Último dia na loja';
 $('#seller-move-target-label').hidden=!transfer;$('#seller-move-target').required=transfer;$('#seller-move-goals').hidden=!transfer;
 const adjust=transfer&&$('#seller-move-adjust').checked;$('#seller-move-goal-fields').hidden=!adjust;
 for(const id of ['source','target']){$('#seller-move-'+id+'-goal').disabled=!adjust;$('#seller-move-'+id+'-goal').required=adjust;}
 const key=month+'|'+$('#seller-move-target').value;
 if(key!==sellerGoalKey){const sourceGoal=a.sellerGoals.find(g=>g.sellerId===seller.id&&g.month===month)?.cents||0,targetGoal=a.sellerGoals.find(g=>g.sellerId===target?.id&&g.month===month)?.cents||0;$('#seller-move-source-goal').value=amountInput(sourceGoal);$('#seller-move-target-goal').value=amountInput(targetGoal);$('#seller-move-source-before').textContent='Atual: '+money(sourceGoal)+' · '+month;$('#seller-move-target-before').textContent='Atual: '+money(targetGoal)+' · '+month;sellerGoalKey=key;}
}
function openSellerMove(id,action){
 if(cloudProfile?.role!=='admin'||demo||busy){$('#admin-feedback').textContent='Entre como administrador e saia do exemplo para movimentar vendedores.';return;}
 const a=adminState(),seller=a.sellers.find(s=>s.id===id);if(!seller)return;
 $('#seller-move-form').reset();sellerMovePending=null;sellerGoalKey='';$('#seller-move-id').value=id;$('#seller-move-date').value=today;$('#seller-move-date').max=today;
 const select=$('#seller-move-action');[...select.options].forEach(option=>option.hidden=seller.active?option.value==='reactivate':option.value!=='reactivate');select.value=action;
 $('#seller-move-person').textContent=seller.name+' · '+(a.stores.find(s=>s.id===seller.storeId)?.name||'');
 $('#seller-move-target').innerHTML='<option value="">Selecione a nova loja</option>'+a.stores.filter(s=>s.active&&s.id!==seller.storeId).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
 $('#seller-move-error').textContent='';setSellerMoveReview(false);sellerMoveFields();$('#seller-move-dialog').showModal();
}
function sellerMovePayload(){return {sellerId:$('#seller-move-id').value,action:$('#seller-move-action').value,date:$('#seller-move-date').value,targetStoreId:$('#seller-move-target').value,note:$('#seller-move-note').value.trim(),adjustGoals:$('#seller-move-action').value==='transfer'&&$('#seller-move-adjust').checked,...($('#seller-move-action').value==='transfer'&&$('#seller-move-adjust').checked?{sourceGoalCents:amount($('#seller-move-source-goal').value),targetGoalCents:amount($('#seller-move-target-goal').value)}:{})};}
function setSellerMoveReview(review){$('#seller-move-fields').disabled=review;$('#seller-move-fields').hidden=review;$('#seller-move-review').hidden=!review;$('#seller-move-next').hidden=review;$('#seller-move-confirm').hidden=!review;$('#seller-move-back').hidden=!review;}
function reviewSellerMove(event){
 event.preventDefault();if(sellerMoveBusy||busy)return;$('#seller-move-error').textContent='';
 try{
  if(!ready||demo)throw Error('Atualize os dados e saia do exemplo antes de continuar.');
  const payload=sellerMovePayload(),plan=sellerLifecyclePlan(validateDB(db),cloudProfile,payload,today);sellerMovePending={payload,revision};
  const paragraphs=[];
  if(plan.action==='transfer'){
   paragraphs.push(`Último dia na origem: <strong>${batchDateLabel(plan.lastDay)}</strong>. Nova loja: <strong>${esc(plan.targetStore.name)}</strong>, a partir de <strong>${batchDateLabel(plan.date)}</strong>.`);
   paragraphs.push('As vendas anteriores permanecem na loja de origem. O vínculo e a conta de vendedor, quando houver, passam para o destino; o status de acesso da conta é mantido.');
   paragraphs.push(payload.adjustGoals?`Metas individuais de ${plan.month}: origem ${money(plan.sourceGoal)} → <strong>${money(payload.sourceGoalCents)}</strong>; destino ${money(plan.targetGoal)} → <strong>${money(payload.targetGoalCents)}</strong>. Os valores são as metas totais do mês de cada vínculo.`:'As metas individuais atuais serão mantidas. Nenhuma meta será copiada automaticamente para a nova loja.');
   if(plan.futureDailyGoals)paragraphs.push(`${plan.futureDailyGoals} meta(s) diária(s) posteriores à saída permanecem registradas na origem. Revise-as em Metas, se necessário.`);
  }else if(plan.action==='reactivate')paragraphs.push(`Novo vínculo na mesma loja a partir de <strong>${batchDateLabel(plan.date)}</strong>. O histórico será preservado. Uma conta de acesso bloqueada continuará bloqueada; libere-a em Usuários e perfis somente se necessário.`);
  else paragraphs.push(`Último dia na loja: <strong>${batchDateLabel(plan.date)}</strong>. O cadastro ficará inativo, sem novos lançamentos. Contas de vendedor vinculadas a esta pessoa serão bloqueadas. Resultados e metas anteriores serão preservados.`);
  if(payload.note)paragraphs.push('Observação: '+esc(payload.note));
  $('#seller-move-summary').innerHTML=paragraphs.map(p=>'<p>'+p+'</p>').join('');setSellerMoveReview(true);$('#seller-move-confirm').textContent='Confirmar '+sellerMoveLabels[payload.action].toLocaleLowerCase('pt-BR');$('#seller-move-review').tabIndex=-1;$('#seller-move-review').focus({preventScroll:true});$('#seller-move-dialog').scrollTop=0;
 }catch(error){$('#seller-move-error').textContent=error.message;}
}
async function confirmSellerMove(){
 if(sellerMoveBusy||busy||!sellerMovePending)return;
 const button=$('#seller-move-confirm');
 try{
  if(!ready||demo||sellerMovePending.revision!==revision)throw Error('Os dados mudaram. Atualize e confira a movimentação novamente.');
  const pending=sellerMovePending;sellerLifecyclePlan(validateDB(db),cloudProfile,pending.payload,today);sellerMoveBusy=true;busy=true;button.disabled=true;$('#seller-move-back').disabled=true;$('#seller-move-cancel').disabled=true;button.textContent='Salvando mudança…';$('#seller-move-error').textContent='';
  const result=await request('manage-seller',{...pending.payload,revision:pending.revision});acceptCloud(result);$('#seller-move-dialog').close();resetAdmin();render();$('#admin-feedback').textContent=sellerMoveLabels[pending.payload.action]+(['dismiss','archive'].includes(pending.payload.action)?' registrado. Histórico':' registrada. Histórico')+' e resultados anteriores preservados.';notify('Movimentação salva.');
 }catch(error){$('#seller-move-error').textContent=error.message;}
 finally{sellerMoveBusy=false;busy=false;button.disabled=false;$('#seller-move-back').disabled=false;$('#seller-move-cancel').disabled=false;button.textContent='Confirmar mudança';}
}
function openSellerHistory(id){
 if(cloudProfile?.role!=='admin'||demo)return;
 const a=adminState(),seller=a.sellers.find(s=>s.id===id);if(!seller)return;
 const person=seller.personId||seller.id,linked=a.sellers.filter(s=>(s.personId||s.id)===person),name=id=>a.stores.find(st=>st.id===a.sellers.find(s=>s.id===id)?.storeId)?.name||'Loja não encontrada';
 const periods=(a.sellerPeriods||[]).filter(p=>linked.some(s=>s.id===p.sellerId)).sort((a,b)=>(a.startedOn||'').localeCompare(b.startedOn||''));
 const movements=(a.sellerMovements||[]).filter(m=>m.personId===person).sort((a,b)=>b.at.localeCompare(a.at));
 $('#seller-history-name').textContent=seller.name+' · histórico de vínculos da mesma pessoa';
 $('#seller-history-content').innerHTML='<h3>Vínculos por loja</h3>'+periods.map(p=>`<div class="seller-history-item"><strong>${esc(name(p.sellerId))}</strong><small>${p.startedOn?batchDateLabel(p.startedOn):'Início anterior não informado'} → ${p.endedOn?batchDateLabel(p.endedOn):'Atual'}</small>${p.endReason?`<small>${esc(sellerMoveLabels[p.endReason])}</small>`:''}</div>`).join('')+(periods.length?'':'<p>Sem vínculo datado. O cadastro anterior foi preservado.</p>')+'<h3>Movimentações registradas</h3>'+movements.map(m=>{const g=m.goalChanges;return `<div class="seller-history-item"><strong>${esc(sellerMoveLabels[m.action])} · ${batchDateLabel(m.date)}</strong><small>${esc(name(m.fromSellerId))}${m.action==='transfer'?' → '+esc(name(m.toSellerId)):''}</small><small>${new Date(m.at).toLocaleString('pt-BR')} · ${esc(m.actor)}</small>${m.note?`<p>${esc(m.note)}</p>`:''}${g?`<p>Metas do mês: origem ${money(g.sourceBefore||0)} → ${money(g.sourceAfter)}; destino ${money(g.targetBefore||0)} → ${money(g.targetAfter)}.</p>`:''}</div>`;}).join('')+(movements.length?'':'<p>Nenhuma movimentação registrada.</p>');
 $('#seller-history-dialog').showModal();
}
for(const id of ['#seller-move-action','#seller-move-date','#seller-move-target','#seller-move-adjust'])$(id).onchange=sellerMoveFields;
for(const id of ['#seller-move-source-goal','#seller-move-target-goal'])$(id).oninput=event=>{event.target.value=formatSaleDigits(event.target.value);};
$('#seller-move-form').onsubmit=reviewSellerMove;$('#seller-move-next').onclick=reviewSellerMove;
$('#seller-move-form').onkeydown=event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'&&!$('#seller-move-next').hidden)reviewSellerMove(event);};
$('#seller-move-confirm').onclick=confirmSellerMove;$('#seller-move-back').onclick=()=>{sellerMovePending=null;setSellerMoveReview(false);sellerMoveFields();};$('#seller-move-cancel').onclick=()=>$('#seller-move-dialog').close();
$('#seller-move-dialog').addEventListener('cancel',event=>{if(sellerMoveBusy)event.preventDefault();});$('#seller-move-dialog').addEventListener('close',()=>{if(!$('#seller-move-dialog').open)sellerMovePending=null;});
$('#seller-history-close').onclick=()=>$('#seller-history-dialog').close();
root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.sellerAction)openSellerMove(button.dataset.sellerMove,button.dataset.sellerAction);if(button.dataset.sellerHistory)openSellerHistory(button.dataset.sellerHistory);});
