function sellerLifecyclePlan(data,profile,payload,today){
 if(profile?.role!=='admin')throw Error('Somente administradores podem movimentar vendedores.');
 const {action,date,sellerId,targetStoreId,adjustGoals=false,note=''}=payload;
 if(!['transfer','dismiss','archive','reactivate'].includes(action)||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today)throw Error('Selecione uma ação e uma data válida, até hoje.');
 if(typeof note!=='string'||note.length>500)throw Error('A observação deve ter até 500 caracteres.');
 const a=data.admin,source=a.sellers.find(s=>s.id===sellerId),sourceStore=a.stores.find(s=>s.id===source?.storeId);
 if(!source||!sourceStore)throw Error('Cadastro não encontrado. Atualize os dados.');
 const person=source.personId||source.id,periods=a.sellerPeriods||[],sourcePeriods=periods.filter(p=>p.sellerId===source.id),current=sourcePeriods.find(p=>p.endedOn===null),personSellers=a.sellers.filter(s=>(s.personId||s.id)===person);
 let target=null,targetStore=null,lastDay=date;
 if(action==='reactivate'){
  if(source.active)throw Error('Este vendedor já está ativo.');
  if(!sourceStore.active)throw Error('Reative a loja antes de reativar o vendedor.');
  if(personSellers.some(s=>s.active))throw Error('Esta pessoa já está ativa em outra loja. Use Transferir no vínculo ativo.');
  if(periods.some(p=>personSellers.some(s=>s.id===p.sellerId)&&(p.endedOn===null||p.endedOn>=date))||data.entries.some(e=>e.store===sourceStore.name&&e.seller===source.name&&e.date>=date))throw Error('A reativação deve começar depois dos vínculos e resultados anteriores.');
 }else{
  if(!source.active)throw Error('Este vínculo não está ativo.');
  if(action==='transfer'){const previous=new Date(date+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);lastDay=previous.toISOString().slice(0,10);}
  if(current?.startedOn&&lastDay<current.startedOn)throw Error('A data é anterior ao início deste vínculo.');
  if(data.entries.some(e=>e.store===sourceStore.name&&e.seller===source.name&&e.date>lastDay))throw Error('Há vendas ou um acumulado semanal após o último dia na loja. Ajuste o fim do acumulado antes de movimentar.');
  if(action==='transfer'){
   targetStore=a.stores.find(s=>s.id===targetStoreId&&s.active&&s.id!==sourceStore.id);if(!targetStore)throw Error('Selecione outra loja ativa.');
   target=personSellers.find(s=>s.storeId===targetStore.id)||null;
   if(target?.active)throw Error('Esta pessoa já está ativa na loja de destino.');
   if(!target&&a.sellers.some(s=>s.storeId===targetStore.id&&s.name.localeCompare(source.name,'pt-BR',{sensitivity:'accent'})===0))throw Error('Já existe um cadastro com este nome no destino. Confira a identidade; históricos não são unidos pelo nome.');
   if(target&&periods.some(p=>p.sellerId===target.id&&(p.endedOn===null||p.endedOn>=date)))throw Error('O destino possui um vínculo que sobrepõe esta data.');
  }
 }
 if(adjustGoals&&(action!=='transfer'||![payload.sourceGoalCents,payload.targetGoalCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000000)))throw Error('Confira os valores das duas metas.');
 const month=date.slice(0,7),sourceGoal=a.sellerGoals.find(g=>g.sellerId===source.id&&g.month===month)?.cents||0,targetGoal=a.sellerGoals.find(g=>g.sellerId===target?.id&&g.month===month)?.cents||0;
 return {action,date,lastDay,source,sourceStore,target,targetStore,month,sourceGoal,targetGoal,futureDailyGoals:a.sellerDailyGoals.filter(g=>g.sellerId===source.id&&g.date>lastDay).length};
}
