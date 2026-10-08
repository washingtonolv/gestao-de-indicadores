function entrySellerChoices(admin,store,editingSeller=''){
 const normalized=store.trim().toLocaleLowerCase('pt-BR'),shop=admin.stores.find(s=>s.name.toLocaleLowerCase('pt-BR')===normalized);
 if(!shop)return [];
 const names=admin.sellers.filter(s=>s.storeId===shop.id&&s.active&&shop.active).map(s=>s.name);
 if(editingSeller&&admin.sellers.some(s=>s.storeId===shop.id&&s.name===editingSeller))names.push(editingSeller);
 return [...new Set(names)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function formatSaleDigits(value){const digits=value.replace(/\D/g,'').replace(/^0+(?=\d)/,'');if(!digits)return '';const padded=digits.padStart(3,'0');return padded.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+padded.slice(-2);}
function syncEntrySellers(selected){
 const store=$('#entry-store'),select=$('#entry-seller');
 if(!store.value&&cloudProfile?.role==='manager')store.value=db.admin.stores.find(s=>s.id===cloudProfile.storeId)?.name||'';
 const edit=data().entries.find(e=>e.id===$('#entry-id').value),editing=edit&&same(edit.store,store.value)?edit.seller:'';
 const names=entrySellerChoices(validateDB(data()).admin,store.value,editing),value=selected??select.value;
 const prompt=!store.value?'Selecione uma loja primeiro':names.length?'Selecione um vendedor':'Nenhum vendedor ativo nesta loja';
 const markup=`<option value="">${prompt}</option>`+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
 if(select.innerHTML!==markup)select.innerHTML=markup;
 select.disabled=!names.length;select.value=names.includes(value)?value:'';
 $('#sellers-list').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');
}
$('#entry-store').addEventListener('input',()=>syncEntrySellers());
$('#entry-store').addEventListener('change',()=>syncEntrySellers());
$('#entry-sales').addEventListener('input',()=>{
 const field=$('#entry-sales'),tail=field.value.slice(field.selectionStart??field.value.length).replace(/\D/g,'').length;
 field.value=formatSaleDigits(field.value);
 let cursor=field.value.length,remaining=tail;
 while(cursor>0&&remaining>0){if(/\d/.test(field.value[--cursor]))remaining--;}
 field.setSelectionRange(cursor,cursor);entryPreview();
});
