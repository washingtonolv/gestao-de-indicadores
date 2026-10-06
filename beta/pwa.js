(() => {
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  const css = document.createElement('style');
  css.textContent = `.gi-install{margin-top:12px}#gi-install-dialog{box-sizing:border-box;width:calc(100% - 32px);max-width:480px;padding:28px;border:1px solid #E5E7EB;border-radius:24px;background:#fff;color:#1F2937;font:16px system-ui;box-shadow:0 24px 80px #1F293730}#gi-install-dialog::backdrop{background:#1F293755;backdrop-filter:blur(4px)}#gi-install-dialog h2{margin:0 0 16px;font-size:24px}#gi-install-dialog li{margin:14px 0;line-height:1.6}#gi-install-dialog p{color:#6B7280;line-height:1.6}#gi-install-dialog button{min-height:44px;padding:12px 20px;border:0;border-radius:12px;background:#059669;color:white;font:600 16px system-ui;cursor:pointer}.gi-install:focus-visible,#gi-install-dialog button:focus-visible{outline:3px solid #059669;outline-offset:3px}`;
  document.head.append(css);
  const dialog = document.createElement('dialog');
  dialog.id = 'gi-install-dialog';
  dialog.setAttribute('aria-labelledby', 'gi-install-title');
  dialog.innerHTML = '<h2 id="gi-install-title">Seu painel como aplicativo</h2><ol><li><b>Android ou computador:</b> no Chrome ou Edge, abra o menu do navegador e escolha “Instalar aplicativo” ou “Instalar página como aplicativo”.</li><li><b>iPhone ou iPad:</b> abra no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Ative “Abrir como App”, se essa opção aparecer.</li></ol><p>O aplicativo abre em uma janela própria. Para entrar, consultar e salvar os resultados, mantenha a conexão com a internet.</p><form method="dialog"><button>Entendi</button></form>';
  document.body.append(dialog);
  dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); dialog.close(); });
  const buttons = ['cloud-login', 'cloud-bar'].map(id => {
    const host = document.getElementById(id);
    if (!host) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gi-install';
    button.textContent = 'Instalar aplicativo';
    button.addEventListener('click', async () => {
      if (!installPrompt) { dialog.showModal(); return; }
      const prompt = installPrompt;
      installPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch { dialog.showModal(); }
    });
    host.append(button);
    return button;
  }).filter(Boolean);
  const update = () => buttons.forEach(button => { button.hidden = standalone.matches || navigator.standalone === true; });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('appinstalled', () => { installPrompt = null; buttons.forEach(button => { button.hidden = true; }); });
  standalone.addEventListener('change', update);
  update();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Installation instructions remain available when this browser cannot register a worker.
    });
  }
})();
