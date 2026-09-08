// Menu: troca cada <select> por um botão + lista flutuante desenhada pelo app.
// O <select> continua existindo (escondido) e é quem guarda o valor: quem lê
// `.value` ou escuta `change` não precisa saber que a lista é nossa. O popup
// nativo do sistema não combina com o tema e, no Electron, aparece fora do
// lugar quando a tela está com zoom.
(() => {
  const CHEV = '<svg class="menu-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  let aberto = null; // { select, lista, gatilho }

  const textoDe = (select) => { const o = select.options[select.selectedIndex]; return o ? o.textContent : ''; };

  function fechar() {
    if (!aberto) return;
    aberto.lista.remove();
    aberto.gatilho.setAttribute('aria-expanded', 'false');
    const g = aberto.gatilho; aberto = null;
    try { g.focus({ preventScroll: true }); } catch { }
  }

  function abrir(select, gatilho) {
    if (aberto && aberto.select === select) { fechar(); return; }
    fechar();
    const lista = document.createElement('div');
    lista.className = 'menu-lista'; lista.setAttribute('role', 'listbox');
    lista.innerHTML = [...select.options].map((o, i) =>
      `<button type="button" role="option" class="menu-item${o.selected ? ' sel' : ''}${o.disabled ? ' off' : ''}" data-i="${i}" aria-selected="${o.selected}"${o.disabled ? ' disabled' : ''}>${o.textContent.replace(/</g, '&lt;')}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg></button>`).join('');
    document.body.appendChild(lista);
    // posição: embaixo do gatilho; se não couber, em cima
    const r = gatilho.getBoundingClientRect();
    const larg = Math.max(r.width, 176);
    lista.style.minWidth = larg + 'px';
    lista.style.left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) + 'px';
    const h = lista.offsetHeight;
    if (r.bottom + 6 + h > window.innerHeight - 8 && r.top - 6 - h > 8) lista.style.top = (r.top - 6 - h) + 'px';
    else lista.style.top = Math.min(r.bottom + 6, window.innerHeight - h - 8) + 'px';
    gatilho.setAttribute('aria-expanded', 'true');
    aberto = { select, lista, gatilho };
    lista.addEventListener('click', (e) => {
      const b = e.target.closest('.menu-item'); if (!b || b.disabled) return;
      escolher(select, +b.dataset.i);
    });
    lista.addEventListener('keydown', (e) => {
      const itens = [...lista.querySelectorAll('.menu-item:not([disabled])')];
      const i = itens.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (itens[i + 1] || itens[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (itens[i - 1] || itens[itens.length - 1]).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'Tab') fechar();
    });
    const sel = lista.querySelector('.menu-item.sel:not([disabled])') || lista.querySelector('.menu-item:not([disabled])');
    if (sel) sel.focus({ preventScroll: true });
  }

  function escolher(select, i) {
    const mudou = select.selectedIndex !== i;
    select.selectedIndex = i;
    fechar();
    if (mudou) select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function aprimorar(select) {
    if (select.dataset.menu) return; select.dataset.menu = '1';
    let gatilho;
    if (select.dataset.gatilho === 'pai') {
      // o pai já é o botão visual (ex.: o período do dashboard); o select só some
      gatilho = select.parentElement;
      select.hidden = true; select.tabIndex = -1;
      gatilho.setAttribute('role', 'button'); gatilho.tabIndex = 0; gatilho.setAttribute('aria-haspopup', 'listbox'); gatilho.setAttribute('aria-expanded', 'false');
      gatilho.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); abrir(select, gatilho); } });
    } else {
      gatilho = document.createElement('button');
      gatilho.type = 'button'; gatilho.className = 'menu-botao'; gatilho.setAttribute('aria-haspopup', 'listbox'); gatilho.setAttribute('aria-expanded', 'false');
      const rotulo = select.getAttribute('aria-label'); if (rotulo) gatilho.setAttribute('aria-label', rotulo);
      gatilho.innerHTML = `<span class="menu-valor"></span>${CHEV}`;
      select.hidden = true; select.tabIndex = -1;
      select.after(gatilho);
      gatilho.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); abrir(select, gatilho); } });
    }
    gatilho.addEventListener('click', (e) => { e.preventDefault(); if (select.disabled) return; abrir(select, gatilho); });
    const atualizar = () => { const v = gatilho.querySelector('.menu-valor'); if (v) v.textContent = textoDe(select); };
    // valor mudado por código (select.value = …) também atualiza o rótulo
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); atualizar(); } });
    const descI = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    Object.defineProperty(select, 'selectedIndex', { get() { return descI.get.call(this); }, set(v) { descI.set.call(this, v); atualizar(); } });
    new MutationObserver(atualizar).observe(select, { childList: true, subtree: true, attributes: true });
    select.addEventListener('change', atualizar);
    atualizar();
    return gatilho;
  }

  document.addEventListener('mousedown', (e) => { if (aberto && !aberto.lista.contains(e.target) && !aberto.gatilho.contains(e.target)) fechar(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aberto) { e.stopPropagation(); fechar(); } }, true);
  window.addEventListener('resize', fechar);
  document.addEventListener('scroll', (e) => { if (aberto && e.target !== aberto.lista && !aberto.lista.contains(e.target)) fechar(); }, true);

  function aprimorarTodos(raiz) { (raiz || document).querySelectorAll('select:not([data-nativo])').forEach(aprimorar); }
  window.Menu = { aprimorar, aprimorarTodos, abrir: (select) => { const g = select.dataset.gatilho === 'pai' ? select.parentElement : select.nextElementSibling; abrir(select, g); }, fechar };
  aprimorarTodos();
})();
