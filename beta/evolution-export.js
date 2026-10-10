// Snapshot calculations shared by the XLSX writer and regression tests.
const same=(a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'accent'})===0;
const totals=rows=>rows.reduce((t,r)=>({cents:t.cents+r.cents,orders:t.orders+r.orders,pieces:t.pieces+r.pieces}),{cents:0,orders:0,pieces:0});
export function evolutionReport(data,filters,today,profile){
 const {month,store='',sellerId=''}=filters||{};
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 if(month>today.slice(0,7))throw Error('Não há resultados realizados em um período futuro.');
 if(!profile||!['admin','manager','seller'].includes(profile.role))throw Error('Entre novamente no painel.');
 const registry=data.admin;
 const stores=registry.stores.filter(s=>(profile.role==='admin'||s.id===profile.storeId)&&(!store||same(s.name,store)));
 if(store&&!stores.length)throw Error('A loja selecionada não está disponível para sua conta.');
 const people=registry.sellers.filter(s=>stores.some(t=>t.id===s.storeId)&&(profile.role!=='seller'||s.id===profile.sellerId)&&(!sellerId||s.id===sellerId));
 if(sellerId&&!people.length)throw Error('O vendedor selecionado não está disponível para sua conta.');
 const records=data.entries.filter(e=>e.date.startsWith(month)&&(e.periodStart||e.date)<=today&&people.some(p=>same(p.name,e.seller)&&stores.some(s=>s.id===p.storeId&&same(s.name,e.store))));
 const groups=stores.map(s=>{const sellers=people.filter(p=>p.storeId===s.id).map(p=>({id:p.id,name:p.name,...totals(records.filter(e=>same(e.store,s.name)&&same(e.seller,p.name)))})).sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name,'pt-BR'));return {name:s.name,sellers,...totals(records.filter(e=>same(e.store,s.name)))};}).filter(g=>!sellerId||g.sellers.length).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return {month,cutoff:month===today.slice(0,7)?today:month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate(),store:store||'Todas as lojas disponíveis',seller:people.find(p=>p.id===sellerId)?.name||(profile.role==='seller'?people[0]?.name:'Toda a equipe'),groups,records:records.sort((a,b)=>a.store.localeCompare(b.store,'pt-BR')||a.seller.localeCompare(b.seller,'pt-BR')||(a.periodStart||a.date).localeCompare(b.periodStart||b.date)),totals:totals(records)};
}
