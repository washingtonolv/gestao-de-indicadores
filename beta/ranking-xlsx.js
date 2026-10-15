import ExcelJS from 'exceljs/dist/exceljs.min.js';
import {rankingReport} from './ranking-core.js';
function excelBrasiliaDate(timestamp){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
 return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second)));
}
export async function createRankingWorkbook(snapshot,filters,today){
 const report=rankingReport(snapshot.data,filters,today,snapshot.profile);
 if(report.future)throw Error('Escolha um período com resultados realizados.');
 const book=new ExcelJS.Workbook();book.creator='Gestão de indicadores';book.created=new Date();book.calcProperties.fullCalcOnLoad=true;
 const sheet=book.addWorksheet('Ranking',{views:[{state:'frozen',ySplit:7}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
 sheet.columns=[12,52,26,22,22,18,20,14,18,16,24,24].map(width=>({width}));
 const criteria={attainment:'Atingimento da meta',sales:'Vendas líquidas',ticket:'Ticket médio',pa:'P.A.'},day=value=>value.split('-').reverse().join('/');
 const lines=[`Ranking de ${report.mode==='stores'?'lojas':'vendedores'} · ${criteria[report.criterion]}`,`${day(report.start)} a ${day(report.end)} · ${report.store}${report.partial?' · período em andamento':''}`,report.goalNote,'Empates compartilham posição, com duas casas decimais. Sem lançamentos: sem posição. TM = vendas ÷ atendimentos. P.A. = peças ÷ atendimentos.',report.updatedAt?'Última atualização (horário de Brasília): '+new Date(report.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem horário de atualização disponível.',report.excludedEntries?`${report.excludedEntries} acumulado(s) fora do intervalo exato foram excluídos; não são distribuídos artificialmente.`:'Valores correspondem aos lançamentos registrados para o período e filtros selecionados.'];
 lines.forEach((text,i)=>{sheet.mergeCells(i+1,1,i+1,12);const cell=sheet.getCell(i+1,1);cell.value=text;cell.font={name:'Calibri',size:i===0?20:11,bold:i===0,color:{argb:i===0?'FF1F2937':'FF4D4D4D'}};cell.alignment={vertical:'middle',wrapText:true};sheet.getRow(i+1).height=i===0?34:28;});
 const header=sheet.addRow(['Posição','Nome','Loja','Vendas líquidas (R$)','Meta do período (R$)','Atingimento','Ticket médio (R$)','P.A.','Atendimentos','Peças','Situação','Última atualização']);
 header.height=32;header.eachCell(cell=>{cell.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2563EB'}};cell.alignment={vertical:'middle',wrapText:true};});
 const money='"R$" #,##0.00;[Red]("R$" #,##0.00);"R$" 0.00',formula=(expression,result)=>({formula:expression,result});
 function style(row,total=false){row.height=Math.max(30,Math.ceil(row.getCell(2).text.length/44)*14+10);row.eachCell({includeEmpty:true},(cell,i)=>{cell.font={name:'Calibri',size:11,bold:total,color:{argb:'FF1F2937'}};cell.alignment={vertical:'middle',horizontal:i>=4&&i<=10?'right':'left',wrapText:i===2||i===3||i===11};cell.border={bottom:{style:'hair',color:{argb:'FFE5E7EB'}}};if(total)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFF6FF'}};});for(const col of [4,5,7])row.getCell(col).numFmt=money;row.getCell(6).numFmt='0.00%';row.getCell(8).numFmt='0.00';for(const col of [9,10])row.getCell(col).numFmt='#,##0';row.getCell(12).numFmt='dd/mm/yyyy hh:mm';}
 for(const r of report.rows){
  const row=sheet.addRow([r.rank??'—',r.name,r.storeName,r.cents/100,r.goal===null?null:r.goal/100,null,null,null,r.orders,r.pieces,r.reason||(r.goal?'Classificado':'Classificado · sem meta'),r.updatedAt?excelBrasiliaDate(r.updatedAt):null]),n=row.number;
  row.getCell(6).value=r.attainment===null?'—':formula(`IF(E${n}=0,"—",D${n}/E${n})`,r.attainment/100);
  row.getCell(7).value=formula(`IF(I${n}=0,"—",D${n}/I${n})`,r.tm===null?'—':r.tm/100);
  row.getCell(8).value=formula(`IF(I${n}=0,"—",J${n}/I${n})`,r.pa===null?'—':r.pa);style(row);
 }
 const last=sheet.rowCount,total=sheet.addRow([null,'TOTAL DOS PARTICIPANTES',null,report.totals.cents/100,report.rows.reduce((n,r)=>n+(r.goal||0),0)/100,null,null,null,report.totals.orders,report.totals.pieces,'TM e P.A. ponderados']);
 const n=total.number;if(report.rows.length)for(const col of [4,5,9,10])total.getCell(col).value=formula(`SUM(${sheet.getColumn(col).letter}8:${sheet.getColumn(col).letter}${last})`,total.getCell(col).value);
 const allGoals=report.rows.length>0&&report.rows.every(r=>r.goal),goals=report.rows.reduce((sum,r)=>sum+(r.goal||0),0);
 total.getCell(6).value=allGoals?formula(`IF(E${n}=0,"—",D${n}/E${n})`,report.totals.cents/goals):'—';
 total.getCell(7).value=formula(`IF(I${n}=0,"—",D${n}/I${n})`,report.totals.orders?report.totals.cents/100/report.totals.orders:'—');
 total.getCell(8).value=formula(`IF(I${n}=0,"—",J${n}/I${n})`,report.totals.orders?report.totals.pieces/report.totals.orders:'—');style(total,true);
 sheet.autoFilter={from:'A7',to:'L'+Math.max(7,last)};
 const note=sheet.addRow(['Meta total soma apenas as metas definidas. Atingimento total indisponível se houver participante sem meta. A ordem e as posições refletem o momento da exportação.']);sheet.mergeCells(note.number,1,note.number,12);note.height=32;note.getCell(1).alignment={wrapText:true};note.getCell(1).font={name:'Calibri',size:11,color:{argb:'FF4D4D4D'}};
 return {book,report};
}
export async function downloadRanking(snapshot,filters,today){
 const {book}=await createRankingWorkbook(snapshot,filters,today),buffer=await book.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=`ranking-${filters.mode}-${filters.month}${filters.week?'-dias-'+filters.week.replace('|','-'):''}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
