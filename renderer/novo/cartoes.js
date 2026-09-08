// Planilha › Cartões (cadastro e fatura) e Previsão de diário (gastos mensais ÷ dias).
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const E = () => window.Saldos.estado;
  const gravar = () => window.Saldos.gravar();
  const hj = P.hoje();
  const CORES = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#64748b'];

  // ---------- CARTÕES ----------
  let cartaoEditando = null;
  function renderCartoes() {
    const cont = $('cartoesLista'); if (!cont) return;
    const est = E();
    if (!est.cartoes.length) { cont.innerHTML = `<div class="vazio-planilha card">Sem cartões por aqui. Clique em <b>Novo cartão</b> pra cadastrar o primeiro. Gastos lançados como "cartão" vão pra fatura do cartão escolhido.</div>`; return; }
    // a fatura 'atual' é a que está aberta hoje: a que ainda não fechou
    const faturaAberta = (c) => { const { a, m } = P.partes(hj); for (let i = 0; i < 3; i++) { const t = a * 12 + (m - 1) + i; const f = P.faturaCartao(est, c, Math.floor(t / 12), t % 12 + 1); if (hj >= f.de && hj <= f.ate) return f; } return P.faturaCartao(est, c, a, m); };
    const dm = (k) => k.slice(8) + '/' + MES3[+k.slice(5, 7) - 1];
    cont.innerHTML = est.cartoes.map(c => {
      const f = faturaAberta(c);
      const usado = c.limite > 0 ? Math.min(100, f.total / c.limite * 100) : 0;
      const semCartao = 0;
      return `<article class="cartao-tile" style="--c:${c.cor}" data-id="${c.id}">
        <div class="ct-topo"><b>${esc(c.nome)}</b><button type="button" class="btn-icone btn-ghost" data-menu-cartao="${c.id}" aria-label="Opções de ${esc(c.nome)}"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></button></div>
        <div class="ct-fatura"><small>fatura atual</small><span class="ct-valor">${P.fmtBRL(f.total)}</span></div>
        <div class="ct-meta">fecha ${dm(f.ate)} · vence ${dm(f.vencimento)}${c.limite > 0 ? ` · limite ${P.fmtBRL(c.limite)}` : ''}</div>
        ${c.limite > 0 ? `<div class="ct-barra"><i style="width:${usado.toFixed(0)}%"></i></div><div class="ct-meta">${usado.toFixed(0)}% do limite</div>` : ''}
        <div class="ct-periodo">compras de ${dm(f.de)} a ${dm(f.ate)} · ${f.itens.length} ${f.itens.length === 1 ? 'lançamento' : 'lançamentos'}</div>
      </article>`;
    }).join('') + soltos();
    function soltos() {
      const { a, m } = P.partes(hj); const n = P.diasNoMes(a, m);
      const s = P.materializar(est.movimentacoes, P.chave(a, m, 1), P.chave(a, m, n)).filter(o => o.mov.tipo === 'cartao' && !o.mov.cartaoId);
      if (!s.length) return '';
      return `<div class="sub ct-nota">${s.length} ${s.length === 1 ? 'gasto com cartão neste mês está' : 'gastos com cartão neste mês estão'} sem cartão definido (${P.fmtBRL(s.reduce((x, o) => x + o.valor, 0))}). Edite o lançamento pra escolher o cartão.</div>`;
    }
  }
  let menuCartao = null;
  function fecharMenuCartao() { if (menuCartao) { menuCartao.remove(); menuCartao = null; } }
  function abrirMenuCartao(btn, id) {
    fecharMenuCartao();
    const c = E().cartoes.find(x => x.id === id); if (!c) return;
    const el = document.createElement('div'); el.className = 'pd-menu'; menuCartao = el;
    el.innerHTML = `<button type="button" data-acao="editar">Editar</button><div class="sep"></div><button type="button" class="perigo" data-acao="excluir">Excluir cartão</button>`;
    const tile = btn.closest('.cartao-tile'); tile.style.position = 'relative'; el.style.top = '2.5rem'; tile.appendChild(el);
    el.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return; fecharMenuCartao();
      if (b.dataset.acao === 'editar') abrirCartao(c);
      else if (b.dataset.acao === 'excluir') {
        const est = E(); const usos = est.movimentacoes.filter(m => m.cartaoId === id).length;
        if (usos && !confirm(`"${c.nome}" tem ${usos} ${usos === 1 ? 'lançamento' : 'lançamentos'}. Excluir o cartão? Os lançamentos continuam como "gasto com cartão", só ficam sem cartão.`)) return;
        est.cartoes = est.cartoes.filter(x => x.id !== id); for (const m of est.movimentacoes) if (m.cartaoId === id) delete m.cartaoId;
        gravar(); renderCartoes();
      }
    };
  }
  function abrirCartao(c) {
    cartaoEditando = c || null;
    $('ctTitulo').textContent = c ? 'editar cartão' : 'novo cartão';
    $('ctNome').value = c ? c.nome : ''; $('ctFechamento').value = c ? c.fechamento : 1; $('ctVencimento').value = c ? c.vencimento : 10; $('ctLimite').value = c && c.limite ? String(c.limite).replace('.', ',') : '';
    const cor = c ? c.cor : CORES[E().cartoes.length % CORES.length];
    $('ctCores').innerHTML = CORES.map(x => `<button type="button" data-cor="${x}" class="${x === cor ? 'sel' : ''}" style="--c:${x}" aria-label="Cor ${x}"></button>`).join('');
    $('ctCores').dataset.cor = cor;
    $('ctExcluir').hidden = !c;
    $('ovCartao').hidden = false; setTimeout(() => $('ctNome').focus(), 40);
  }
  function fecharCartao() { $('ovCartao').hidden = true; cartaoEditando = null; }
  function salvarCartao(e) {
    e.preventDefault();
    const nome = $('ctNome').value.trim(); if (!nome) { $('ctNome').focus(); return; }
    const dia = (v, pad) => Math.min(31, Math.max(1, Math.round(+v) || pad));
    const dados = { nome, fechamento: dia($('ctFechamento').value, 1), vencimento: dia($('ctVencimento').value, 10), limite: parseFloat(String($('ctLimite').value).replace(/\./g, '').replace(',', '.')) || 0, cor: $('ctCores').dataset.cor };
    const est = E();
    if (cartaoEditando) Object.assign(cartaoEditando, dados); else est.cartoes.push({ id: P.novoId(), ...dados });
    gravar(); fecharCartao(); renderCartoes();
  }

  // ---------- PREVISÃO DE DIÁRIO ----------
  function renderPrevisao() {
    const cont = $('previsaoLista'); if (!cont) return;
    const est = E(); est.gastosMensais = est.gastosMensais || [];
    const total = est.gastosMensais.reduce((a, g) => a + (Number(g.valor) || 0), 0);
    const dias = est.previsaoDias || 30;
    est.previsaoDiario = dias > 0 ? Math.round(total / dias * 100) / 100 : 0;
    cont.innerHTML = (est.gastosMensais.length ? est.gastosMensais.map(g => `
      <div class="tag-linha" data-id="${g.id}">
        <span class="ic-tipo diario prev">D</span>
        <span class="tag-nome">${esc(g.nome)}</span>
        <b>${P.fmtBRL(g.valor)}</b>
        <button type="button" class="btn-icone btn-ghost" data-rm-gasto="${g.id}" aria-label="Remover ${esc(g.nome)}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>`).join('') : `<div class="vazio-planilha">Nenhum gasto mensal cadastrado. Coloque aqui o que você gasta por mês no dia a dia (mercado, transporte, lanche) e o app divide por dia.</div>`);
    $('prevTotal').textContent = P.fmtBRL(total);
    $('prevDias').value = dias;
    $('prevResultado').textContent = P.fmtBRL(est.previsaoDiario);
  }
  function addGasto(e) {
    e.preventDefault();
    const nome = $('gmNome').value.trim(); const valor = parseFloat(String($('gmValor').value).replace(/\./g, '').replace(',', '.')) || 0;
    if (!nome || valor <= 0) { (!nome ? $('gmNome') : $('gmValor')).focus(); return; }
    const est = E(); est.gastosMensais = est.gastosMensais || [];
    est.gastosMensais.push({ id: P.novoId(), nome, valor });
    $('gmNome').value = ''; $('gmValor').value = ''; $('gmNome').focus();
    renderPrevisao(); gravar();
  }

  function mostrar(nome) { if (nome === 'cartoes') renderCartoes(); if (nome === 'previsao') renderPrevisao(); }
  function montar() {
    $('btnNovoCartao').onclick = () => abrirCartao(null);
    $('cartoesLista').addEventListener('click', (e) => { const b = e.target.closest('button[data-menu-cartao]'); if (b) { e.stopPropagation(); abrirMenuCartao(b, b.dataset.menuCartao); } });
    document.addEventListener('click', (e) => { if (menuCartao && !e.target.closest('.pd-menu') && !e.target.closest('[data-menu-cartao]')) fecharMenuCartao(); });
    $('ctForm').onsubmit = salvarCartao; $('ctCancelar').onclick = fecharCartao; $('ctFechar').onclick = fecharCartao;
    $('ovCartao').addEventListener('click', (e) => { if (e.target === $('ovCartao')) fecharCartao(); });
    $('ctCores').addEventListener('click', (e) => { const b = e.target.closest('button[data-cor]'); if (!b) return; $('ctCores').dataset.cor = b.dataset.cor; $('ctCores').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); });
    $('ctExcluir').onclick = () => { if (!cartaoEditando) return; const id = cartaoEditando.id; const est = E(); est.cartoes = est.cartoes.filter(x => x.id !== id); for (const m of est.movimentacoes) if (m.cartaoId === id) delete m.cartaoId; gravar(); fecharCartao(); renderCartoes(); };
    $('gmForm').onsubmit = addGasto;
    $('previsaoLista').addEventListener('click', (e) => { const b = e.target.closest('button[data-rm-gasto]'); if (!b) return; const est = E(); est.gastosMensais = est.gastosMensais.filter(g => g.id !== b.dataset.rmGasto); renderPrevisao(); gravar(); });
    $('prevDias').onchange = (e) => { E().previsaoDias = Math.max(1, Math.min(31, +e.target.value || 30)); renderPrevisao(); gravar(); };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (menuCartao) fecharMenuCartao(); else if (!$('ovCartao').hidden) fecharCartao(); } });
  }
  window.PlanilhaCartoes = { montar, mostrar, renderCartoes, renderPrevisao };
})();
