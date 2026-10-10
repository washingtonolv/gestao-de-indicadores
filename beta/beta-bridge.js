(()=>{
 const frame=document.getElementById('codex-visualization');
 function reply(id,result){frame.contentWindow.postMessage({type:'gi-beta-result',id,...result},'*');}
 function downloadGoals(csv){
  if(typeof csv!=='string'||csv.length>2000000||!csv.startsWith('\uFEFF"tipo";"mes";"data";"loja";"vendedor";"meta"'))throw Error('Arquivo de metas inválido.');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const day=new Date(),stamp=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
  const link=document.createElement('a');link.href=url;link.download='metas-'+stamp+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 window.addEventListener('message',async e=>{
  if(e.source!==frame.contentWindow||e.origin!=='null'||e.data?.type!=='gi-beta-request')return;
  const {id,op,payload}=e.data;if(!Number.isSafeInteger(id))return;
  try{
   if(!await GICloud.ready)throw Error('Entre na sua conta para carregar os dados.');
   if(op==='read')reply(id,{ok:true,...await GICloud.read()});
   else if(op==='save')reply(id,{ok:true,...await GICloud.save({...payload,data:validateDB(payload.data)})});
   else if(op==='create-account')reply(id,{ok:true,...await GICloud.createAccount(payload)});
   else if(op==='download-goals'){downloadGoals(payload?.csv);reply(id,{ok:true});}
   else if(op==='export'){const state=await GICloud.read();GICloud.download({...state.data,exportedAt:new Date().toISOString()},'gestao-indicadores-nuvem.json');reply(id,{ok:true,...state});}
   else throw Error('Operação indisponível.');
  }catch(err){reply(id,{ok:false,error:err.message||'Não foi possível conectar. Atualize os dados.'});}
 });
})();
