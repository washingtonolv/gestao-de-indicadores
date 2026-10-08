// Lightweight interaction polish shared by the existing dashboard views.
(()=>{
 const effectsRoot=document.getElementById('gi-beta');
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 const forms=['#entry-form','#goal-form','#seller-goal-form','#admin-form'].map(s=>effectsRoot.querySelector(s)).filter(Boolean);
 const beginSave=form=>{
  const button=form?.querySelector('button[type="submit"]');if(!button||button.dataset.effectSaving==='true')return null;
  const text=button.textContent.trim(),width=Math.max(button.getBoundingClientRect().width,138);
  button.dataset.effectSaving='true';button.dataset.effectText=text;button.style.minWidth=width+'px';button.disabled=true;button.classList.remove('is-saved');button.classList.add('is-saving');button.innerHTML='<span class="save-spinner" aria-hidden="true"></span>Salvando…';
  return button;
 };
 const finishSave=(button,success)=>{
  if(!button)return;
  button.classList.remove('is-saving');button.disabled=false;
  if(success){button.classList.add('is-saved');button.textContent='✓ Salvo';setTimeout(()=>restore(button),2500);}
  else restore(button);
 };
 const restore=button=>{if(!button?.isConnected)return;button.textContent=button.dataset.effectText||'Salvar';button.classList.remove('is-saving','is-saved');button.disabled=false;button.style.minWidth='';delete button.dataset.effectSaving;delete button.dataset.effectText;};
 const originalSave=save;
 save=async(...args)=>{const button=beginSave(document.activeElement?.closest('form'));try{const result=await originalSave(...args);finishSave(button,true);return result;}catch(error){finishSave(button,false);throw error;}};
 if(typeof createCloudAccount==='function'){
  const originalCreateAccount=createCloudAccount;
  createCloudAccount=async(...args)=>{const form=effectsRoot.querySelector('#admin-form'),button=beginSave(form);try{const result=await originalCreateAccount(...args);finishSave(button,!form.querySelector('#admin-error')?.textContent.trim());return result;}catch(error){finishSave(button,false);throw error;}};
 }

 function syncPill(group){
  if(!group||group.hidden)return;
  let pill=group.querySelector(':scope > .segment-pill');
  if(!pill){pill=document.createElement('span');pill.className='segment-pill';pill.setAttribute('aria-hidden','true');group.prepend(pill);}
  const active=group.querySelector('button[aria-pressed="true"]:not([hidden])');
  if(!active){pill.style.opacity='0';return;}
  const left=active.offsetLeft,top=active.offsetTop;
  pill.style.width=active.offsetWidth+'px';pill.style.height=active.offsetHeight+'px';pill.style.transform=`translate(${left}px, ${top}px)`;pill.style.opacity='1';
 }
 function syncControls(){
  effectsRoot.querySelectorAll('.segments,.admin-tabs').forEach(group=>{
   group.classList.add('has-sliding-pill');syncPill(group);
   if(group.dataset.keyboardReady)return;group.dataset.keyboardReady='true';
   group.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...group.querySelectorAll('button:not([disabled]):not([hidden])')];if(!buttons.length)return;
    const active=Math.max(0,buttons.findIndex(button=>button.getAttribute('aria-pressed')==='true'));
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(active+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    event.preventDefault();buttons[next].focus();buttons[next].click();
   });
  });
 }
 const nav=effectsRoot.querySelector('.rail nav');
 function syncNav(){
  if(!nav)return;let indicator=nav.querySelector(':scope > .nav-indicator');
  if(!indicator){indicator=document.createElement('span');indicator.className='nav-indicator';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator);}
  const active=nav.querySelector('button[aria-current="page"]:not([hidden])');if(!active){indicator.style.opacity='0';return;}
  const mobile=window.matchMedia('(max-width:759px)').matches,size=mobile?28:48;const x=active.offsetLeft+(active.offsetWidth-size)/2,y=mobile?2:active.offsetTop+(active.offsetHeight-size)/2;
  if(window.matchMedia('(max-width:759px)').matches){nav.style.setProperty('--nav-mobile-x',x+'px');indicator.style.transform='';}
  else{nav.style.removeProperty('--nav-mobile-x');indicator.style.transform=`translate(${x}px, ${y}px)`;}
  indicator.style.opacity='1';
 }
 function animateCurrentView(){
  const active=effectsRoot.querySelector('.view:not([hidden])');if(!active||motionPreference.matches)return;
  active.classList.remove('view-entering');void active.offsetWidth;active.classList.add('view-entering');
  const heading=effectsRoot.querySelector('.page-heading');heading?.classList.remove('heading-entering');if(heading){void heading.offsetWidth;heading.classList.add('heading-entering');}
 }
 function finishLoading(success){
  const dashboard=effectsRoot.querySelector('#dashboard');if(!dashboard)return;
  dashboard.classList.remove('is-pending');dashboard.classList.toggle('load-failed',!success);
  const skeleton=dashboard.querySelector('.dashboard-skeleton');
  if(skeleton){skeleton.classList.add('is-leaving');setTimeout(()=>skeleton.remove(),motionPreference.matches?0:300);}
  dashboard.setAttribute('aria-busy','false');
 }
 function startLoading(){
  const dashboard=effectsRoot.querySelector('#dashboard');if(!dashboard)return;
  dashboard.classList.add('is-pending');dashboard.setAttribute('aria-busy','true');
  setTimeout(()=>{
   if(ready||demo||!dashboard.isConnected)return;
   const skeleton=document.createElement('div');skeleton.className='dashboard-skeleton';skeleton.setAttribute('aria-hidden','true');
   skeleton.innerHTML='<div class="skeleton-kpis">'+Array.from({length:4},()=>'<div class="skeleton-card"><i></i><b></b><small></small></div>').join('')+'</div><div class="skeleton-panels"><div class="skeleton-card"><i></i><b></b><small></small><small></small></div><div class="skeleton-card"><i></i><b></b><small></small></div></div>';
   dashboard.prepend(skeleton);
  },200);
 }
 startLoading();
 effectsRoot.addEventListener('gi-data-ready',event=>finishLoading(event.detail?.success===true));
 effectsRoot.addEventListener('click',event=>{
  const row=event.target.closest('.history-row,.admin-row,.goal-row');if(row)row.classList.add('row-touched');
  if(event.target.closest('.rail nav [data-view]'))scheduleControls();
  if(event.target.closest('.segments button,.admin-tabs button')){scheduleControls();const button=event.target.closest('button');let panel=button.closest('.admin-tabs')?effectsRoot.querySelector('.admin-layout'):button.closest('.goal-tabs')?effectsRoot.querySelector('.goal-forms'):button.closest('label')?.closest('.form-grid');if(panel&&!motionPreference.matches){panel.classList.remove('panel-entering');requestAnimationFrame(()=>panel.classList.add('panel-entering'));}}
 });
 effectsRoot.addEventListener('focusin',event=>{if(event.target.closest('.rail nav [data-view]'))syncNav();});
 let controlFrame=0;function scheduleControls(){if(controlFrame)return;controlFrame=requestAnimationFrame(()=>{controlFrame=0;syncControls();syncNav();});}
 effectsRoot.addEventListener('gi-view-changed',()=>{scheduleControls();animateCurrentView();});
 const watcher=new MutationObserver(records=>{if(records.some(record=>record.target instanceof Element&&(record.target.closest('.segments,.admin-tabs,.rail nav')||record.type==='attributes'&&record.attributeName==='hidden'||[...record.addedNodes].some(node=>node instanceof Element&&(node.matches('.segments,.admin-tabs,.view')||node.querySelector('.segments,.admin-tabs'))))))scheduleControls();});
 watcher.observe(effectsRoot,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','aria-current','hidden']});
 window.addEventListener('resize',scheduleControls);
 syncControls();syncNav();
 window.addEventListener('pointerdown',event=>{
  if(event.target.closest('#chart,#evo-chart'))return;
  effectsRoot.querySelectorAll('.sales-tooltip').forEach(tip=>{tip.hidden=true;});effectsRoot.querySelectorAll('#chart,#evo-chart').forEach(chart=>chart.onchartunpin?.());
  effectsRoot.querySelectorAll('.chart-selection').forEach(chart=>chart.classList.remove('chart-selection'));
 });
})();
