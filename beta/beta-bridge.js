(()=>{
 const frame=document.getElementById('codex-visualization'),key='gestao-indicadores:beta:v1';
 const empty=()=>({version:1,entries:[],goals:[]});
 function read(){const raw=localStorage.getItem(key);if(!raw)return {revision:0,data:empty()};const s=JSON.parse(raw);if(!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Dados locais inválidos. Restaure um backup antes de continuar.');return {revision:s.revision,data:validateDB(s.data)};}
 function reply(id,result){frame.contentWindow.postMessage({type:'gi-beta-result',id,...result},'*');}
 window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||e.origin!=='null'||e.data?.type!=='gi-beta-request')return;
  const {id,op,payload}=e.data;if(!Number.isSafeInteger(id))return;
  try{
   if(op==='read'){const state=read();const probe=key+':probe';localStorage.setItem(probe,'1');localStorage.removeItem(probe);reply(id,{ok:true,...state});}
   else if(op==='save'){
    const current=read();if(payload?.revision!==current.revision)throw Error('Os dados mudaram em outra aba. Recarregue o painel antes de salvar.');
    const data=validateDB(payload.data),state={revision:current.revision+1,data};const raw=JSON.stringify(state);if(raw.length>2000000)throw Error('Limite local atingido. Baixe um backup.');localStorage.setItem(key,raw);reply(id,{ok:true,...state});
   }else if(op==='export'){
    const current=read();const blob=new Blob([JSON.stringify({...current.data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='gestao-indicadores-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);reply(id,{ok:true});
   }
  }catch(err){reply(id,{ok:false,error:err.name==='QuotaExceededError'?'Não foi possível salvar: armazenamento cheio. Baixe um backup e libere espaço.':err.name==='SecurityError'?'O navegador bloqueou o armazenamento. Abra em uma janela normal e permita dados do site.':err.message});}
 });
 window.addEventListener('storage',e=>{if(e.key===key)frame.contentWindow?.postMessage({type:'gi-beta-changed'},'*');});
})();
