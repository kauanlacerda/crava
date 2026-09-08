// Planilha › Totais, Tags e Horizonte: leituras do mesmo modelo da tela Saldos.
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const LETRA = { entrada: 'E', saida: 'S', diario: 'D', economia: 'E', cartao: 'C' };
  const E = () => window.Saldos.estado;
  const gravar = () => window.Saldos.gravar();
  const hj = P.hoje();

  // mês selecionado (Totais e Tags compartilham)
  let mes = { a: +hj.slice(0, 4), m: +hj.slice(5, 7) };
  const rotuloMes = () => `${MES3[mes.m - 1]}/${mes.a}`;
  function moverMes(n) { const t = mes.a * 12 + (mes.m - 1) + n; mes = { a: Math.floor(t / 12), m: t % 12 + 1 }; renderTotais(); renderTags(); }

  // ---------- TOTAIS ----------
  function renderTotais() {
    const cont = $('totaisCorpo'); if (!cont) return;
    $('totaisMes').textContent = rotuloMes();
    const r = P.resumoMes(E(), mes.a, mes.m);
    const t = r.totais;
    const diasNoMes = r.dias.length;
    const mesAtual = hj.slice(0, 7) === `${mes.a}-${String(mes.m).padStart(2, '0')}`;
    const passado = `${mes.a}-${String(mes.m).padStart(2, '0')}` < hj.slice(0, 7);
    const diasCorridos = mesAtual ? +hj.slice(8, 10) : passado ? diasNoMes : 0;
    const diasRestantes = mesAtual ? diasNoMes - diasCorridos : passado ? 0 : diasNoMes;
    const previsao = Number(E().previsaoDiario) || 0;
    const previsaoMes = previsao * diasRestantes;
    const performance = t.entrada - t.saida - t.diario - t.economia - t.cartao - previsaoMes;
    const custoVida = t.saida + t.diario + t.cartao + previsaoMes;
    const economizado = t.entrada > 0 ? t.economia / t.entrada * 100 : 0;
    const diarioMedio = diasCorridos > 0 ? t.diario / diasCorridos : 0;
    const chip = (tp) => `<span class="ic-tipo ${tp}">${LETRA[tp]}</span>`;
    const chipPrev = `<span class="ic-tipo diario prev" title="previsão de diário">D</span>`;
    const pct = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    cont.innerHTML = `
      <div class="tot-rotulo">cálculos do mês</div>
      <div class="tot-grade">
        <article class="card tot-card">
          <h2>performance</h2>
          <div class="tot-formula">${chip('entrada')} − ${chip('saida')} − ${chip('diario')} − ${chip('economia')} − ${chip('cartao')} − ${chipPrev}</div>
          <div class="tot-valor ${performance < 0 ? 'neg' : 'pos'}">${P.fmtBRL(performance)}</div>
          <div class="sub">${performance < 0 ? 'faltou dinheiro' : performance > 0 ? 'sobrou dinheiro' : 'empatou'}</div>
        </article>
        <article class="card tot-card">
          <h2>economizado</h2>
          <div class="tot-formula">${chip('economia')} <span class="tot-barra"><i style="width:${Math.min(100, economizado)}%"></i></span> ${chip('entrada')}</div>
          <div class="tot-valor">${pct(economizado)}</div>
          <div class="sub">${t.economia > 0 ? `guardou ${P.fmtBRL(t.economia)} de ${P.fmtBRL(t.entrada)}` : 'nada guardado'}</div>
        </article>
        <article class="card tot-card">
          <h2>custo de vida</h2>
          <div class="tot-formula">${chip('saida')} + ${chip('diario')} + ${chip('cartao')} + ${chipPrev}</div>
          <div class="tot-valor">${P.fmtBRL(custoVida)}</div>
          <div class="sub">${custoVida > t.entrada ? 'acima da renda' : custoVida > 0 ? 'abaixo da renda' : 'sem gastos'}</div>
        </article>
        <article class="card tot-card">
          <h2>diário médio</h2>
          <div class="tot-formula">${chip('diario')} / ${diasCorridos || diasNoMes} ${diasCorridos ? 'dias' : 'dias (mês futuro)'}</div>
          <div class="tot-valor">${P.fmtBRL(diarioMedio)}</div>
          <div class="sub">${chipPrev} previsão: ${P.fmtBRL(previsao)} por dia</div>
        </article>
      </div>
      <div class="tot-rotulo">movimentações do mês</div>
      <div class="card tot-lista">
        ${P.TIPOS.map(tp => `<button type="button" class="tot-linha" data-tipo="${tp}">${chip(tp)}<span>${tp === 'cartao' ? 'gastos com cartão' : P.PLURAL[tp]}</span><b>${P.fmtBRL(t[tp])}</b></button>`).join('')}
        <button type="button" class="tot-linha tot-ver" data-tipo=""><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg><span>ver na grade</span></button>
      </div>
      <div class="tot-rotulo">previsão de diários do mês</div>
      <div class="card tot-lista">
        <div class="tot-linha"><span>${chipPrev} previsão de diário × ${diasRestantes} ${diasRestantes === 1 ? 'dia restante' : 'dias restantes'}</span><b>${P.fmtBRL(previsaoMes)}</b></div>
        ${previsao ? '' : `<div class="sub tot-nota">Sem previsão cadastrada. Defina em Planilha › Previsão de diário.</div>`}
      </div>`;
    cont.querySelectorAll('.tot-linha[data-tipo]').forEach(b => {
      b.onclick = () => { document.querySelector('[data-view="saldos"]').click(); window.Saldos.irParaMes(mes.a, mes.m); };
    });
  }

  // ---------- TAGS ----------
  let filtroTags = '';
  let tagEditando = null;
  function renderTags() {
    const cont = $('tagsLista'); if (!cont) return;
    $('tagsMes').textContent = rotuloMes();
    const est = E();
    const n = P.diasNoMes(mes.a, mes.m);
    const de = P.chave(mes.a, mes.m, 1), ate = P.chave(mes.a, mes.m, n);
    const soma = new Map();
    for (const o of P.materializar(est.movimentacoes, de, ate)) for (const id of (o.mov.tags || [])) soma.set(id, (soma.get(id) || 0) + o.valor);
    const lista = est.tags.filter(t => !filtroTags || t.nome.toLowerCase().includes(filtroTags.toLowerCase()));
    if (!est.tags.length) { cont.innerHTML = `<div class="vazio-planilha">Nenhuma tag ainda. Crie uma aqui ou direto no formulário de movimentação.</div>`; return; }
    cont.innerHTML = lista.map(t => `
      <div class="tag-linha" data-id="${t.id}">
        <i class="tag-cor" style="--c:${t.cor}"></i>
        <span class="tag-nome">${esc(t.nome)}</span>
        <b>${P.fmtBRL(soma.get(t.id) || 0)}</b>
        <button type="button" class="btn-icone btn-ghost" data-menu-tag="${t.id}" aria-label="Opções de ${esc(t.nome)}"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></button>
      </div>`).join('') || `<div class="vazio-planilha">Nenhuma tag com "${esc(filtroTags)}".</div>`;
  }
  let menuTag = null;
  function fecharMenuTag() { if (menuTag) { menuTag.remove(); menuTag = null; } }
  function abrirMenuTag(btn, id) {
    fecharMenuTag();
    const t = E().tags.find(x => x.id === id); if (!t) return;
    const el = document.createElement('div'); el.className = 'pd-menu'; menuTag = el;
    el.innerHTML = `<button type="button" data-acao="editar">Renomear ou mudar a cor</button><button type="button" data-acao="ver">Ver lançamentos na grade</button><div class="sep"></div><button type="button" class="perigo" data-acao="excluir">Excluir tag</button>`;
    const linha = btn.closest('.tag-linha'); linha.style.position = 'relative'; el.style.top = '2.5rem'; linha.appendChild(el);
    el.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return; const acao = b.dataset.acao; fecharMenuTag();
      if (acao === 'editar') abrirTag(t);
      else if (acao === 'ver') { document.querySelector('[data-view="saldos"]').click(); window.Saldos.irParaMes(mes.a, mes.m); }
      else if (acao === 'excluir') {
        const est = E(); const usos = est.movimentacoes.filter(m => (m.tags || []).includes(id)).length;
        if (usos && !confirm(`"${t.nome}" está em ${usos} ${usos === 1 ? 'lançamento' : 'lançamentos'}. Excluir a tag? Os lançamentos continuam, só perdem a tag.`)) return;
        est.tags = est.tags.filter(x => x.id !== id); for (const m of est.movimentacoes) if (m.tags) m.tags = m.tags.filter(x => x !== id);
        gravar(); renderTags();
      }
    };
  }
  function abrirTag(t) {
    tagEditando = t || null;
    $('tgTitulo').textContent = t ? 'editar tag' : 'nova tag';
    $('tgNome').value = t ? t.nome : '';
    const cor = t ? t.cor : P.CORES_TAG[E().tags.length % P.CORES_TAG.length];
    $('tgCores').innerHTML = P.CORES_TAG.map(c => `<button type="button" data-cor="${c}" class="${c === cor ? 'sel' : ''}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join('');
    $('tgCores').dataset.cor = cor;
    $('tgExcluir').hidden = !t;
    $('ovTag').hidden = false; setTimeout(() => $('tgNome').focus(), 40);
  }
  function fecharTag() { $('ovTag').hidden = true; tagEditando = null; }
  function salvarTag(e) {
    e.preventDefault();
    const nome = $('tgNome').value.trim(); if (!nome) { $('tgNome').focus(); return; }
    const cor = $('tgCores').dataset.cor;
    const est = E();
    if (tagEditando) { tagEditando.nome = nome; tagEditando.cor = cor; }
    else { const t = P.novaTag(est, nome); t.cor = cor; }
    gravar(); fecharTag(); renderTags();
  }

  // ---------- HORIZONTE ----------
  let inicioH = { a: +hj.slice(0, 4), m: +hj.slice(5, 7) };
  const mesesH = () => { const out = []; for (let i = 0; i < 12; i++) { const t = inicioH.a * 12 + (inicioH.m - 1) + i; out.push({ a: Math.floor(t / 12), m: t % 12 + 1 }); } return out; };
  function moverH(n) { const t = inicioH.a * 12 + (inicioH.m - 1) + n; inicioH = { a: Math.floor(t / 12), m: t % 12 + 1 }; renderHorizonte(); }
  function renderHorizonte() {
    const cont = $('horizonteCorpo'); if (!cont) return;
    const v = mesesH();
    $('horizonteRotulo').textContent = `${MES3[v[0].m - 1]}/${v[0].a} – ${MES3[v[11].m - 1]}/${v[11].a}`;
    if (!E().movimentacoes.length) { cont.innerHTML = `<div class="vazio-planilha" style="width:100%">Nenhuma movimentação ainda.</div>`; return; }
    const meses = v.map(({ a, m }) => P.resumoMes(E(), a, m));
    const maxAbs = Math.max(1, ...meses.flatMap(r => r.dias.map(d => Math.abs(d.saldo))));
    cont.innerHTML = `<div class="hz-grade">${meses.map(r => `
      <div class="hz-mes">
        <div class="hz-titulo">${MES3[r.mes - 1]}/${String(r.ano).slice(2)}</div>
        ${r.dias.map(d => { const f = d.saldo < 0 ? (0.18 + 0.55 * Math.abs(d.saldo) / maxAbs).toFixed(2) : (0.06 + 0.25 * Math.abs(d.saldo) / maxAbs).toFixed(2); return `<button type="button" class="hz-dia ${d.saldo < 0 ? 'neg' : d.saldo > 0 ? 'pos' : ''} ${d.data === hj ? 'hoje' : ''} ${d.fimDeSemana ? 'fds' : ''}" style="--f:${f}" data-data="${d.data}" title="${d.data}: ${P.fmtBRL(d.saldo)}"><span class="hz-n">${d.dia}</span><span class="hz-v">${P.fmtCompacto(d.saldo)}</span></button>`; }).join('')}
      </div>`).join('')}</div>`;
    cont.querySelectorAll('.hz-dia').forEach(b => { b.onclick = () => { document.querySelector('[data-view="saldos"]').click(); window.Saldos.irParaDia(b.dataset.data); }; });
  }

  // ---------- montagem ----------
  function mostrar(nome) {
    if (nome === 'totais') renderTotais();
    if (nome === 'tags') renderTags();
    if (nome === 'horizonte') renderHorizonte();
  }
  function montar() {
    $('totaisAnt').onclick = () => moverMes(-1); $('totaisProx').onclick = () => moverMes(1);
    $('tagsAnt').onclick = () => moverMes(-1); $('tagsProx').onclick = () => moverMes(1);
    $('tagsFiltro').oninput = (e) => { filtroTags = e.target.value; renderTags(); };
    $('btnNovaTag').onclick = () => abrirTag(null);
    $('tagsLista').addEventListener('click', (e) => { const b = e.target.closest('button[data-menu-tag]'); if (b) { e.stopPropagation(); abrirMenuTag(b, b.dataset.menuTag); } });
    document.addEventListener('click', (e) => { if (menuTag && !e.target.closest('.pd-menu') && !e.target.closest('[data-menu-tag]')) fecharMenuTag(); });
    $('tgForm').onsubmit = salvarTag; $('tgCancelar').onclick = fecharTag; $('tgFechar').onclick = fecharTag;
    $('ovTag').addEventListener('click', (e) => { if (e.target === $('ovTag')) fecharTag(); });
    $('tgCores').addEventListener('click', (e) => { const b = e.target.closest('button[data-cor]'); if (!b) return; $('tgCores').dataset.cor = b.dataset.cor; $('tgCores').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); });
    $('tgExcluir').onclick = () => { if (!tagEditando) return; const id = tagEditando.id; const est = E(); est.tags = est.tags.filter(x => x.id !== id); for (const m of est.movimentacoes) if (m.tags) m.tags = m.tags.filter(x => x !== id); gravar(); fecharTag(); renderTags(); };
    $('horizonteAnoAnt').onclick = () => moverH(-12); $('horizonteMesAnt').onclick = () => moverH(-1);
    $('horizonteMesProx').onclick = () => moverH(1); $('horizonteAnoProx').onclick = () => moverH(12);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (menuTag) fecharMenuTag(); else if (!$('ovTag').hidden) fecharTag(); } });
  }

  window.PlanilhaTelas = { montar, mostrar, renderTotais, renderTags, renderHorizonte };
})();
