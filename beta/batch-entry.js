let batchEditId='',batchLoaded=null,batchInitial='',batchPending=null,batchSaving=false;
const batchDateLabel=value=>value.split('-').reverse().join('/');
function batchContextValue(){return {editId:batchEditId,storeId:$('#batch-store').value,kind:$('#batch-kind').value,date:$('#batch-date').value,month:$('#batch-month').value,week:$('#batch-week').value,periodStart:$('#batch-period-start').value,periodEnd:$('#batch-period-end').value};}
function batchRawValues(){return all('#batch-rows tr').map(row=>({sellerId:row.dataset.sellerId,values:[...row.querySelectorAll('input')].map(input=>input.disabled?'':input.value)}));}
function batchValues(){return batchRawValues().map(row=>({sellerId:row.sellerId,...Object.fromEntries(['cents','orders','pieces'].map((key,i)=>{const text=row.values[i].trim();try{return [key,text===''?null:i===0?amount(text):Number(text)];}catch{throw Error('Confira o valor de vendas digitado.');}}))}));}
function batchTotalMarkup(t){return [['Vendas líquidas',money(t.cents)],['Atendimentos',num(t.orders)],['Peças',num(t.pieces)],['Ticket médio',t.orders?money(Math.round(t.cents/t.orders)):'—'],['P.A.',t.orders?num(t.pieces/t.orders):'—']].map(([title,value])=>`<span>${title}<strong>${value}</strong></span>`).join('');}
function batchPeriodFields(){
 const weekly=$('#batch-kind').value==='weekly',month=$('#batch-month').value;
 $('#batch-date-label').hidden=weekly;for(const id of ['month','week','period-start','period-end']){$('#batch-'+id+'-label').hidden=!weekly;$('#batch-'+id).required=weekly;}
 const chosen=$('#batch-week').value;
 $('#batch-week').innerHTML=/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?workingWeekRanges(month).map(r=>`<option value="${r.start}|${r.end}">Dias ${r.start}–${r.end} · ${r.workingDays} dias úteis</option>`).join(''):'';
 const current=month===currentMonth?workingWeekRanges(month).find(r=>Number(today.slice(-2))>=r.start&&Number(today.slice(-2))<=r.end):null;
 if([...$('#batch-week').options].some(o=>o.value===chosen))$('#batch-week').value=chosen;
 else if(current)$('#batch-week').value=current.start+'|'+current.end;
 if(weekly&&$('#batch-week').value){
  const {min,max}=weeklyEntryBounds(month,$('#batch-week').value),start=$('#batch-period-start'),end=$('#batch-period-end'),latest=max<today?max:today;
  for(const field of [start,end]){field.min=min;field.max=latest;}
  if(!start.value||start.value<min||start.value>max)start.value=min;
  end.min=start.value;
  if(!end.value||end.value<start.value||end.value>max)end.value=latest>=start.value?latest:start.value;
 }
}
function syncBatchUI(){
 const allowed=!demo&&ready&&['admin','manager'].includes(cloudProfile?.role);
 $('#batch-load').disabled=!allowed||!!batchLoaded;
 $('#batch-review').disabled=!allowed||batchSaving;
 if(!batchLoaded){
  const select=$('#batch-store'),chosen=select.value,stores=validateDB(data()).admin.stores.filter(s=>(s.active||db.entries.some(e=>e.id===batchEditId&&same(e.store,s.name)))&&(cloudProfile?.role==='admin'||s.id===cloudProfile?.storeId));
  const markup='<option value="">Selecione uma loja</option>'+stores.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if(select.innerHTML!==markup){select.innerHTML=markup;select.value=stores.some(s=>s.id===chosen)?chosen:cloudProfile?.role==='manager'?stores[0]?.id||'':'';}
  $('#batch-context').disabled=!allowed;
 }else if(batchLoaded.revision!==revision||!allowed){$('#batch-error').textContent='Os dados ou a sessão mudaram. Confira os dados atualizados e carregue a lista novamente antes de salvar.';$('#batch-review').disabled=true;}
}
function clearBatch(){
 batchLoaded=null;batchPending=null;batchInitial='';batchEditId='';$('#batch-context').disabled=false;$('#batch-editor').hidden=true;$('#batch-load').hidden=false;$('#batch-reset').hidden=true;$('#batch-rows').replaceChildren();$('#batch-error').textContent='';syncBatchUI();
}
function loadBatch(){
 $('#batch-error').textContent='';$('#batch-feedback').textContent='';
 try{
  if(!ready||demo)throw Error('Entre com sua conta e saia do exemplo para lançar resultados.');
  const context=batchContextValue(),scope=batchEntryScope(db,context,today,cloudProfile);
  batchLoaded={context,scope,revision};$('#batch-context').disabled=true;$('#batch-load').hidden=true;$('#batch-reset').hidden=false;$('#batch-editor').hidden=false;
  $('#batch-period').textContent=scope.store.name+' · '+(scope.weekly?'Acumulado de '+batchDateLabel(scope.start)+' a '+batchDateLabel(scope.end):'Diário · '+batchDateLabel(scope.start));
  $('#batch-rows').innerHTML=scope.sellers.map(s=>{const e=context.editId&&s.existing?.id!==context.editId?null:s.existing,blocked=s.conflict,labels=['Vendas líquidas','Atendimentos','Peças'];return `<tr data-seller-id="${s.id}"><td>${esc(s.name)}<small class="${blocked?'batch-conflict':''}">${blocked?esc(s.blockReason||'Há lançamentos sobrepostos. Confira o histórico.'):e?'Registro existente · preencha o novo acumulado':'Novo lançamento'}</small></td>${['cents','orders','pieces'].map((key,i)=>`<td data-label="${labels[i]}"><input aria-label="${labels[i]} de ${esc(s.name)}" data-field="${key}" ${i===0?'type="text" inputmode="decimal" placeholder="0,00"':'type="number" inputmode="numeric" min="0" max="1000000" step="1" placeholder="0"'} ${blocked?'disabled':''} value="${blocked?'':e?i===0?amountInput(e[key]):e[key]:''}"></td>`).join('')}<td data-label="TM"><output data-tm>—</output></td><td data-label="P.A."><output data-pa>—</output></td></tr>`;}).join('');
  batchInitial=JSON.stringify(batchRawValues());updateBatchLive();
 }catch(error){$('#batch-error').textContent=error.message;}
}
function updateBatchLive(){
 const total={cents:0,orders:0,pieces:0};let invalid=false;
 for(const row of all('#batch-rows tr')){
  const inputs=[...row.querySelectorAll('input')];if(inputs.every(input=>input.disabled))continue;
  let cents=0;try{cents=inputs[0].value?amount(inputs[0].value):0;}catch{invalid=true;}
  const orders=Number(inputs[1].value),pieces=Number(inputs[2].value);
  if(!Number.isSafeInteger(orders)||!Number.isSafeInteger(pieces)||orders<0||pieces<0)invalid=true;
  total.cents+=cents;total.orders+=Number.isFinite(orders)?orders:0;total.pieces+=Number.isFinite(pieces)?pieces:0;
  row.querySelector('[data-tm]').textContent=orders>0?money(Math.round(cents/orders)):'—';row.querySelector('[data-pa]').textContent=orders>0?num(pieces/orders):'—';
 }
 $('#batch-live').innerHTML=invalid?'<span>Confira os valores digitados antes de continuar.</span>':batchTotalMarkup(total);
 $('#batch-live').setAttribute('aria-label','Totais das linhas preenchidas');
}
function reviewBatch(event){
 event.preventDefault();$('#batch-error').textContent='';
 try{
  if(!batchLoaded||!ready||demo||busy)throw Error('Aguarde o carregamento dos dados antes de continuar.');
  if(batchLoaded.revision!==revision)throw Error('Os dados mudaram desde o carregamento. Carregue os vendedores novamente para conferir os valores atuais.');
  const inputs=batchValues(),plan=batchEntryPlan(db,batchLoaded.context,inputs,today,cloudProfile);
  batchPending={plan,inputs,context:structuredClone(batchLoaded.context),revision};
  $('#batch-review-context').textContent=plan.scope.store.name+' · '+batchDateLabel(plan.scope.start)+(plan.scope.weekly?' a '+batchDateLabel(plan.scope.end):'');
  $('#batch-review-summary').textContent=`${plan.newCount} novo(s) lançamento(s) e ${plan.updateCount} atualização(ões). Somente as linhas abaixo serão salvas. Os demais registros serão preservados.`;
  $('#batch-review-totals').innerHTML=batchTotalMarkup(plan.totals);
  $('#batch-review-note').textContent='Totais previstos da loja no período, incluindo os registros já salvos. Ao atualizar um acumulado, informe o total até a data final, sem somar de novo o valor anterior.'+(plan.partialOverlap?' Há acumulados que abrangem datas fora deste intervalo; eles não entram neste total.':'');
  $('#batch-review-rows').innerHTML=plan.changes.map(c=>`<tr><td>${esc(c.seller)}</td><td data-label="Ação">${c.before?'Atualizar':'Novo'}</td><td data-label="Vendas">${money(c.record.cents)}${c.before?`<small>Antes: ${money(c.before.cents)}</small>`:''}</td><td data-label="Atendimentos">${num(c.record.orders)}${c.before?`<small>Antes: ${num(c.before.orders)}</small>`:''}</td><td data-label="Peças">${num(c.record.pieces)}${c.before?`<small>Antes: ${num(c.before.pieces)}</small>`:''}</td></tr>`).join('');
  $('#batch-save-error').textContent='';$('#batch-review-dialog').showModal();
 }catch(error){$('#batch-error').textContent=error.message;}
}
async function confirmBatch(){
 if(batchSaving||busy||!batchPending)return;const button=$('#batch-confirm');
 try{
  if(batchPending.revision!==revision||!ready||demo)throw Error('Os dados mudaram. Volte e carregue a lista novamente antes de salvar.');
  const pending=batchPending,plan=batchEntryPlan(db,pending.context,pending.inputs,today,cloudProfile),next=clone();
  for(const change of plan.changes){const record={...change.record,id:change.before?.id||crypto.randomUUID(),updatedAt:new Date().toISOString()},index=next.entries.findIndex(e=>e.id===record.id);if(index<0)next.entries.push(record);else next.entries[index]=record;}
  batchSaving=true;button.disabled=true;$('#batch-back').disabled=true;button.textContent='Salvando…';$('#batch-save-error').textContent='';
  await save(next,'Salvou '+plan.changes.length+' resultado(s) · '+plan.scope.store.name);
  $('#month').value=plan.scope.end.slice(0,7);$('#store').value=plan.scope.store.name;page=0;$('#batch-review-dialog').close();clearBatch();render();
  $('#batch-feedback').textContent=`${plan.changes.length} lançamento(s) confirmado(s). ${plan.scope.store.name} · ${batchDateLabel(plan.scope.start)}${plan.scope.weekly?' a '+batchDateLabel(plan.scope.end):''}.`;
  notify('Lançamentos salvos. Indicadores atualizados.');$('#batch-load').focus();
 }catch(error){$('#batch-save-error').textContent=error.message+' Os valores preenchidos foram mantidos para conferência.';}
 finally{batchSaving=false;button.disabled=false;$('#batch-back').disabled=false;button.textContent='Confirmar e salvar';syncBatchUI();}
}
$('#batch-month').value=currentMonth;$('#batch-date').value=today;batchPeriodFields();
$('#batch-kind').onchange=batchPeriodFields;$('#batch-month').onchange=()=>{$('#batch-week').value='';batchPeriodFields();};$('#batch-week').onchange=()=>{$('#batch-period-start').value='';$('#batch-period-end').value='';batchPeriodFields();};$('#batch-period-start').onchange=batchPeriodFields;
$('#batch-load').onclick=loadBatch;
$('#batch-reset').onclick=()=>{if(JSON.stringify(batchRawValues())!==batchInitial){$('#confirm-text').textContent='Descartar os valores ainda não salvos e escolher outra loja ou período?';confirmAction=async()=>{clearBatch();$('#batch-feedback').textContent='';};$('#confirm-dialog').showModal();}else{clearBatch();$('#batch-feedback').textContent='';}};
$('#batch-rows').addEventListener('input',event=>{if(event.target.dataset.field==='cents'){const input=event.target,tail=input.value.slice(input.selectionStart??input.value.length).replace(/\D/g,'').length;input.value=formatSaleDigits(input.value);let cursor=input.value.length,remaining=tail;while(cursor>0&&remaining>0)if(/\d/.test(input.value[--cursor]))remaining--;input.setSelectionRange(cursor,cursor);}$('#batch-error').textContent='';updateBatchLive();});
$('#batch-form').onsubmit=reviewBatch;$('#batch-review').onclick=reviewBatch;
$('#batch-form').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT')reviewBatch(event);});
$('#batch-back').onclick=()=>$('#batch-review-dialog').close();$('#batch-confirm').onclick=confirmBatch;
$('#batch-review-dialog').addEventListener('cancel',event=>{if(batchSaving)event.preventDefault();});
$('#batch-review-dialog').addEventListener('close',()=>{if(!$('#batch-review-dialog').open)batchPending=null;});
function openBatchRecord(id){
 const open=()=>{
  const entry=db.entries.find(e=>e.id===id);if(!entry)return;
  clearBatch();batchEditId=id;syncBatchUI();
  const store=db.admin.stores.find(s=>same(s.name,entry.store));
  if(!store){$('#batch-error').textContent='Loja do lançamento não encontrada.';return;}
  $('#batch-store').value=store.id;$('#batch-kind').value=entry.periodStart?'weekly':'daily';
  $('#batch-month').value=entry.date.slice(0,7);$('#batch-date').value=entry.date;
  batchPeriodFields();
  if(entry.periodStart){
   const range=workingWeekRanges(entry.date.slice(0,7)).find(w=>w.start<=Number(entry.periodStart.slice(-2))&&w.end>=Number(entry.date.slice(-2)));
   if(range)$('#batch-week').value=range.start+'|'+range.end;
   $('#batch-period-start').value=entry.periodStart;$('#batch-period-end').value=entry.date;batchPeriodFields();
  }
  loadBatch();
  const seller=db.admin.sellers.find(s=>s.storeId===store.id&&same(s.name,entry.seller)),input=all('#batch-rows tr').find(r=>r.dataset.sellerId===seller?.id)?.querySelector('input');
  if(input&&!input.disabled){input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}else $('#batch-error').textContent='Confira o período e o vínculo do vendedor antes de atualizar este lançamento.';
 };
 if(batchSaving||busy)return;
 if(batchLoaded&&JSON.stringify(batchRawValues())!==batchInitial){
  $('#confirm-text').textContent='Descartar os valores ainda não salvos e abrir o lançamento selecionado no histórico?';
  confirmAction=async()=>open();$('#confirm-dialog').showModal();
 }else open();
}
$('#records').classList.add('batch-mode');
root.addEventListener('click',event=>{const button=event.target.closest('button[data-edit]');if(button)openBatchRecord(button.dataset.edit);});
