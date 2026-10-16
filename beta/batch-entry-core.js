// Shared validation for a store's daily or weekly batch. Money stays in cents.
function weeklyEntryBounds(month,week){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 const range=workingWeekRanges(month).find(r=>week===r.start+'|'+r.end);
 if(!range)throw Error('Selecione um bloco válido de 7 dias úteis.');
 return {min:month+'-'+String(range.start).padStart(2,'0'),max:month+'-'+String(range.end).padStart(2,'0')};
}
function weeklyEntryRange(context,today){
 const {min,max}=weeklyEntryBounds(context.month,context.week),start=context.periodStart,end=context.periodEnd;
 const valid=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 if(!valid(start)||!valid(end)||start<min||end>max||start>end)throw Error('Informe o início e o fim do acumulado dentro da semana selecionada.');
 if(start>today||end>today)throw Error('O acumulado não pode incluir uma data futura.');
 return {start,end};
}
function batchEntryScope(data,context,today,profile){
 const fail=message=>{throw Error(message);},validDate=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 if(!profile||!['admin','manager'].includes(profile.role))fail('Somente administradores e gestores podem lançar resultados.');
 const edit=context.editId?data.entries.find(e=>e.id===context.editId):null;
 const store=data.admin.stores.find(s=>s.id===context.storeId&&(s.active||edit?.store===s.name));
 if(!store||profile.role==='manager'&&profile.storeId!==store.id)fail('Selecione uma loja ativa disponível para sua conta.');
 let start,end,weekly=context.kind==='weekly';
 if(weekly){
  ({start,end}=weeklyEntryRange(context,today));
 }else if(context.kind==='daily'&&validDate(context.date)){start=end=context.date;}
 else fail('Selecione uma data válida.');
 if(start>today)fail('O lançamento não pode começar em uma data futura.');
 const sellers=data.admin.sellers.filter(s=>s.storeId===store.id&&(s.active||edit?.seller===s.name&&edit.store===store.name)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(s=>{
  const own=data.entries.filter(e=>e.store===store.name&&e.seller===s.name);
  const existing=own.find(e=>weekly?e.periodStart===start:!e.periodStart&&e.date===end);
  const overlap=own.filter(e=>e.id!==existing?.id&&(e.periodStart||e.date)<=end&&start<=e.date);
  const archived=(!s.active||!store.active)&&(!existing||existing.id!==edit?.id||existing.date!==end);
  const outside=Array.isArray(data.admin.sellerPeriods)&&!data.admin.sellerPeriods.some(p=>p.sellerId===s.id&&(!p.startedOn||p.startedOn<=start)&&(!p.endedOn||p.endedOn>=end));
  return {...s,existing,conflict:archived||outside||overlap.length>0,blockReason:archived?'Cadastro arquivado: somente a correção do período original é permitida.':outside?'Período fora do vínculo nesta loja. Ajuste o início e o fim do acumulado conforme a data da transferência.':''};
 });
 if(!sellers.length)fail('Esta loja não tem vendedores ativos cadastrados.');
 return {store,start,end,weekly,sellers};
}
function batchEntryPlan(data,context,inputs,today,profile){
 const scope=batchEntryScope(data,context,today,profile),changes=[],seen=new Set();
 for(const input of inputs){
  const seller=scope.sellers.find(s=>s.id===input.sellerId);
  if(!seller||seen.has(input.sellerId))throw Error('Confira os vendedores da loja e carregue a lista novamente.');seen.add(input.sellerId);
  const values=[input.cents,input.orders,input.pieces];
  if(values.every(v=>v===null))continue;
  if(values.some(v=>v===null))throw Error(seller.name+': preencha vendas, atendimentos e peças. Use zero quando não houver resultado.');
  if(!values.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v<=(i===0?100000000000:1000000)))throw Error(seller.name+': confira os valores; atendimentos e peças devem ser números inteiros.');
  if(!input.orders&&(input.cents>0||input.pieces>0))throw Error(seller.name+': informe ao menos um atendimento para as vendas ou peças.');
  if(seller.conflict)throw Error(seller.name+': '+(seller.blockReason||'já existem lançamentos em parte deste período. Confira o histórico antes de continuar.'));
  const old=seller.existing;
  if(old&&old.date===scope.end&&old.cents===input.cents&&old.orders===input.orders&&old.pieces===input.pieces)continue;
  changes.push({sellerId:seller.id,seller:seller.name,before:old||null,record:{store:scope.store.name,seller:seller.name,date:scope.end,...(scope.weekly?{periodStart:scope.start}:{}),cents:input.cents,orders:input.orders,pieces:input.pieces}});
 }
 if(!changes.length)throw Error('Nenhuma alteração para salvar. Preencha pelo menos um vendedor ou altere um valor existente.');
 const changedIds=new Set(changes.map(c=>c.before?.id).filter(Boolean));
 const periodEntries=data.entries.filter(e=>e.store===scope.store.name&&!changedIds.has(e.id)&&(e.periodStart||e.date)>=scope.start&&e.date<=scope.end);
 const totals=[...periodEntries,...changes.map(c=>c.record)].reduce((a,e)=>({cents:a.cents+e.cents,orders:a.orders+e.orders,pieces:a.pieces+e.pieces}),{cents:0,orders:0,pieces:0});
 const partialOverlap=data.entries.some(e=>e.store===scope.store.name&&!changedIds.has(e.id)&&(e.periodStart||e.date)<=scope.end&&scope.start<=e.date&&((e.periodStart||e.date)<scope.start||e.date>scope.end));
 return {scope,changes,totals,partialOverlap,newCount:changes.filter(c=>!c.before).length,updateCount:changes.filter(c=>c.before).length};
}
