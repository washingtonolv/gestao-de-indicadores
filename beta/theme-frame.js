(() => {
 window.addEventListener('message', event => {
  if(event.source!==parent || event.data?.type!=='gi-theme' || !['light','dark'].includes(event.data.theme))return;
  document.documentElement.dataset.theme=event.data.theme;
 });
 parent.postMessage({type:'gi-theme-ready'},'*');
})();
