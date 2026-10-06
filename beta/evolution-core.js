// Calendar ranges span seven working days (Monday through Saturday).
// Sundays do not advance the counter; recorded sales remain in their date range.
function workingWeekRanges(month){
 const [year,monthNumber]=month.split('-').map(Number),last=new Date(year,monthNumber,0).getDate(),ranges=[];
 let start=1,workingDays=0;
 for(let day=1;day<=last;day++){
  if(new Date(year,monthNumber-1,day).getDay()!==0)workingDays++;
  if(workingDays===7){ranges.push({start,end:day,workingDays});start=day+1;workingDays=0;}
 }
 if(start<=last){if(workingDays===0&&ranges.length)ranges[ranges.length-1].end=last;else ranges.push({start,end:last,workingDays});}
 return ranges;
}
// Pure calculations shared by the UI and regression checks. Money remains in cents.
function evolutionTotals(rows){return rows.reduce((a,e)=>({sales:a.sales+e.cents,orders:a.orders+e.orders,pieces:a.pieces+e.pieces}),{sales:0,orders:0,pieces:0});}
function evolutionPeriod(month,today){
 const [y,m]=month.split('-').map(Number),current=today.slice(0,7),last=new Date(y,m,0).getDate();
 const previous=new Date(y,m-2,1),prevMonth=previous.getFullYear()+'-'+String(previous.getMonth()+1).padStart(2,'0');
 const cutoff=month===current?Number(today.slice(-2)):last,prevLast=new Date(y,m-1,0).getDate();
 return {month,previous:prevMonth,cutoff,previousCutoff:month===current?Math.min(cutoff,prevLast):prevLast,future:month>current};
}
function evolutionDelta(value,previous){return previous>0?(value-previous)/previous*100:null;}
function evolutionBuckets(rows,month,group,today){
 const p=evolutionPeriod(month,today),[y,m]=month.split('-').map(Number);
 if(group==='month')return Array.from({length:6},(_,i)=>{const d=new Date(y,m-6+i,1),key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');return {label:key.slice(5)+'/'+key.slice(2,4),sales:evolutionTotals(rows.filter(e=>e.date.startsWith(key)&&e.date<=today)).sales};});
 const ranges=group==='week'?workingWeekRanges(month).filter(r=>r.start<=p.cutoff).map(r=>({...r,end:Math.min(r.end,p.cutoff)})):Array.from({length:p.cutoff},(_,i)=>({start:i+1,end:i+1}));
 return ranges.map(({start,end})=>({label:group==='week'?`${start}–${end}`:String(start).padStart(2,'0'),sales:evolutionTotals(rows.filter(e=>e.date.startsWith(month)&&Number(e.date.slice(-2))>=start&&Number(e.date.slice(-2))<=end&&e.date<=today)).sales}));
}

function salesTrend(current,previous,hasHistory){
 if(!hasHistory)return {direction:'neutral',reason:'Sem histórico para comparação',percent:null};
 if(current===previous)return {direction:'neutral',reason:'Vendas iguais ao período anterior',percent:0};
 return {direction:current>previous?'up':'down',reason:current>previous?'Vendas aumentaram':'Vendas caíram',percent:previous>0?(current-previous)/previous*100:null};
}
