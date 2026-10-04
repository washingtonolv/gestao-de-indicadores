function validateDB(d){
 const fail=()=>{throw Error('Arquivo inválido. Use um backup desta beta, versão 1.');};
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const name=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=80&&!/[\u0000-\u001f]/.test(v);
 const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 const date=v=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 if(!obj(d)||d.version!==1||!Array.isArray(d.entries)||!Array.isArray(d.goals)||d.entries.length>5000||d.goals.length>1000)fail();
 const ids=new Set(),keys=new Set();
 for(const e of d.entries){if(!obj(e)||typeof e.id!=='string'||!/^[\w-]{1,80}$/.test(e.id)||ids.has(e.id)||!date(e.date)||!name(e.store)||!name(e.seller)||!int(e.cents,100000000000)||!int(e.orders,1000000)||!int(e.pieces,1000000)||(e.orders===0&&(e.cents>0||e.pieces>0)))fail();ids.add(e.id);}
 for(const g of d.goals){const key=g.month+'|'+g.store;if(!obj(g)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(g.month)||!name(g.store)||!int(g.cents,100000000000)||g.cents===0||keys.has(key))fail();keys.add(key);}
 return {version:1,entries:d.entries.map(({id,date,store,seller,cents,orders,pieces})=>({id,date,store,seller,cents,orders,pieces})),goals:d.goals.map(({month,store,cents})=>({month,store,cents}))};
}
