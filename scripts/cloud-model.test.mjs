import assert from 'node:assert/strict';
import {toLocal,changesFor,tables} from '../beta/cloud-model.js';
const stamp='2026-10-04T23:00:00Z';
const base={gi_stores:[{id:'store',name:'Centro',active:true,updated_at:stamp}],gi_sellers:[{id:'seller',name:'Ana',store_id:'store',active:true,updated_at:stamp}],gi_entries:[{id:'entry',store_id:'store',seller_id:'seller',date:'2026-10-01',cents:1000,orders:2,pieces:3,updated_at:stamp}],gi_store_goals:[{id:'goal',store_id:'store',month:'2026-10-01',cents:5000,updated_at:stamp}],gi_seller_goals:[{id:'sg',seller_id:'seller',store_id:'store',month:'2026-10-01',cents:2000,updated_at:stamp}],gi_seller_daily_goals:[{id:'dg',seller_id:'seller',store_id:'store',date:'2026-10-08',cents:1000,updated_at:stamp}]};
const local=toLocal(base);
assert.equal(local.entries[0].seller,'Ana');assert.equal(local.goals[0].month,'2026-10');assert.deepEqual(local.admin.sellerDailyGoals,[{sellerId:'seller',date:'2026-10-08',cents:1000}]);
assert.deepEqual(changesFor(local,base),[]);
const changed=structuredClone(local);changed.entries[0].cents=1500;
const delta=changesFor(changed,base);assert.equal(delta.length,1);assert.equal(delta[0].action,'update');assert.equal(delta[0].expected,stamp);
const dailyChanged=structuredClone(local);dailyChanged.admin.sellerDailyGoals[0].cents=1200;const dailyDelta=changesFor(dailyChanged,base);assert.equal(dailyDelta.length,1);assert.equal(dailyDelta[0].table,'gi_seller_daily_goals');assert.equal(dailyDelta[0].action,'update');
const dailyAdded=structuredClone(local);dailyAdded.admin.sellerDailyGoals.push({sellerId:'seller',date:'2026-10-09',cents:900});assert.equal(changesFor(dailyAdded,base,()=> 'new-daily')[0].row.id,'new-daily');
const renamed=structuredClone(local);renamed.admin.stores[0].name='Centro novo';renamed.entries[0].store='Centro novo';renamed.goals[0].store='Centro novo';
assert.equal(changesFor(renamed,base).length,1); // Renames preserve result FKs.
const removed=structuredClone(local);removed.entries=[];assert.equal(changesFor(removed,base)[0].action,'delete');
const added=structuredClone(local);added.goals.push({store:'Centro',month:'2026-11',cents:5000});assert.equal(changesFor(added,base,()=> 'new-goal')[0].row.id,'new-goal');
const wrong=structuredClone(local);wrong.admin.users.push({});assert.throws(()=>changesFor(wrong,base),/Supabase/);
assert.deepEqual(toLocal(Object.fromEntries(tables.map(t=>[t,[]]))).entries,[]);
console.log('Cloud model: round-trip, minimal changes, FK-preserving rename, conflict timestamp and account guard passed.');
