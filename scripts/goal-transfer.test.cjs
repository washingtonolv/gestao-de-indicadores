const assert = require('node:assert/strict');
const {exportCsv, prepareImport} = require('../beta/goal-transfer-core.js');

const sample = () => ({
  version: 1,
  entries: [{id: 'entry', date: '2026-10-08', store: 'Conceição', seller: 'Ana', cents: 100, orders: 1, pieces: 1}],
  goals: [{month: '2026-10', store: 'Conceição', cents: 10000}],
  admin: {
    stores: [{id: 'store-1', name: 'Conceição', active: true}, {id: 'store-2', name: 'Outra', active: true}],
    sellers: [{id: 'seller-1', storeId: 'store-1', name: 'Ana; "B"', active: true}],
    sellerGoals: [{sellerId: 'seller-1', month: '2026-10', cents: 20000}],
    sellerDailyGoals: [{sellerId: 'seller-1', date: '2026-10-09', cents: 3000}]
  }
});

const original = sample();
const csv = exportCsv(original);
assert.match(csv, /^\uFEFF"tipo";"mes";"data";"loja";"vendedor";"meta"/);
assert.match(csv, /"Ana; ""B"""/);
const roundtrip = prepareImport(csv, original);
assert.deepEqual(roundtrip.stats, {created: 0, updated: 0, unchanged: 3, total: 3});
assert.deepEqual(roundtrip.next, original);

const changed = csv.replace('"loja";"2026-10";"";"Conceição";"";"100,00"', '"loja";"2026-10";"";"Conceição";"";"125,50"')
  + '"individual";"2026-11";"";"Conceição";"Ana; ""B""";"250,00"\r\n';
const result = prepareImport(changed, original);
assert.deepEqual(result.stats, {created: 1, updated: 1, unchanged: 2, total: 4});
assert.equal(result.next.goals[0].cents, 12550);
assert.equal(result.next.admin.sellerGoals.length, 2);
assert.deepEqual(result.next.entries, original.entries);
assert.equal(original.goals[0].cents, 10000);

const onlyStore = csv.split('\r\n').filter(line => line.startsWith('"loja"'));
const partial = prepareImport(csv.split('\r\n')[0] + '\r\n' + onlyStore[0] + '\r\n', original);
assert.equal(partial.next.admin.sellerGoals.length, 1);
assert.equal(partial.next.admin.sellerDailyGoals.length, 1);

assert.throws(() => prepareImport(changed, original, 'store-2'), /sua loja/);
assert.throws(() => prepareImport(csv + csv.split('\r\n')[1] + '\r\n', original), /duplicada/);
assert.throws(() => prepareImport(csv.replace('Conceição', 'Inexistente'), original), /não cadastrada/);
assert.throws(() => prepareImport(csv.replace('"2026-10-09"', '"2026-10-40"'), original), /data inválida/);
assert.throws(() => prepareImport(csv.replace('"30,00"', '"0,00"'), original), /maior que zero/);
console.log('goal-transfer: ok');
