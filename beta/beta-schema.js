function validateDB(d){
 const fail=()=>{throw Error('Arquivo inválido. Use um backup desta beta, versão 1.');};
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const name=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=80&&!/[\u0000-\u001f]/.test(v);
 const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 const date=v=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 if(!obj(d)||d.version!==1||!Array.isArray(d.entries)||!Array.isArray(d.goals)||d.entries.length>5000||d.goals.length>1000)fail();
 const ids=new Set(),keys=new Set();
 for(const e of d.entries){if(!obj(e)||typeof e.id!=='string'||!/^[\w-]{1,80}$/.test(e.id)||ids.has(e.id)||!date(e.date)||!name(e.store)||!name(e.seller)||!int(e.cents,100000000000)||!int(e.orders,1000000)||!int(e.pieces,1000000)||(e.orders===0&&(e.cents>0||e.pieces>0)))fail();if(e.updatedAt!==undefined&&(typeof e.updatedAt!=='string'||!Number.isFinite(Date.parse(e.updatedAt))))fail();if(e.periodStart!==undefined&&(!date(e.periodStart)||e.periodStart>e.date||e.periodStart.slice(0,7)!==e.date.slice(0,7)))fail();ids.add(e.id);}
 for(const g of d.goals){const key=g.month+'|'+g.store;if(!obj(g)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(g.month)||!name(g.store)||!int(g.cents,100000000000)||g.cents===0||keys.has(key))fail();keys.add(key);}
 return {version:1,admin:validateAdmin(d),entries:d.entries.map(({id,date,store,seller,cents,orders,pieces,updatedAt,periodStart})=>({id,date,store,seller,cents,orders,pieces,...(updatedAt?{updatedAt}:{}),...(periodStart?{periodStart}:{})})),goals:d.goals.map(({month,store,cents})=>({month,store,cents}))};
}
function validateAdmin(d){
 const fail=()=>{throw Error('Cadastros administrativos inválidos. Confira os vínculos, nomes e e-mails do backup.');};
 const key=s=>s.toLocaleLowerCase('pt-BR'),text=(s,max=80)=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
 const date=v=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 const a=d.admin===undefined?{stores:[],sellers:[],users:[],audit:[]}:d.admin;
 if(!a||typeof a!=='object'||!['stores','sellers','users','audit'].every(k=>Array.isArray(a[k]))||a.stores.length>5000||a.sellers.length>5000||a.users.length>1000||a.audit.length>200)fail();
 const ids=new Set(),names=new Set(),emails=new Set();
 const base=x=>{if(!x||!text(x.id)||!/^[\w-]+$/.test(x.id)||ids.has(x.id)||!text(x.name)||typeof x.active!=='boolean')fail();ids.add(x.id);return {id:x.id,name:x.name,active:x.active};};
 const stores=a.stores.map(x=>{const v=base(x),k=key(v.name);if(names.has(k))fail();names.add(k);return v;});
 names.clear();
 const sellers=a.sellers.map(x=>{const v={...base(x),storeId:x.storeId},k=x.storeId+'|'+key(v.name);if(!stores.some(s=>s.id===v.storeId)||names.has(k))fail();names.add(k);return v;});
 const users=a.users.map(x=>{const v={...base(x),email:x.email,role:x.role,storeId:x.storeId,sellerId:x.sellerId};if(!text(v.email,160)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||emails.has(key(v.email))||!['admin','manager','seller'].includes(v.role)||typeof v.storeId!=='string'||typeof v.sellerId!=='string')fail();if(v.role==='admin'&&(v.storeId||v.sellerId))fail();if(v.role!=='admin'&&!stores.some(s=>s.id===v.storeId))fail();if(v.role==='seller'&&!sellers.some(s=>s.id===v.sellerId&&s.storeId===v.storeId))fail();if(v.role!=='seller'&&v.sellerId)fail();emails.add(key(v.email));return v;});
 const audit=a.audit.map(x=>{if(!x||!text(x.id)||!text(x.action,240)||!text(x.actor)||typeof x.at!=='string'||!Number.isFinite(Date.parse(x.at)))fail();return {id:x.id,action:x.action,actor:x.actor,at:x.at};});
 let seq=0;const legacyId=()=>{let id;do{id='legacy-'+(++seq);}while(ids.has(id));ids.add(id);return id;};
 // Existing results become registry entries without modifying their amounts or dates.
 for(const row of [...d.goals,...d.entries]){
  let store=stores.find(x=>key(x.name)===key(row.store));if(!store){store={id:legacyId(),name:row.store,active:true};stores.push(store);}
  if(row.seller&&!sellers.some(x=>x.storeId===store.id&&key(x.name)===key(row.seller)))sellers.push({id:legacyId(),name:row.seller,storeId:store.id,active:true});
 }
 if(stores.length>5000||sellers.length>5000)fail();
 const sellerGoals=a.sellerGoals===undefined?[]:a.sellerGoals;if(!Array.isArray(sellerGoals)||sellerGoals.length>5000)fail();const goalKeys=new Set();for(const g of sellerGoals){if(!g||!sellers.some(s=>s.id===g.sellerId)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(g.month)||!Number.isSafeInteger(g.cents)||g.cents<=0||g.cents>100000000000||goalKeys.has(g.month+'|'+g.sellerId))fail();goalKeys.add(g.month+'|'+g.sellerId);}const sellerDailyGoals=a.sellerDailyGoals===undefined?[]:a.sellerDailyGoals;if(!Array.isArray(sellerDailyGoals)||sellerDailyGoals.length>10000)fail();const dailyKeys=new Set();for(const g of sellerDailyGoals){if(!g||!sellers.some(s=>s.id===g.sellerId)||!date(g.date)||!Number.isSafeInteger(g.cents)||g.cents<=0||g.cents>100000000000||dailyKeys.has(g.date+'|'+g.sellerId))fail();dailyKeys.add(g.date+'|'+g.sellerId);}return {stores,sellers,users,audit,sellerGoals:sellerGoals.map(({sellerId,month,cents})=>({sellerId,month,cents})),sellerDailyGoals:sellerDailyGoals.map(({sellerId,date,cents})=>({sellerId,date,cents}))};
}
