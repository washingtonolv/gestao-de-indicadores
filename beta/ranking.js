let rankingMode='sellers',rankingMonth='';
const rankingCriteria={attainment:'Atingimento da meta',sales:'Vendas líquidas',ticket:'Ticket médio',pa:'P.A.'};
function rankingFilters(){return {month:$('#month').value,store:$('#store').value,mode:rankingMode,criterion:$('#ranking-criterion').value,week:$('#ranking-week').value};}
function rankingMetric(row,criterion){return criterion==='attainment'?num(Number(row.score)/100)+'%':criterion==='sales'?money(row.cents):criterion==='ticket'?money(Number(row.score)):num(Number(row.score)/100);}
function renderRanking(){
 const manager=cloudProfile?.role==='manager',month=$('#month').value;
 if(manager)rankingMode='sellers';
 all('[data-ranking-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.rankingMode===rankingMode));button.hidden=manager&&button.dataset.rankingMode==='stores';});
 if(rankingMonth!==month){$('#ranking-week').innerHTML='<option value="">Mês completo</option>'+rankingWeeks(month).map((r,i)=>`<option value="${r.start}|${r.end}">Semana ${i+1} · dias ${r.start}–${r.end}</option>`).join('');rankingMonth=month;}
 const exporting=!!$('#ranking-export').dataset.exporting;
 $('#ranking-export').disabled=!ready||demo||exporting||cloudProfile?.role==='seller';
 if(!cloudProfile&&!demo){$('#ranking-notice').textContent='Carregando os resultados do ranking…';return;}
 try{
  const report=rankingReport(evoData(),rankingFilters(),today,demo?{role:'admin'}:cloudProfile),criterion=report.criterion;
  $('#ranking-period').textContent=(report.week?'Semana':'Mês')+' · '+batchDateLabel(report.start)+' a '+batchDateLabel(report.end)+(report.partial?' · período em andamento':'');
  $('#ranking-scope').textContent=manager?'Vendedores da sua loja. A comparação entre lojas está disponível ao administrador.':report.mode==='stores'?'Comparação das lojas disponíveis nos filtros acima.':'Vendedores das lojas selecionadas. Resultados de uma pessoa em lojas diferentes são classificados separadamente.';
  $('#ranking-goal-note').textContent=report.goalNote;
  $('#ranking-updated').textContent=report.updatedAt?'Última atualização dos registros: '+new Date(report.updatedAt).toLocaleString('pt-BR'):'Ainda não há horário de atualização dos resultados deste período.';
  const messages=[];
  if(report.future)messages.push('Período futuro: ainda não há resultados para classificar.');
  else if(!report.records.length)messages.push('Nenhum lançamento neste período. As posições aparecerão quando os resultados forem registrados.');
  else if(report.partial)messages.push('Ranking parcial. Lançamentos podem estar em estágios diferentes de preenchimento; confira a atualização dos resultados antes de comparar.');
  if(report.excludedEntries)messages.push(`${report.excludedEntries} acumulado(s) abrangem datas fora deste intervalo e não foram divididos artificialmente. Consulte a evolução para o período completo.`);
  if(criterion==='attainment')messages.push('Sem meta: aparece na lista, sem posição por atingimento.');
  $('#ranking-notice').textContent=messages.join(' ');$('#ranking-notice').hidden=!messages.length;
  $('#ranking-export').disabled=!ready||demo||exporting||report.future||cloudProfile?.role==='seller';

 const rankTiers={1:['#F5C12E','#EFAA00','#F9D678'],2:['#CDD5DF','#A4AEBB','#EEF2F6'],3:['#D4915A','#B5713B','#EBC09C']};
 const trophySvg=rank=>{const [main,dark,light]=rankTiers[rank]||rankTiers[1];return `<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M130 63H70Q31 63 31 105Q31 190 140 240M382 63H442Q481 63 481 105Q481 190 372 240" fill="none" stroke="${dark}" stroke-width="22" stroke-linecap="round"/><rect x="244" y="310" width="24" height="76" fill="${dark}"/><rect x="160" y="372" width="192" height="56" rx="30" fill="${main}"/><path d="M107 478Q107 405 190 405H322Q405 405 405 478Q405 490 393 490H119Q107 490 107 478Z" fill="${dark}"/><path d="M118 28Q118 20 126 20H386Q394 20 394 28V180Q394 320 256 320Q118 320 118 180Z" fill="${main}"/><polygon points="256,94 278,145 334,151 292,188 304,242 256,214 208,242 220,188 178,151 234,145" fill="${light}" stroke="${light}" stroke-width="12" stroke-linejoin="round"/></svg>`;};
 const medalTiers={1:['#EFC55D','#D8B254','#E25B4C','#C0392B'],2:['#D3DAE3','#AAB3BF','#5B8DEF','#3F6FD1'],3:['#D99A62','#B8763F','#4FA67A','#388A60']};
 const medalSvg=rank=>{const [fill,ring,r1,r2]=medalTiers[rank]||['#CBD2DA','#AEB6C0','#98A2AE','#7E8995'];return `<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M330 0H472L345 182L255 160Z" fill="${r2}"/><path d="M40 0H190L300 165L170 190Z" fill="${r1}"/><circle cx="264" cy="336" r="176" fill="${fill}"/><circle cx="264" cy="336" r="112" fill="none" stroke="${ring}" stroke-width="32"/></svg>`;};
 const rankIcon=rank=>medalSvg(rank);
  $('#ranking-podium').innerHTML=report.rows.filter(r=>r.rank!==null).slice(0,3).map(r=>`<article class="card ranking-highlight rank-${Math.min(r.rank,3)}"><span class="ranking-medal" aria-label="Posição ${r.rank}">${r.rank}º</span><span class="ranking-trophy" aria-hidden="true">${trophySvg(Math.min(r.rank,3))}</span><span class="ranking-highlight-label">${esc(rankingCriteria[criterion])}</span><h2>${esc(r.name)}</h2>${report.mode==='sellers'?`<p>${esc(r.storeName)}</p>`:''}<strong>${esc(rankingMetric(r,criterion))}</strong><small>${money(r.cents)} em vendas</small></article>`).join('');
  $('#ranking-name-head').textContent=report.mode==='stores'?'Loja':'Vendedor / Loja';
  $('#ranking-count').textContent=`${report.rows.length} participante(s) · ${report.rankedCount} com posição · ${rankingCriteria[criterion]}`;
  $('#ranking-body').innerHTML=report.rows.map(r=>`<tr><td data-label="Posição"><span class="ranking-position">${r.rank===null?'':`<span class="ranking-icon">${rankIcon(r.rank)}</span>`}${r.rank===null?'—':r.rank+'º'}</span>${r.reason?`<small class="ranking-reason">${esc(r.reason)}</small>`:''}</td><td class="ranking-person"><strong>${esc(r.name)}</strong>${report.mode==='sellers'?`<small>${esc(r.storeName)}</small>`:''}${r.active?'':'<small>Arquivado · resultado histórico</small>'}</td><td data-label="Vendas líquidas">${money(r.cents)}</td><td data-label="Meta do período">${r.goal?money(r.goal):'Sem meta'}</td><td data-label="Atingimento">${r.attainment===null?'—':num(r.attainment)+'%'}</td><td data-label="Ticket médio">${r.tm===null?'—':money(Math.round(r.tm))}</td><td data-label="P.A.">${r.pa===null?'—':num(r.pa)}</td><td data-label="Atendimentos">${num(r.orders)}</td><td data-label="Peças">${num(r.pieces)}</td><td class="ranking-action"><button type="button" data-ranking-detail="${r.id}" data-ranking-store="${esc(r.storeName)}" data-ranking-kind="${report.mode}">Ver evolução</button></td></tr>`).join('')||'<tr><td colspan="10">Nenhum participante disponível para estes filtros.</td></tr>';
  $('#ranking-totals').innerHTML=batchTotalMarkup(report.totals);$('#ranking-totals').setAttribute('aria-label','Totais dos participantes, com ticket médio e P.A. ponderados');
 }catch(error){$('#ranking-notice').hidden=false;$('#ranking-notice').textContent=error.message;$('#ranking-podium').replaceChildren();$('#ranking-body').replaceChildren();$('#ranking-totals').replaceChildren();$('#ranking-count').textContent='';$('#ranking-export').disabled=true;}
}
$('#ranking-week').onchange=()=>{$('#ranking-export-status').textContent='';renderRanking();};
$('#ranking-criterion').onchange=()=>{$('#ranking-export-status').textContent='';renderRanking();};
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.rankingMode){rankingMode=button.dataset.rankingMode;$('#ranking-export-status').textContent='';renderRanking();root.dispatchEvent(new CustomEvent('gi-view-changed'));}
 if(button.dataset.rankingDetail){$('#store').value=button.dataset.rankingStore;$('#evo-mode').value='team';$('#evo-seller').value='';render();if(button.dataset.rankingKind==='sellers'){$('#evo-seller').value=button.dataset.rankingDetail;}show('evolution');}
});
$('#ranking-export').onclick=async()=>{
 const button=$('#ranking-export');if(button.disabled||button.dataset.exporting)return;
 button.dataset.exporting='true';button.disabled=true;button.textContent='Preparando Excel…';$('#ranking-export-status').textContent='';
 try{await request('export-ranking',rankingFilters());$('#ranking-export-status').textContent='Planilha preparada. Confira o arquivo XLSX nos downloads.';}
 catch(error){$('#ranking-export-status').textContent=error.message;}
 finally{delete button.dataset.exporting;button.textContent='Exportar Excel';renderRanking();}
};
