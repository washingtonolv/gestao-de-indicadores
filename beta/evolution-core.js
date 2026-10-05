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
 const count=group==='week'?Math.ceil(p.cutoff/7):p.cutoff;
 return Array.from({length:count},(_,i)=>{const start=group==='week'?i*7+1:i+1,end=group==='week'?Math.min(start+6,p.cutoff):start;return {label:group==='week'?`${start}–${end}`:String(start).padStart(2,'0'),sales:evolutionTotals(rows.filter(e=>e.date.startsWith(month)&&Number(e.date.slice(-2))>=start&&Number(e.date.slice(-2))<=end&&e.date<=today)).sales};});
}
