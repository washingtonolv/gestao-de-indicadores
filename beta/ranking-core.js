export function rankingWeeks(month){
 const [year,m]=month.split('-').map(Number),last=new Date(year,m,0).getDate(),ranges=[];
 let start=1,workingDays=0;
 for(let day=1;day<=last;day++){
  if(new Date(year,m-1,day).getDay()!==0)workingDays++;
  if(workingDays===7){ranges.push({start,end:day,workingDays});start=day+1;workingDays=0;}
 }
 if(start<=last){if(!workingDays&&ranges.length)ranges[ranges.length-1].end=last;else ranges.push({start,end:last,workingDays});}
 return ranges;
}
export function rankingReport(data,filters,today,profile){
 const {month,week='',store='',mode='sellers',criterion='attainment'}=filters||{};
 if(!profile||!['admin','manager'].includes(profile.role))throw Error('O ranking está disponível para administradores e gestores.');
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 if(!['sellers','stores'].includes(mode)||!['attainment','sales','ticket','pa'].includes(criterion))throw Error('Selecione uma classificação válida.');
 if(profile.role==='manager'&&mode!=='sellers')throw Error('O gestor acompanha o ranking dos vendedores da própria loja.');
 const ranges=rankingWeeks(month),range=week?ranges.find(r=>week===r.start+'|'+r.end):null;
 if(week&&!range)throw Error('Selecione uma semana válida.');
 const date=day=>month+'-'+String(day).padStart(2,'0'),start=date(range?.start||1),end=date(range?.end||ranges.at(-1).end),cutoff=end<today?end:today,future=start>today;
 const eq=(a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'accent'})===0;
 const stores=data.admin.stores.filter(s=>(profile.role==='admin'||s.id===profile.storeId)&&(!store||eq(store,s.name)));
 if(store&&!stores.length)throw Error('A loja selecionada não está disponível para sua conta.');
 const all=data.entries.filter(e=>stores.some(s=>eq(s.name,e.store))&&(e.periodStart||e.date)<=end&&e.date>=start&&(e.periodStart||e.date)<=today);
 // An accumulated week cannot be divided into individual days or other blocks.
 const records=future?[]:all.filter(e=>(e.periodStart||e.date)>=start&&e.date<=end);
 const excludedEntries=all.length-records.length,dayCount=ranges.reduce((sum,r)=>sum+r.workingDays,0),ratio=range?range.workingDays/dayCount:1;
 const visibleStores=stores.filter(s=>s.active||records.some(e=>eq(e.store,s.name)));
 const entities=mode==='stores'?visibleStores.map(s=>({...s,storeId:s.id,storeName:s.name})):data.admin.sellers.filter(s=>visibleStores.some(st=>st.id===s.storeId)&&((s.active&&visibleStores.find(st=>st.id===s.storeId).active)||records.some(e=>eq(e.seller,s.name)&&visibleStores.some(st=>st.id===s.storeId&&eq(st.name,e.store))))).map(s=>({...s,storeName:visibleStores.find(st=>st.id===s.storeId).name}));
 const roundRatio=(n,d,factor)=>((BigInt(n)*BigInt(factor)*2n+BigInt(d))/(BigInt(d)*2n)).toString();
 const rows=entities.map(entity=>{
  const selected=records.filter(e=>eq(e.store,entity.storeName)&&(mode==='stores'||eq(e.seller,entity.name))),t=selected.reduce((a,e)=>({cents:a.cents+e.cents,orders:a.orders+e.orders,pieces:a.pieces+e.pieces}),{cents:0,orders:0,pieces:0});
  const monthly=mode==='stores'?data.goals.find(g=>g.month===month&&eq(g.store,entity.name))?.cents:data.admin.sellerGoals.find(g=>g.month===month&&g.sellerId===entity.id)?.cents;
  const goal=monthly?Math.round(monthly*ratio):null,hasData=selected.length>0;
  const reason=!hasData?'Sem lançamentos':criterion==='attainment'&&!goal?'Sem meta':['ticket','pa'].includes(criterion)&&!t.orders?'Sem atendimentos':'';
  const score=reason?null:criterion==='sales'?String(t.cents):criterion==='attainment'?roundRatio(t.cents,goal,10000):criterion==='ticket'?roundRatio(t.cents,t.orders,1):roundRatio(t.pieces,t.orders,100);
  return {id:entity.id,name:entity.name,storeId:entity.storeId,storeName:entity.storeName,active:entity.active,...t,goal,hasData,attainment:hasData&&goal?t.cents/goal*100:null,tm:t.orders?t.cents/t.orders:null,pa:t.orders?t.pieces/t.orders:null,score,reason,rank:null,updatedAt:selected.map(e=>e.updatedAt).filter(Boolean).sort().at(-1)||null};
 });
 rows.sort((a,b)=>a.score===null&&b.score!==null?1:b.score===null&&a.score!==null?-1:a.score!==null&&b.score!==null&&BigInt(a.score)!==BigInt(b.score)?BigInt(a.score)>BigInt(b.score)?-1:1:a.name.localeCompare(b.name,'pt-BR')||a.storeName.localeCompare(b.storeName,'pt-BR'));
 let previous=null,rank=null;
 rows.forEach((row,i)=>{if(row.score!==null){if(row.score!==previous)rank=i+1;row.rank=rank;previous=row.score;}});
 const totals=rows.reduce((a,r)=>({cents:a.cents+r.cents,orders:a.orders+r.orders,pieces:a.pieces+r.pieces}),{cents:0,orders:0,pieces:0});
 return {month,start,end,cutoff,future,partial:!future&&end>today,week,mode,criterion,store:store||'Todas as lojas disponíveis',rows,records,totals,excludedEntries,rankedCount:rows.filter(r=>r.rank!==null).length,updatedAt:records.map(e=>e.updatedAt).filter(Boolean).sort().at(-1)||null,goalNote:week?`Meta semanal proporcional: ${range.workingDays} de ${dayCount} dias úteis do mês. Domingos não entram na divisão.`:'Atingimento calculado sobre a meta mensal completa.'};
}
