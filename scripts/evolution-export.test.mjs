import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {evolutionReport} from '../beta/evolution-export.js';
import {createEvolutionWorkbook} from '../beta/evolution-xlsx.js';
const data={admin:{stores:[{id:'s1',name:'Centro'},{id:'s2',name:'Norte'}],sellers:[{id:'p1',name:'Ana',storeId:'s1'},{id:'p2',name:'Bia',storeId:'s1'},{id:'p3',name:'Ana',storeId:'s2'},{id:'p4',name:'Sem vendas',storeId:'s2'}]},entries:[
 {store:'Centro',seller:'Ana',date:'2026-10-01',cents:10000,orders:2,pieces:4},
 {store:'Centro',seller:'Bia',date:'2026-10-16',periodStart:'2026-10-09',cents:30000,orders:10,pieces:15},
 {store:'Norte',seller:'Ana',date:'2026-10-02',cents:60000,orders:3,pieces:9},
 {store:'Centro',seller:'Ana',date:'2026-10-11',cents:999999,orders:1,pieces:1},
 {store:'Centro',seller:'Ana',date:'2026-09-01',cents:999999,orders:1,pieces:1}
]};
const profile={role:'admin'},filters={month:'2026-10'},today='2026-10-10';
const r=evolutionReport(data,filters,today,profile);
assert.deepEqual(r.totals,{cents:100000,orders:15,pieces:28});
assert.equal(r.groups[0].sellers[0].name,'Bia');
assert.equal(r.groups[1].sellers[1].cents,0);
assert.equal(r.records.length,3);assert.equal(r.cutoff,today);
assert.equal(evolutionReport(data,{...filters,store:'centro'},today,profile).totals.cents,40000);
assert.equal(evolutionReport(data,{...filters,sellerId:'p1'},today,profile).totals.cents,10000);
assert.equal(evolutionReport(data,filters,today,{role:'manager',storeId:'s1'}).totals.cents,40000);
assert.equal(evolutionReport(data,filters,today,{role:'seller',storeId:'s2',sellerId:'p3'}).totals.cents,60000);
assert.throws(()=>evolutionReport(data,{...filters,store:'Norte'},today,{role:'manager',storeId:'s1'}));
assert.throws(()=>evolutionReport(data,{...filters,sellerId:'p1'},today,{role:'seller',storeId:'s2',sellerId:'p3'}));
assert.throws(()=>evolutionReport(data,{month:'2026-11'},today,profile));
assert.throws(()=>evolutionReport(data,{month:'bad'},today,profile));
const {book}=await createEvolutionWorkbook({data,profile},filters,today);
const bytes=await book.xlsx.writeBuffer();assert.equal(Buffer.from(bytes).subarray(0,2).toString(),'PK');
const saved=new ExcelJS.Workbook();await saved.xlsx.load(bytes);
assert.deepEqual(saved.worksheets.map(s=>s.name),['Resumo por loja','Vendedores','Lançamentos']);
const summary=saved.getWorksheet('Resumo por loja'),details=saved.getWorksheet('Vendedores'),source=saved.getWorksheet('Lançamentos');
const totalRow=summary.getRow(9);assert.equal(totalRow.getCell(1).value,'TOTAL GERAL');
assert.equal(totalRow.getCell(3).value.result,1000);
assert.equal(totalRow.getCell(6).value.result,15);
assert.equal(totalRow.getCell(4).value.result,1000/15);
assert.equal(totalRow.getCell(5).value.result,28/15);
assert.equal(summary.getRow(7).getCell(3).value.result,400);
assert.match(summary.getRow(7).getCell(3).value.formula,/'Vendedores'!C/);
assert.equal(details.getRow(8).getCell(2).value,'Bia');
const zero=details.getColumn(2).values.indexOf('Sem vendas');assert.equal(details.getRow(zero).getCell(4).value.result,'—');
assert.equal(source.getRow(7).getCell(1).value instanceof Date,true);
assert.equal(source.getRow(8).getCell(3).value,'Semanal acumulado');
assert.equal(summary.views[0].ySplit,6);assert.equal(summary.getRow(7).getCell(3).numFmt.includes('R$'),true);
const malicious=structuredClone(data);malicious.admin.sellers[0].name='=HYPERLINK("bad")';malicious.entries[0].seller=malicious.admin.sellers[0].name;
const safe=await createEvolutionWorkbook({data:malicious,profile},filters,today);const cell=safe.book.getWorksheet('Vendedores').getRow(9).getCell(2);assert.equal(cell.type,ExcelJS.ValueType.String);
const empty=await createEvolutionWorkbook({data:{...data,entries:[]},profile},filters,today);assert.equal(empty.report.totals.cents,0);
console.log('Evolution XLSX: filters, permissions, weekly partials, rankings, weighted rates, totals, zero results, typed dates/text and XLSX round-trip passed.');
