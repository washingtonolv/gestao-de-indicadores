const GoalTransfer = (() => {
  const header = ['tipo', 'mes', 'data', 'loja', 'vendedor', 'meta'];
  const same = (a, b) => a.localeCompare(b, 'pt-BR', {sensitivity: 'base'}) === 0;
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  const safeCell = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const readCell = value => value.startsWith("'") && /^[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
  const money = cents => (cents / 100).toFixed(2).replace('.', ',');
  function table(text) {
    if (typeof text !== 'string' || text.length > 2000000) throw Error('O CSV deve ter no máximo 2 MB.');
    text = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false;
    const finish = () => {
      row.push(field);
      if (row.some(cell => cell !== '')) rows.push(row);
      if (rows.length > 11000) throw Error('O CSV tem linhas demais.');
      row = []; field = '';
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"' && field === '') quoted = true;
      else if (ch === ';') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        finish();
      } else if (ch === '"') throw Error('Aspas inválidas no CSV.');
      else field += ch;
    }
    if (quoted) throw Error('Aspas não fechadas no CSV.');
    if (field !== '' || row.length) finish();
    const first = rows.shift();
    if (!first || first.length !== header.length || first.some((cell, i) => clean(cell).toLowerCase() !== header[i])) {
      throw Error('Cabeçalho inválido. Use o CSV exportado pela página de Metas.');
    }
    if (!rows.length) throw Error('O CSV não contém metas.');
    rows.forEach((row, i) => {
      if (row.length !== header.length) throw Error('Linha ' + (i + 2) + ': são esperadas seis colunas.');
    });
    return rows;
  }
  function exportCsv(data) {
    const rows = [];
    const stores = data.admin.stores, sellers = data.admin.sellers;
    for (const goal of data.goals) rows.push(['loja', goal.month, '', goal.store, '', money(goal.cents)]);
    for (const goal of data.admin.sellerGoals) {
      const seller = sellers.find(item => item.id === goal.sellerId);
      const store = stores.find(item => item.id === seller?.storeId);
      if (!seller || !store) throw Error('Há uma meta com vendedor ou loja indisponível.');
      rows.push(['individual', goal.month, '', store.name, seller.name, money(goal.cents)]);
    }
    for (const goal of data.admin.sellerDailyGoals) {
      const seller = sellers.find(item => item.id === goal.sellerId);
      const store = stores.find(item => item.id === seller?.storeId);
      if (!seller || !store) throw Error('Há uma meta diária com vendedor ou loja indisponível.');
      rows.push(['diaria', goal.date.slice(0, 7), goal.date, store.name, seller.name, money(goal.cents)]);
    }
    rows.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]) || a[3].localeCompare(b[3], 'pt-BR') || a[4].localeCompare(b[4], 'pt-BR') || a[2].localeCompare(b[2]));
    return '\uFEFF' + [header, ...rows].map(row => row.map(safeCell).join(';')).join('\r\n') + '\r\n';
  }
  function prepareImport(text, data, allowedStoreId = null) {
    const rows = table(text), next = structuredClone(data);
    const stats = {created: 0, updated: 0, unchanged: 0, total: rows.length};
    const seen = new Set();
    rows.forEach((cells, index) => {
      const line = index + 2;
      const [kindValue, monthValue, dateValue, storeValue, sellerValue, amountValue] = cells.map(readCell);
      const kind = clean(kindValue).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const month = clean(monthValue), date = clean(dateValue), storeName = clean(storeValue), sellerName = clean(sellerValue);
      if (!['loja', 'individual', 'diaria'].includes(kind)) throw Error('Linha ' + line + ': tipo inválido.');
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Linha ' + line + ': mês inválido.');
      if ((kind === 'diaria') !== !!date || (date && (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || date.slice(0, 7) !== month))) {
        throw Error('Linha ' + line + ': data inválida ou incompatível com o mês.');
      }
      if ((kind === 'loja') === !!sellerName) throw Error('Linha ' + line + ': confira a coluna vendedor.');
      const stores = next.admin.stores.filter(item => item.active && same(item.name, storeName));
      if (stores.length !== 1) throw Error('Linha ' + line + ': loja não cadastrada ou inativa: ' + storeName + '.');
      const store = stores[0];
      if (allowedStoreId && store.id !== allowedStoreId) throw Error('Linha ' + line + ': você só pode importar metas da sua loja.');
      let seller;
      if (kind !== 'loja') {
        const sellers = next.admin.sellers.filter(item => item.active && item.storeId === store.id && same(item.name, sellerName));
        if (sellers.length !== 1) throw Error('Linha ' + line + ': vendedor não cadastrado nesta loja: ' + sellerName + '.');
        seller = sellers[0];
      }
      const rawAmount = clean(amountValue);
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(rawAmount)) throw Error('Linha ' + line + ': meta inválida. Use 1234,56.');
      const [integer, decimal = ''] = rawAmount.replace(/\./g, '').split(',');
      const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'));
      if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000000) throw Error('Linha ' + line + ': a meta deve ser maior que zero e dentro do limite.');
      const key = [kind, kind === 'diaria' ? date : month, store.id, seller?.id || ''].join('|');
      if (seen.has(key)) throw Error('Linha ' + line + ': meta duplicada no CSV.');
      seen.add(key);
      const list = kind === 'loja' ? next.goals : kind === 'individual' ? next.admin.sellerGoals : next.admin.sellerDailyGoals;
      const existing = kind === 'loja'
        ? list.find(item => item.month === month && same(item.store, store.name))
        : kind === 'individual'
          ? list.find(item => item.month === month && item.sellerId === seller.id)
          : list.find(item => item.date === date && item.sellerId === seller.id);
      if (existing) {
        if (existing.cents === cents) stats.unchanged++;
        else { existing.cents = cents; stats.updated++; }
      } else {
        list.push(kind === 'loja' ? {month, store: store.name, cents} : kind === 'individual' ? {month, sellerId: seller.id, cents} : {date, sellerId: seller.id, cents});
        stats.created++;
      }
    });
    return {next, stats};
  }
  return {exportCsv, prepareImport};
})();
if (typeof module !== 'undefined') module.exports = GoalTransfer;
