(()=>{
 const frame=document.getElementById('codex-visualization');
 function reply(id,result){frame.contentWindow.postMessage({type:'gi-beta-result',id,...result},'*');}
 window.addEventListener('message',async e=>{
  if(e.source!==frame.contentWindow||e.origin!=='null'||e.data?.type!=='gi-beta-request')return;
  const {id,op,payload}=e.data;if(!Number.isSafeInteger(id))return;
  try{
   if(!await GICloud.ready)throw Error('Entre na sua conta para carregar os dados.');
   if(op==='read')reply(id,{ok:true,...await GICloud.read()});
   else if(op==='save')reply(id,{ok:true,...await GICloud.save({...payload,data:validateDB(payload.data)})});
   else if(op==='create-account')reply(id,{ok:true,...await GICloud.createAccount(payload)});
   else if(op==='export'){const state=await GICloud.read();GICloud.download({...state.data,exportedAt:new Date().toISOString()},'gestao-indicadores-nuvem.json');reply(id,{ok:true,...state});}
   else throw Error('Operação indisponível.');
  }catch(err){reply(id,{ok:false,error:err.message||'Não foi possível conectar. Atualize os dados.'});}
 });
})();
