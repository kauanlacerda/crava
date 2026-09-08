// Dashboard: lê a planilha (movimentações, tags, cartões) e os trabalhos.
// Tudo é calculado no período escolhido e comparado com o período anterior
// de mesmo tamanho.
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const TIPO_ROTULO = { entrada: 'Entrada', saida: 'Saída', diario: 'Diário', economia: 'Economia', cartao: 'Cartão' };
  const hj = P.hoje();
  const COT = { get USD() { return window.Dados.cotacao().USD; }, get RBX1k() { return window.Dados.cotacao().RBX1k; } }; // ao vivo (Dados)

  // ---------- período ----------
  let preset = 'mes';
  function periodo() {
    const { a, m, d } = P.partes(hj);
    const ini = (k) => k.slice(0, 8) + '01';
    if (preset === 'mes') return { de: ini(hj), ate: P.chave(a, m, P.diasNoMes(a, m)) };
    if (preset === 'mes-passado') { const t = P.addMeses(ini(hj), -1, 1); const { a: a0, m: m0 } = P.partes(t); return { de: t, ate: P.chave(a0, m0, P.diasNoMes(a0, m0)) }; }
    if (preset === '30d') return { de: P.addDias(hj, -29), ate: hj };
    if (preset === '90d') return { de: P.addDias(hj, -89), ate: hj };
    if (preset === 'ano') return { de: `${a}-01-01`, ate: `${a}-12-31` };
    return { de: ini(hj), ate: hj };
  }
  function periodoAnterior(p) {
    const dias = Math.round((Date.parse(p.ate) - Date.parse(p.de)) / 864e5) + 1;
    const ate = P.addDias(p.de, -1); return { de: P.addDias(ate, -(dias - 1)), ate };
  }
  const fmtData = (k) => `${+k.slice(8)} ${MES3[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

  // ---------- leituras ----------
  const somaTipos = (ocs, tipos) => P.deCentavos ? 0 : 0; // (placeholder, não usado)
  function totais(est, p) {
    const t = { entrada: 0, saida: 0, diario: 0, economia: 0, cartao: 0 };
    for (const o of P.materializar(est.movimentacoes, p.de, p.ate)) t[o.mov.tipo] += Math.round(P.valorLiquido(o) * 100);
    for (const k in t) t[k] /= 100;
    return { ...t, gastos: t.saida + t.diario + t.cartao, lucro: t.entrada - t.saida - t.diario - t.economia - t.cartao };
  }
  const variacao = (atual, anterior) => {
    if (!anterior) return atual ? { brl: atual } : 0;
    if ((atual < 0) !== (anterior < 0)) return { brl: atual - anterior };
    return Math.round((atual - anterior) / Math.abs(anterior) * 1000) / 10;
  };
  function chipVar(v, invertido) {
    if (v === null || v === undefined) return `<span class="chip chip-neutro">novo</span>`;
    if (typeof v === 'object') { const bom = invertido ? v.brl <= 0 : v.brl >= 0; return `<span class="chip ${bom ? 'chip-pos' : 'chip-neg'}" title="diferença em relação ao período anterior">${P.fmtBRL(v.brl, { sinal: true })}</span>`; }
    const sobe = v > 0, zero = v === 0;
    const bom = zero ? true : invertido ? !sobe : sobe;
    const seta = sobe ? '<svg viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 8-8M14 7h7v7"/></svg>' : zero ? '' : '<svg viewBox="0 0 24 24"><path d="m3 7 6 6 4-4 8 8M14 17h7v-7"/></svg>';
    return `<span class="chip ${bom ? 'chip-pos' : 'chip-neg'}">${seta}${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>`;
  }
  function porTag(est, ocs) {
    const mapa = new Map(); let semTag = 0;
    for (const o of ocs) { const ids = o.mov.tags || []; if (!ids.length) { semTag += o.valor; continue; } for (const id of ids) mapa.set(id, (mapa.get(id) || 0) + o.valor); }
    const lista = [...mapa.entries()].map(([id, v]) => ({ tag: est.tags.find(t => t.id === id), valor: v })).filter(x => x.tag).sort((a, b) => b.valor - a.valor);
    if (semTag > 0) lista.push({ tag: { nome: 'Sem tag', cor: '#737373' }, valor: semTag });
    return lista;
  }

  // ---------- render ----------
  function render() {
    const est = window.Saldos.estadoCompleto();
    const p = periodo(), pa = periodoAnterior(p);
    const T = totais(est, p), TA = totais(est, pa);
    $('dbPeriodo').textContent = `${fmtData(p.de)} – ${fmtData(p.ate)}`;
    $('dbPreset').value = preset;

    // saldo: até o fim do período (ou hoje, se o período inclui hoje)
    const corte = p.ate < hj ? p.ate : hj;
    const saldo = P.saldoAntes(est.movimentacoes, P.addDias(corte, 1));
    const saldoAnt = P.saldoAntes(est.movimentacoes, P.addDias(pa.ate, 1));
    $('dbSaldo').textContent = P.fmtBRL(saldo); $('dbSaldoVar').innerHTML = chipVar(variacao(saldo, saldoAnt));
    $('dbLucro').textContent = P.fmtBRL(T.lucro); $('dbLucroVar').innerHTML = chipVar(variacao(T.lucro, TA.lucro));
    $('dbLucro').classList.toggle('neg', T.lucro < 0);
    $('dbGastos').textContent = P.fmtBRL(T.gastos); $('dbGastosVar').innerHTML = chipVar(variacao(T.gastos, TA.gastos), true);

    // a receber (trabalhos)
    const ar = window.Trabalhos.aReceber(COT);
    $('dbReceber').textContent = P.fmtBRL(ar.total);
    $('dbReceberVar').innerHTML = ar.atrasados ? `<span class="chip chip-neg">${ar.atrasados} ${ar.atrasados === 1 ? 'atrasado' : 'atrasados'}</span>` : `<span class="chip chip-neutro">${ar.itens.length} ${ar.itens.length === 1 ? 'aberto' : 'abertos'}</span>`;
    const mb = $('miniBarras'); mb.innerHTML = '';
    const dias = []; for (let i = 39; i >= 0; i--) { const k = P.addDias(hj, -i); let s = 0; for (const o of P.materializar(est.movimentacoes, k, k)) if (o.mov.tipo === 'entrada') s += o.valor; dias.push(s); }
    const maxD = Math.max(1, ...dias);
    for (const v of dias) { const i = document.createElement('i'); i.style.setProperty('--h', Math.max(4, Math.round(v / maxD * 100)) + '%'); i.style.opacity = v ? '.9' : '.25'; mb.appendChild(i); }

    // fontes de renda: entradas por tag
    const ocs = P.materializar(est.movimentacoes, p.de, p.ate);
    const fontes = porTag(est, ocs.filter(o => o.mov.tipo === 'entrada'));
    $('dbRendaTotal').textContent = P.fmtBRL(T.entrada); $('dbRendaVar').innerHTML = chipVar(variacao(T.entrada, TA.entrada));
    const top = fontes.slice(0, 4); const totalF = top.reduce((s, x) => s + x.valor, 0) || 1;
    const SERIES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)'];
    $('dbRendaBarra').innerHTML = top.map((x, i) => `<i style="--w:${(x.valor / totalF * 100).toFixed(1)}%;--c:${SERIES[i]}"></i>`).join('');
    $('dbRendaLista').innerHTML = top.length ? top.map((x, i) => `<li><i style="--c:${SERIES[i]}"></i><span>${esc(x.tag.nome)}</span><b>${P.fmtBRL(x.valor)}</b></li>`).join('') : `<li><span class="sub">Nenhuma entrada no período.</span></li>`;

    // gastos por mês (6 meses até o mês do fim do período)
    const bm = $('barrasMes'); bm.innerHTML = '';
    const { a: aF, m: mF } = P.partes(p.ate); const meses = [];
    for (let i = 5; i >= 0; i--) { const t = aF * 12 + (mF - 1) - i; const a = Math.floor(t / 12), m = t % 12 + 1; const r = P.resumoMes(est, a, m); meses.push({ rot: MES3[m - 1], v: r.totais.saida + r.totais.diario + r.totais.cartao }); }
    const maxM = Math.max(1, ...meses.map(x => x.v));
    for (const x of meses) { const d = document.createElement('div'); d.innerHTML = `<i style="--h:${Math.max(3, Math.round(x.v / maxM * 100))}%" title="${P.fmtBRL(x.v)}"></i><span>${x.rot}</span>`; bm.appendChild(d); }
    const ult = meses[5].v, pen = meses[4].v;
    let nota;
    if (!pen && !ult) nota = '<b>Sem gastos nos últimos meses</b>';
    else if (!pen) nota = '<b>Primeiro mês com gastos</b>';
    else { const pct = Math.round((ult - pen) / pen * 1000) / 10; nota = `<b>${pct > 0 ? 'Subiu' : pct < 0 ? 'Caiu' : 'Igual'} ${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em ${meses[5].rot}</b> ${pct > 0 ? '<svg viewBox="0 0 24 24"><path d="m3 17 6-6 4 4 8-8M14 7h7v7"/></svg>' : ''}`; }
    $('dbMesNota').innerHTML = nota;

    // resumo: gastos por tag
    const gastosTag = porTag(est, ocs.filter(o => ['saida', 'diario', 'cartao'].includes(o.mov.tipo)));
    const topG = gastosTag.slice(0, 4); const totG = gastosTag.reduce((s, x) => s + x.valor, 0);
    $('dbRoscaTotal').textContent = P.fmtCompacto(totG) === '0' ? 'R$ 0' : 'R$ ' + P.fmtCompacto(totG);
    const r = $('rosca'); r.innerHTML = '';
    const C = 2 * Math.PI * 50; let acc = 0;
    topG.forEach((x, i) => {
      const pct = totG ? x.valor / totG * 100 : 0;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', 50); c.setAttribute('stroke', `var(--chart-${i + 1})`);
      c.setAttribute('stroke-dasharray', `${Math.max(0, C * pct / 100 - 3)} ${C - C * pct / 100 + 3}`); c.setAttribute('stroke-dashoffset', -acc * C / 100 + C / 4);
      r.appendChild(c); acc += pct;
    });
    if (!topG.length) { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', 60); c.setAttribute('cy', 60); c.setAttribute('r', 50); c.setAttribute('stroke', 'var(--secundario)'); r.appendChild(c); }
    $('dbCatLista').innerHTML = topG.length ? topG.map((x, i) => `<li><i style="--c:var(--chart-${i + 1})"></i><span>${esc(x.tag.nome)}</span><b>${totG ? Math.round(x.valor / totG * 100) : 0}%</b></li>`).join('') : `<li><span class="sub">Sem gastos no período.</span></li>`;

    // lançamentos: os últimos até hoje
    const recentes = P.materializar(est.movimentacoes, P.addDias(hj, -60), hj).reverse().slice(0, 12); // deitado o CSS mostra 6; em pé, 12
    $('dbLancamentos').innerHTML = recentes.length ? recentes.map(o => {
      const ini = (o.mov.nome || '?').trim()[0].toUpperCase();
      const cor = o.mov.origem ? '#3b82f6' : { entrada: '#22c55e', saida: '#ef4444', diario: '#ec4899', economia: '#84cc16', cartao: '#8b5cf6' }[o.mov.tipo];
      const sinal = (o.mov.tipo === 'entrada' || o.mov.retirada) ? 'pos' : 'neg';
      return `<tr><td><span class="ava-l" style="--c:${cor}">${esc(ini)}</span>${esc(o.mov.nome)}${o.parcela ? ` ${o.parcela}/${o.parcelas}` : ''}</td><td>${fmtData(o.data)}</td><td><span class="chip chip-neutro">${TIPO_ROTULO[o.mov.tipo]}</span></td><td class="num ${sinal}">${P.fmtBRL((o.mov.tipo === 'entrada' || o.mov.retirada) ? o.valor : -o.valor, { sinal: true })}</td></tr>`;
    }).join('') : `<tr><td colspan="4" class="sub" style="text-align:center;height:4rem">Nenhum lançamento nos últimos 60 dias.</td></tr>`;

    // economia
    const guardadoTotal = P.materializar(est.movimentacoes, '1970-01-01', hj).filter(o => o.mov.tipo === 'economia').reduce((s, o) => s + P.valorLiquido(o), 0);
    const meta = Number(est.metaEconomia) || 0;
    $('dbEconomia').textContent = P.fmtBRL(guardadoTotal);
    $('dbEconomiaMeta').textContent = meta ? `de ${P.fmtBRL(meta)}` : `guardado até hoje · ${P.fmtBRL(T.economia)} neste período`;
    $('dbEconomiaChip').textContent = meta ? `${Math.min(100, Math.round(guardadoTotal / meta * 100))}% da meta` : 'sem meta';
    $('dbEconomiaBarra').style.setProperty('--w', meta ? Math.min(100, guardadoTotal / meta * 100).toFixed(0) + '%' : '0%');

    // carteira
    const conv = window.Trabalhos.aConverter();
    const cards = [{ cls: 'cartao-verde', t: 'Na conta', v: P.fmtBRL(saldo), s: 'saldo da planilha' }];
    if (conv.USD > 0) cards.push({ cls: 'cartao-azul', t: 'A converter', v: 'US$ ' + conv.USD.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), s: 'PayPal · ' + P.fmtBRL(conv.USD * COT.USD) });
    if (conv.RBX > 0) cards.push({ cls: 'cartao-roxo', t: 'A vender', v: conv.RBX.toLocaleString('pt-BR') + ' Robux', s: '≈ ' + P.fmtBRL(conv.RBX / 1000 * COT.RBX1k) });
    for (const c of (est.cartoes || []).slice(0, 2)) {
      const { a, m } = P.partes(hj); let f = null;
      for (let i = 0; i < 3; i++) { const t = a * 12 + (m - 1) + i; const ff = P.faturaCartao(est, c, Math.floor(t / 12), t % 12 + 1); if (hj >= ff.de && hj <= ff.ate) { f = ff; break; } }
      if (f) cards.push({ cls: 'cartao-custom', cor: c.cor, t: c.nome, v: P.fmtBRL(f.total), s: 'fatura aberta · vence ' + fmtData(f.vencimento) });
    }
    $('dbCarteira').innerHTML = cards.slice(0, 4).map(c => `<div class="carteira-cartao ${c.cls}" ${c.cor ? `style="background:linear-gradient(135deg, ${c.cor}, color-mix(in srgb, ${c.cor} 55%, #000))"` : ''}><small>${esc(c.t)}</small><b>${c.v}</b><span>${esc(c.s)}</span></div>`).join('');
  }

  function montar() {
    $('dbPreset').onchange = (e) => { preset = e.target.value; render(); };
    $('dbEntrada').onclick = () => window.Saldos.abrirNovo(hj, 'entrada');
    $('dbSaida').onclick = () => window.Saldos.abrirNovo(hj, 'saida');
    $('dbVerTodos').onclick = () => document.querySelector('[data-view="saldos"]').click();
    $('dbVerRelatorio').onclick = () => document.querySelector('[data-view="totais"]').click();
    $('dbVerResumo').onclick = () => document.querySelector('[data-view="tags"]').click();
    $('dbVerRenda').onclick = () => document.querySelector('[data-view="tags"]').click();
    $('dbVerEconomia').onclick = () => document.querySelector('[data-view="economia"]').click();
    $('dbNovoCartao').onclick = () => document.querySelector('[data-view="cartoes"]').click();
    window.addEventListener('planilha:mudou', () => { if (!$('view-dashboard').hidden) render(); });
  }
  window.Dashboard = { montar, render };
})();
