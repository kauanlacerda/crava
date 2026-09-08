// Economia (guardado, meta, histórico) e Configurações.
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const E = () => window.Saldos.estado;
  const gravar = () => window.Saldos.gravar();
  const hj = P.hoje();
  const fmtData = (k) => `${+k.slice(8)} ${MES3[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

  // ---------- ECONOMIA ----------
  function renderEconomia() {
    if (!$('view-economia')) return;
    const est = window.Saldos.estadoCompleto();
    const todas = P.materializar(est.movimentacoes, '1970-01-01', hj).filter(o => o.mov.tipo === 'economia');
    const guardado = todas.reduce((s, o) => s + P.valorLiquido(o), 0);
    const meta = Number(E().metaEconomia) || 0;
    $('ecTotal').textContent = P.fmtBRL(guardado);
    $('ecMetaTxt').textContent = meta ? `de ${P.fmtBRL(meta)}` : 'sem meta definida';
    const pct = meta ? Math.min(100, guardado / meta * 100) : 0;
    $('ecBarra').style.setProperty('--w', pct.toFixed(0) + '%');
    $('ecChip').textContent = meta ? `${pct.toFixed(0)}% da meta` : 'sem meta';
    $('ecMetaInput').value = meta ? String(meta).replace('.', ',') : '';
    // este mês
    const { a, m } = P.partes(hj); const r = P.resumoMes(est, a, m);
    const pctMes = r.totais.entrada > 0 ? r.totais.economia / r.totais.entrada * 100 : 0;
    $('ecMes').textContent = P.fmtBRL(r.totais.economia);
    $('ecMesSub').textContent = r.totais.entrada > 0 ? `${pctMes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do que entrou em ${MES3[m - 1]}` : `nada entrou em ${MES3[m - 1]} ainda`;
    // 6 meses
    const bm = $('ecBarras'); bm.innerHTML = '';
    const meses = []; for (let i = 5; i >= 0; i--) { const t = a * 12 + (m - 1) - i; const aa = Math.floor(t / 12), mm = t % 12 + 1; meses.push({ rot: MES3[mm - 1], v: P.resumoMes(est, aa, mm).totais.economia }); }
    const maxM = Math.max(1, ...meses.map(x => Math.abs(x.v)));
    for (const x of meses) { const d = document.createElement('div'); d.innerHTML = `<i style="--h:${Math.max(3, Math.round(Math.abs(x.v) / maxM * 100))}%;${x.v < 0 ? 'background:var(--negativo)' : ''}" title="${P.fmtBRL(x.v)}"></i><span>${x.rot}</span>`; bm.appendChild(d); }
    // histórico
    const lista = $('ecLista');
    const hist = todas.slice().reverse().slice(0, 40);
    lista.innerHTML = hist.length ? hist.map(o => `
      <div class="tag-linha">
        <span class="ic-tipo economia">${o.mov.retirada ? '−' : '+'}</span>
        <span class="tag-nome">${esc(o.mov.nome)}<small class="sub"> · ${fmtData(o.data)}${o.mov.repete ? ' · repete' : ''}</small></span>
        <b class="${o.mov.retirada ? 'neg' : 'pos'}">${P.fmtBRL(P.valorLiquido(o), { sinal: true })}</b>
      </div>`).join('') : `<div class="vazio-planilha">Nada guardado ainda. Use <b>Guardar</b> aqui ou lance uma economia na planilha.</div>`;
  }

  // ---------- CONFIGURAÇÕES ----------
  function renderConfig() {
    if (!$('view-config')) return;
    const est = E();
    $('cfgAuto').checked = est.entradaAutomatica !== false;
    $('cfgAuto').setAttribute('aria-checked', String(est.entradaAutomatica !== false));
    const n = est.movimentacoes.length, t = est.tags.length, c = est.cartoes.length;
    $('cfgResumoDados').textContent = `${n} ${n === 1 ? 'lançamento' : 'lançamentos'} · ${t} ${t === 1 ? 'tag' : 'tags'} · ${c} ${c === 1 ? 'cartão' : 'cartões'} · ${(est.checkins || []).length} check-ins`;
  }
  function exportar() {
    const est = E();
    const blob = new Blob([JSON.stringify({ app: 'planilha', versao: 1, exportadoEm: new Date().toISOString(), dados: est }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `planilha-${hj}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importar(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const j = JSON.parse(leitor.result); const d = j.dados || j;
        if (!Array.isArray(d.movimentacoes)) throw new Error('sem movimentações');
        const est = E(); const antes = est.movimentacoes.length;
        if (!confirm(`Importar ${d.movimentacoes.length} lançamentos, ${(d.tags || []).length} tags e ${(d.cartoes || []).length} cartões? Isso substitui o que está aqui (${antes} lançamentos).`)) return;
        Object.assign(est, P.estadoVazio(), d);
        gravar(); renderConfig(); window.Saldos.renderMeses(); window.dispatchEvent(new CustomEvent('planilha:mudou'));
        $('cfgMsg').textContent = 'Importado.';
      } catch (e) { $('cfgMsg').textContent = 'Não consegui ler esse arquivo: ' + e.message; }
    };
    leitor.readAsText(arquivo);
  }
  function zerar() {
    const est = E();
    if (!confirm(`Apagar todos os ${est.movimentacoes.length} lançamentos, tags, cartões e check-ins da planilha? Isso não tem volta (exporte antes se quiser guardar).`)) return;
    Object.assign(est, P.estadoVazio());
    gravar(); renderConfig(); window.Saldos.renderMeses(); window.dispatchEvent(new CustomEvent('planilha:mudou'));
    $('cfgMsg').textContent = 'Planilha zerada.';
  }

  function mostrar(nome) { if (nome === 'economia') renderEconomia(); if (nome === 'config') renderConfig(); }
  function montar() {
    $('ecGuardar').onclick = () => window.Saldos.abrirNovo(hj, 'economia', { retirada: false });
    $('ecRetirar').onclick = () => window.Saldos.abrirNovo(hj, 'economia', { retirada: true });
    $('ecMetaForm').onsubmit = (e) => { e.preventDefault(); E().metaEconomia = parseFloat(String($('ecMetaInput').value).replace(/\./g, '').replace(',', '.')) || 0; gravar(); renderEconomia(); window.dispatchEvent(new CustomEvent('planilha:mudou')); };
    $('ecVerGrade').onclick = () => document.querySelector('[data-view="saldos"]').click();
    $('cfgAuto').onchange = (e) => { E().entradaAutomatica = e.target.checked; gravar(); renderConfig(); window.Saldos.renderMeses(); window.dispatchEvent(new CustomEvent('planilha:mudou')); };
    $('cfgPersonalizar').onclick = () => $('btnPersonalizar').click();
    $('cfgExportar').onclick = exportar;
    $('cfgImportar').onchange = (e) => { const f = e.target.files[0]; if (f) importar(f); e.target.value = ''; };
    $('cfgZerar').onclick = zerar;
    window.addEventListener('planilha:mudou', () => { if (!$('view-economia').hidden) renderEconomia(); if (!$('view-config').hidden) renderConfig(); });
  }
  window.Economia = { montar, mostrar, renderEconomia, renderConfig };
})();
