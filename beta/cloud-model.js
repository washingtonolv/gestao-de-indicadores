export const tables=['gi_stores','gi_sellers','gi_entries','gi_store_goals','gi_seller_goals','gi_seller_daily_goals'];
export function toLocal(rows) {
 const stores=rows.gi_stores.map(r=>({id:r.id,name:r.name,active:r.active}));
 const sellers=rows.gi_sellers.map(r=>({id:r.id,name:r.name,active:r.active,storeId:r.store_id}));
 const store=id=>{const r=stores.find(x=>x.id===id);if(!r)throw Error('Loja indisponível. Recarregue os dados.');return r.name;};
 const seller=id=>{const r=sellers.find(x=>x.id===id);if(!r)throw Error('Vendedor indisponível. Recarregue os dados.');return r.name;};
 return {version:1,entries:rows.gi_entries.map(r=>({id:r.id,date:r.date,store:store(r.store_id),seller:seller(r.seller_id),cents:r.cents,orders:r.orders,pieces:r.pieces,updatedAt:r.updated_at,...(r.period_start?{periodStart:r.period_start}:{})})),
 goals:rows.gi_store_goals.map(r=>({store:store(r.store_id),month:r.month.slice(0,7),cents:r.cents})),
 admin:{stores,sellers,users:[],audit:[],sellerGoals:rows.gi_seller_goals.map(r=>({sellerId:r.seller_id,month:r.month.slice(0,7),cents:r.cents})),sellerDailyGoals:rows.gi_seller_daily_goals.map(r=>({sellerId:r.seller_id,date:r.date,cents:r.cents}))}};
}
export function changesFor(data,base,uuid=()=>crypto.randomUUID()) {
 if(data.admin.users.length)throw Error('Contas de acesso são gerenciadas no Supabase nesta etapa.');
 const store=name=>{const s=data.admin.stores.find(x=>x.name===name);if(!s)throw Error('Cadastre a loja antes de lançar resultados.');return s.id;};
 const seller=(name,st)=>{const s=data.admin.sellers.find(x=>x.name===name&&x.storeId===st);if(!s)throw Error('Cadastre o vendedor nesta loja antes de lançar resultados.');return s.id;};
 const target={gi_stores:data.admin.stores.map(r=>({id:r.id,name:r.name,active:r.active})),gi_sellers:data.admin.sellers.map(r=>({id:r.id,name:r.name,active:r.active,store_id:r.storeId})),
 gi_entries:data.entries.map(r=>({id:r.id,store_id:store(r.store),seller_id:seller(r.seller,store(r.store)),date:r.date,cents:r.cents,orders:r.orders,pieces:r.pieces,period_start:r.periodStart||null})),
 gi_store_goals:data.goals.map(r=>({id:base.gi_store_goals.find(x=>x.store_id===store(r.store)&&x.month===r.month+'-01')?.id||uuid(),store_id:store(r.store),month:r.month+'-01',cents:r.cents})),
 gi_seller_goals:data.admin.sellerGoals.map(r=>({id:base.gi_seller_goals.find(x=>x.seller_id===r.sellerId&&x.month===r.month+'-01')?.id||uuid(),store_id:data.admin.sellers.find(x=>x.id===r.sellerId).storeId,seller_id:r.sellerId,month:r.month+'-01',cents:r.cents})),
 gi_seller_daily_goals:data.admin.sellerDailyGoals.map(r=>({id:base.gi_seller_daily_goals.find(x=>x.seller_id===r.sellerId&&x.date===r.date)?.id||uuid(),store_id:data.admin.sellers.find(x=>x.id===r.sellerId).storeId,seller_id:r.sellerId,date:r.date,cents:r.cents}))};
 const changes=[];
 for(const table of tables){for(const row of target[table]){const old=base[table].find(x=>x.id===row.id);if(!old)changes.push({table,action:'insert',row});else if(Object.keys(row).some(k=>row[k]!== (k==='period_start'?(old[k]||null):old[k])))changes.push({table,action:'update',row,expected:old.updated_at});}}
 for(const table of [...tables].reverse())for(const old of base[table])if(!target[table].some(x=>x.id===old.id))changes.push({table,action:'delete',row:{id:old.id},expected:old.updated_at});
 return changes;
}
