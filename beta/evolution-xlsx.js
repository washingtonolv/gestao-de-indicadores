import ExcelJS from 'exceljs/dist/exceljs.min.js';
import {evolutionReport} from './evolution-export.js';
const currency='"R$" #,##0.00;[Red]("R$" #,##0.00);"R$" 0.00';
const rate='0.00;[Red](0.00);0.00';
const integer='#,##0;[Red](#,##0);0';
const color={blue:'FF2563EB',dark:'FF1F2937',muted:'FF6B7280',line:'FFE5E7EB',pale:'FFEFF6FF',white:'FFFFFFFF'};
const formula=(expression,result)=>({formula:expression,result});
function baseSheet(book,name,title,report,widths){
 const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:6}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 s.columns=widths.map(width=>({width}));
 const month=new Date(report.month+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}),cutoff=report.cutoff.split('-').reverse().join('/');
 for(const [n,text] of [[1,title],[2,'Período: '+month+' · Resultados até '+cutoff],[3,'Loja: '+report.store+' · Vendedor: '+report.seller],[4,'Ticket médio = vendas ÷ atendimentos. P.A. = peças ÷ atendimentos. Sem atendimentos: indicador indisponível.']]){s.mergeCells(n,1,n,widths.length);s.getCell(n,1).value=text;s.getRow(n).height=n===1?32:n===3||n===4?32:24;s.getCell(n,1).alignment={vertical:'middle',wrapText:true};s.getCell(n,1).font={name:'Calibri',size:n===1?20:11,bold:n===1,color:{argb:n===1?color.dark:color.muted}};}
 return s;
}
function rowStyle(row,{header=false,total=false,section=false}={}){
 row.height=header?30:section?28:26;
 if(!header&&!section)for(const col of [1,2])row.height=Math.max(row.height,Math.ceil(row.getCell(col).text.length/(row.worksheet.getColumn(col).width*.9))*13+10);
 row.eachCell({includeEmpty:true},(cell,col)=>{cell.font={name:'Calibri',size:11,bold:header||total||section,color:{argb:header?color.white:color.dark}};cell.alignment={vertical:'middle',horizontal:col<=2?'left':'right',wrapText:col<=2};cell.border={bottom:{style:total?'thin':'hair',color:{argb:color.line}}};if(header||total||section)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:header?color.blue:color.pale}};});
}
function metricRow(sheet,values,numbers,{total=false}={}){
 const row=sheet.addRow(values),n=row.number;
 row.getCell(4).value=formula(`IF(F${n}=0,"—",C${n}/F${n})`,numbers.orders?numbers.cents/100/numbers.orders:'—');
 row.getCell(5).value=formula(`IF(F${n}=0,"—",G${n}/F${n})`,numbers.orders?numbers.pieces/numbers.orders:'—');
 for(const c of [3,4])row.getCell(c).numFmt=currency;row.getCell(5).numFmt=rate;for(const c of [6,7])row.getCell(c).numFmt=integer;
 rowStyle(row,{total});return row;
}
export async function createEvolutionWorkbook(snapshot,filters,today){
 const report=evolutionReport(snapshot.data,filters,today,snapshot.profile);
 const book=new ExcelJS.Workbook();book.creator='Gestão de indicadores';book.created=new Date();book.calcProperties.fullCalcOnLoad=true;
 const summary=baseSheet(book,'Resumo por loja','Evolução das vendas por loja',report,[28,24,22,20,14,18,16]);
 const detail=baseSheet(book,'Vendedores','Resultados dos vendedores',report,[28,52,22,20,14,18,16]);
 const source=baseSheet(book,'Lançamentos','Lançamentos do período',report,[16,16,22,28,52,22,18,16]);
 const headings=['Loja','Vendedor','Vendas líquidas (R$)','Ticket médio (R$)','P.A.','Atendimentos','Peças vendidas'];
 rowStyle(summary.addRow([]));rowStyle(detail.addRow([]));rowStyle(source.addRow([]));
 rowStyle(summary.addRow(['Loja','Vendedores',...headings.slice(2)]),{header:true});rowStyle(detail.addRow(headings),{header:true});
 const sourceHead=source.addRow(['Início','Fim','Tipo','Loja','Vendedor','Vendas líquidas (R$)','Atendimentos','Peças vendidas']);rowStyle(sourceHead,{header:true});for(const c of [1,2,3,4,5])sourceHead.getCell(c).alignment={horizontal:'left',vertical:'middle'};
 const refs=[];
 for(const g of report.groups){
  const section=detail.addRow([g.name]);detail.mergeCells(section.number,1,section.number,7);rowStyle(section,{section:true});section.getCell(1).alignment={horizontal:'left',vertical:'middle'};
  const first=detail.rowCount+1;
  for(const p of g.sellers)metricRow(detail,[g.name,p.name,p.cents/100,null,null,p.orders,p.pieces],p);
  const last=detail.rowCount;
  const values=[g.name,'TOTAL DA LOJA',g.cents/100,null,null,g.orders,g.pieces];
  const subtotal=metricRow(detail,values,g,{total:true});
  if(g.sellers.length)for(const c of [3,6,7]){const letter=detail.getColumn(c).letter;subtotal.getCell(c).value=formula(`SUM(${letter}${first}:${letter}${last})`,values[c-1]);}
  refs.push(subtotal.number);
  const row=metricRow(summary,[g.name,g.sellers.length,g.cents/100,null,null,g.orders,g.pieces],g);
  for(const c of [3,6,7])row.getCell(c).value=formula(`'Vendedores'!${detail.getColumn(c).letter}${subtotal.number}`,values[c-1]);
  detail.addRow([]);
 }
 const end=summary.rowCount,grand=metricRow(summary,['TOTAL GERAL',report.groups.reduce((n,g)=>n+g.sellers.length,0),report.totals.cents/100,null,null,report.totals.orders,report.totals.pieces],report.totals,{total:true});
 if(report.groups.length)for(const c of [2,3,6,7])grand.getCell(c).value=formula(`SUM(${summary.getColumn(c).letter}7:${summary.getColumn(c).letter}${end})`,grand.getCell(c).value);
 const all=metricRow(detail,['TOTAL GERAL',null,report.totals.cents/100,null,null,report.totals.orders,report.totals.pieces],report.totals,{total:true});
 if(refs.length)for(const c of [3,6,7])all.getCell(c).value=formula(`SUM(${refs.map(n=>detail.getColumn(c).letter+n).join(',')})`,all.getCell(c).value);
 for(const e of report.records){const row=source.addRow([new Date((e.periodStart||e.date)+'T12:00:00Z'),new Date(e.date+'T12:00:00Z'),e.periodStart?'Semanal acumulado':'Diário',e.store,e.seller,e.cents/100,e.orders,e.pieces]);rowStyle(row);for(const c of [1,2])row.getCell(c).numFmt='dd/mm/yyyy';row.getCell(6).numFmt=currency;for(const c of [7,8])row.getCell(c).numFmt=integer;for(const c of [3,4,5])row.getCell(c).alignment={vertical:'middle',wrapText:true,horizontal:'left'};row.height=Math.max(34,...[4,5].map(c=>Math.ceil(row.getCell(c).text.length/(source.getColumn(c).width*.9))*13+10));}
 if(!report.records.length){const r=source.addRow(['Sem lançamentos no período.']);source.mergeCells(r.number,1,r.number,8);}
 source.autoFilter={from:'A6',to:'H'+Math.max(6,source.rowCount)};
 summary.autoFilter={from:'A6',to:'G'+Math.max(6,end)};
 const note=source.addRow(['Lançamentos semanais incluem o acumulado registrado até agora, mesmo quando o bloco ainda não terminou.']);source.mergeCells(note.number,1,note.number,8);note.height=32;note.getCell(1).alignment={wrapText:true};note.getCell(1).font={name:'Calibri',size:11,color:{argb:color.muted}};
 return {book,report};
}
export async function downloadEvolution(snapshot,filters,today){
 const {book}=await createEvolutionWorkbook(snapshot,filters,today);
 const bytes=await book.xlsx.writeBuffer();
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download='evolucao-'+filters.month+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
