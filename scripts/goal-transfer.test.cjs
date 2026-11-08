const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
// The shared file runs as a browser script; load it the same way in tests.
// Requiring this .js file as CommonJS returns no exports in a type:module repo.
const testModule = {exports: {}};
vm.runInThisContext('(function(module){\n' + fs.readFileSync('beta/goal-transfer-core.js', 'utf8') + '\n})')(testModule);
const {exportCsv, prepareImport, templateCsv} = testModule.exports;

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
assert.deepEqual(roundtrip.stats, {created: 0, updated: 0, unchanged: 3, skipped: 0, total: 3});
assert.deepEqual(roundtrip.next, original);

const changed = csv.replace('"loja";"2026-10";"";"Conceição";"";"100,00"', '"loja";"2026-10";"";"Conceição";"";"125,50"')
  + '"individual";"2026-11";"";"Conceição";"Ana; ""B""";"250,00"\r\n';
const result = prepareImport(changed, original);
assert.deepEqual(result.stats, {created: 1, updated: 1, unchanged: 2, skipped: 0, total: 4});
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
// Modelo de importação: lojas e vendedores reais, meta em branco, e o próprio arquivo é aceito depois de preenchido.
const model = templateCsv(original, {month: '2026-11'});
assert.match(model, /^﻿"tipo";"mes";"data";"loja";"vendedor";"meta"\r\n/);
const modelLines = model.trim().split('\r\n').slice(1);
assert.equal(modelLines.length, 4); // 2 lojas + 1 vendedor + 1 meta diária de exemplo
assert.deepEqual(modelLines.map(line => line.split(';')[0]), ['"loja"', '"loja"', '"individual"', '"diaria"']);
assert.ok(modelLines.every(line => line.endsWith(';""')), 'a meta vem em branco');
assert.match(modelLines[3], /"2026-11-02"/); // 01/11/2026 é domingo
assert.throws(() => prepareImport(model, original), /Nenhuma meta preenchida/);
const filled = model.replace('"loja";"2026-11";"";"Conceição";"";""', '"loja";"2026-11";"";"Conceição";"";"1.500,50"')
  .replace('"individual";"2026-11";"";"Conceição";"Ana; ""B""";""', '"individual";"2026-11";"";"Conceição";"Ana; ""B""";"300,00"');
const fromModel = prepareImport(filled, original);
assert.deepEqual(fromModel.stats, {created: 2, updated: 0, unchanged: 0, skipped: 2, total: 2});
assert.equal(fromModel.next.goals.find(goal => goal.month === '2026-11').cents, 150050);
// Gestor só recebe a própria loja; sem lojas cadastradas o modelo traz exemplos preenchidos.
assert.equal(templateCsv(original, {month: '2026-11', storeId: 'store-2'}).trim().split('\r\n').length, 2);
const empty = {admin: {stores: [], sellers: [], sellerGoals: [], sellerDailyGoals: []}, goals: [], entries: []};
assert.match(templateCsv(empty, {month: '2026-11'}), /Loja Exemplo.*50000,00/);
assert.match(templateCsv(original, {month: 'inválido'}), /"20\d{2}-\d{2}"/);

// Formatos que o Excel gera ao salvar: "out/26", "10/2026", "01/10/2026" e datas dd/mm/aaaa.
const excel = csv.split('\r\n')[0] + '\r\n'
  + '"loja";"nov/26";"";"Conceição";"";"100,00"\r\n'
  + '"loja";"12/2026";"";"Conceição";"";"100,00"\r\n'
  + '"individual";"01/11/2026";"";"Conceição";"Ana; ""B""";"200,00"\r\n'
  + '"diaria";"nov/26";"05/11/2026";"Conceição";"Ana; ""B""";"30,00"\r\n';
const excelResult = prepareImport(excel, original);
assert.deepEqual(excelResult.stats, {created: 4, updated: 0, unchanged: 0, skipped: 0, total: 4});
assert.ok(excelResult.next.goals.some(goal => goal.month === '2026-12'));
assert.ok(excelResult.next.admin.sellerDailyGoals.some(goal => goal.date === '2026-11-05'));
assert.throws(() => prepareImport(csv.split('\r\n')[0] + '\r\n"loja";"xyz/26";"";"Conceição";"";"100,00"\r\n', original), /mês inválido/);
console.log('goal-transfer: ok');
