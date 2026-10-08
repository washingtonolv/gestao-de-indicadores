(() => {
 const key='gi-theme-v1',frame=document.getElementById('codex-visualization');
 let theme='light';try{theme=localStorage.getItem(key)==='dark'?'dark':'light';}catch{}
 const style=document.createElement('style');
 style.textContent=`html[data-theme=dark],html[data-theme=dark] body,html[data-theme=dark] iframe{background:#191919;color-scheme:dark}html[data-theme=dark] #cloud-login,html[data-theme=dark] #gi-install-dialog{background:#262626;color:#F9FAFB;border-color:#404040}html[data-theme=dark] #cloud-bar{color:#F9FAFB}html[data-theme=dark] :is(#cloud-login,#cloud-bar) :is(input,button){background:#303030;color:#F9FAFB;border-color:#626262}html[data-theme=dark] #cloud-login button[type=submit]{background:#3B82F6;color:#171717}html[data-theme=dark] #cloud-error{color:#FCA5A5}.gi-theme-toggle{min-height:44px}`;
 document.head.append(style);
 const buttons=['cloud-login','cloud-bar'].map(id=>{
  const button=document.createElement('button');button.type='button';button.className='gi-theme-toggle';
  button.addEventListener('click',()=>{theme=theme==='light'?'dark':'light';try{localStorage.setItem(key,theme);}catch{}apply();});
  (document.querySelector(id==='cloud-login'?'.login-form-side':'#cloud-bar')||document.getElementById(id)).append(button);return button;
 });
 function send(){frame.contentWindow?.postMessage({type:'gi-theme',theme},'*');}
 function apply(){document.documentElement.dataset.theme=theme;buttons.forEach(b=>{b.textContent=theme==='dark'?'☀ Tema claro':'☾ Tema escuro';b.setAttribute('aria-label',theme==='dark'?'Ativar tema claro':'Ativar tema escuro');});send();}
 frame.addEventListener('load',send);
 window.addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.origin==='null'&&e.data?.type==='gi-theme-ready')send();});
 window.addEventListener('storage',e=>{if(e.key===key){theme=e.newValue==='dark'?'dark':'light';apply();}});
 apply();
})();
