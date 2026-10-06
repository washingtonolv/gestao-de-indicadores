const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=n=>fs.readFileSync(path.join(__dirname,'../beta/'+n),'utf8');
const api=vm.runInNewContext(src('evolution-core.js')+';({evolutionTotals,evolutionPeriod,evolutionDelta,evolutionBuckets,workingWeekRanges})');
const clean=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(clean(api.evolutionTotals([{cents:10001,orders:2,pieces:3},{cents:99,orders:1,pieces:2}])),{sales:10100,orders:3,pieces:5});
const p=api.evolutionPeriod('2026-10','2026-10-04');assert.equal(p.cutoff,4);assert.equal(p.previous,'2026-09');assert.equal(p.previousCutoff,4);
assert.equal(api.evolutionPeriod('2026-01','2026-10-04').previous,'2025-12');assert.equal(api.evolutionPeriod('2024-02','2026-10-04').cutoff,29);
assert.equal(api.evolutionDelta(100,0),null);assert.equal(api.evolutionDelta(150,100),50);assert.equal(api.evolutionDelta(0,100),-100);
const rows=[{date:'2026-10-01',cents:100,orders:1,pieces:1},{date:'2026-10-04',cents:200,orders:1,pieces:1}];
assert.equal(api.evolutionBuckets(rows,'2026-10','day','2026-10-04').length,4);assert.equal(api.evolutionBuckets(rows,'2026-10','week','2026-10-04')[0].sales,300);assert.equal(api.evolutionBuckets(rows,'2026-10','month','2026-10-04')[5].sales,300);
const validate=vm.runInNewContext(src('beta-schema.js')+';validateDB');
let d=clean(validate({version:1,entries:[{id:'x',date:'2026-10-01',store:'Loja',seller:'Ana',cents:100,orders:1,pieces:1,updatedAt:'2026-10-04T12:00:00Z'}],goals:[]}));
d.admin.sellerGoals=[{sellerId:d.admin.sellers[0].id,month:'2026-10',cents:10000}];assert.deepEqual(clean(validate(d)),d);
const bad=clean(d);bad.admin.sellerGoals[0].sellerId='missing';assert.throws(()=>validate(bad));
const duplicate=clean(d);duplicate.admin.sellerGoals.push({...duplicate.admin.sellerGoals[0]});assert.throws(()=>validate(duplicate));
console.log('Evolution: totals, period boundaries, missing baseline, series, individual goals and timestamps passed.');

assert.deepEqual(clean(api.workingWeekRanges('2026-10')).map(({start,end})=>[start,end]),[[1,8],[9,16],[17,24],[25,31]]);
for(let year=2024;year<=2030;year++)for(let m=1;m<=12;m++){
 const month=year+'-'+String(m).padStart(2,'0'),last=new Date(year,m,0).getDate(),ranges=api.workingWeekRanges(month);
 let next=1;
 ranges.forEach((range,i)=>{assert.equal(range.start,next);next=range.end+1;const count=Array.from({length:range.end-range.start+1},(_,j)=>range.start+j).filter(day=>new Date(year,m-1,day).getDay()!==0).length;assert.equal(range.workingDays,count);assert.ok(count>0&&count<=7);if(i<ranges.length-1)assert.equal(count,7);});
 assert.equal(next,last+1);
 const daily=Array.from({length:last},(_,i)=>({date:month+'-'+String(i+1).padStart(2,'0'),cents:i+1,orders:1,pieces:1}));
 assert.equal(api.evolutionBuckets(daily,month,'week',year+'-12-31').reduce((sum,b)=>sum+b.sales,0),daily.reduce((sum,r)=>sum+r.cents,0));
}
console.log('Working weeks: October ranges, 84 calendars, leap years, no gaps and sales totals passed.');
