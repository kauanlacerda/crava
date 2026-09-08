// Trabalhos: motor de regras + tela. Mesmo formato de dados do Crava
// (valor {q,m}, status, pagamento, recebido, liquidadoQ, liquidacoes…), pra
// que os trabalhos que já existem continuem valendo. No mock, persiste em
// localStorage; no app de verdade, a lista é S.jobs.
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hj = P.hoje();
  const COT = { USD: 5.14, RBX1k: 35 }; // no app de verdade: S.config.cotacaoUSD (ao vivo) e cotacaoRBX1k
  const MOEDA = {
    BRL: { fmt: v => P.fmtBRL(v), forma: 'Pix' },
    USD: { fmt: v => 'US$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), forma: 'PayPal' },
    RBX: { fmt: v => Number(v).toLocaleString('pt-BR') + ' Robux', forma: 'Robux' }
  };
  const fmtValor = (v) => (MOEDA[v.m] || MOEDA.BRL).fmt(v.q);
  const equivBRL = (q, m) => m === 'BRL' ? q : m === 'USD' ? q * COT.USD : (q / 1000) * COT.RBX1k;
  const DIAS_COBRAR = 3;

  // ---------- dados ----------
  const CHAVE = 'jobs-mock';
  let jobs = [];
  try { jobs = JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch { jobs = []; }
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(jobs)); } catch { } window.dispatchEvent(new CustomEvent('planilha:mudou')); };
  function semear() {
    if (jobs.length) return;
    const d = (n) => P.addDias(hj, n);
    jobs = [
      { id: 't1', titulo: 'Zed · Pack Halloween', cliente: 'zed', valor: { q: 100, m: 'USD' }, status: 'fazendo', pagamento: 'aguardando', recebido: 50, liquidadoQ: 50, liquidacoes: [{ em: d(-3) + 'T15:50:00.000Z', brl: 260, q: 50 }], prazo: d(2), criadoEm: d(-5) + 'T10:00:00.000Z', tempoTotalMs: 5400000 },
      { id: 't2', titulo: 'Furiqus · Thumb Nova flow', cliente: 'furiqus', valor: { q: 15000, m: 'RBX' }, status: 'entregue', pagamento: 'pago', recebido: 15000, liquidadoQ: 0, pagoEm: d(-1) + 'T12:00:00.000Z', entregueEm: d(-2) + 'T12:00:00.000Z', prazo: d(-1), criadoEm: d(-9) + 'T10:00:00.000Z' },
      { id: 't3', titulo: 'Theo · Thumb Get GFX', cliente: 'theo', valor: { q: 95, m: 'USD' }, status: 'entregue', pagamento: 'nao_pago', recebido: 0, entregueEm: d(-6) + 'T12:00:00.000Z', prazo: d(-6), criadoEm: d(-12) + 'T10:00:00.000Z' },
      { id: 't4', titulo: 'Kenzo · Icon Speed', cliente: 'kenzo', valor: { q: 450, m: 'BRL' }, status: 'entregue', pagamento: 'nao_pago', recebido: 0, entregueEm: d(-4) + 'T12:00:00.000Z', prazo: d(-4), criadoEm: d(-8) + 'T10:00:00.000Z' },
      { id: 't5', titulo: 'Giov · Banner', cliente: 'giov', valor: { q: 1200, m: 'BRL' }, status: 'aceito', pagamento: 'nao_pago', recebido: 0, prazo: d(5), criadoEm: d(-1) + 'T10:00:00.000Z' },
      { id: 't6', titulo: 'Soulzin · Icon + Thumb', cliente: 'soulzin', valor: { q: 260, m: 'USD' }, status: 'aprovado', pagamento: 'pago', recebido: 260, liquidadoQ: 260, liquidacoes: [{ em: d(-12) + 'T12:00:00.000Z', brl: 1340, q: 260 }], entregueEm: d(-14) + 'T12:00:00.000Z', prazo: d(-14), criadoEm: d(-20) + 'T10:00:00.000Z' },
      { id: 't7', titulo: 'Denis · Thumb Brainrot', cliente: 'denis', valor: { q: 25000, m: 'RBX' }, status: 'esperando', pagamento: 'nao_pago', recebido: 0, prazo: d(9), criadoEm: hj + 'T09:00:00.000Z' },
      { id: 't8', titulo: 'Lucas · Thumb Pack Verão', cliente: 'lucasgfx', valor: { q: 900, m: 'BRL' }, status: 'aceito', pagamento: 'aguardando', recebido: 450, liquidadoQ: 450, liquidacoes: [{ em: d(-1) + 'T12:00:00.000Z', brl: 450, q: 450 }], prazo: d(1), criadoEm: d(-2) + 'T10:00:00.000Z' }
    ];
    gravar();
  }

  // ---------- regras (as do Crava) ----------
  const recebidoDe = (j) => typeof j.recebido === 'number' ? j.recebido : (j.pagamento === 'pago' ? Number(j.valor.q) : 0);
  const liquidadoQDe = (j) => j.valor.m === 'BRL' ? recebidoDe(j) : (typeof j.liquidadoQ === 'number' ? Math.min(j.liquidadoQ, recebidoDe(j)) : (j.liquidado ? recebidoDe(j) : 0));
  const pendenteDe = (j) => Math.max(0, recebidoDe(j) - liquidadoQDe(j));
  const faltaDe = (j) => Math.max(0, Number(j.valor.q) - recebidoDe(j));
  const precisaLiquidar = (j) => j.valor.m !== 'BRL' && pendenteDe(j) > 0;
  function estagioPgto(j) {
    const r = recebidoDe(j), total = Number(j.valor.q);
    if (r <= 0) return 'nao_pago'; if (r < total) return 'parcial';
    if (j.valor.m === 'BRL' || !precisaLiquidar(j)) return 'na_conta'; return 'a_converter';
  }
  const ESTAGIO = { nao_pago: ['Não pago', 'faint'], parcial: ['Sinal', 'amber'], a_converter: ['A converter', 'blue'], na_conta: ['Na conta', 'green'] };
  const diasDesde = (iso) => iso ? Math.floor((Date.parse(hj + 'T00:00:00') - Date.parse(String(iso).slice(0, 10) + 'T00:00:00')) / 864e5) : 0;
  const entregueJa = (j) => ['entregue', 'aprovado'].includes(j.status);
  function prazoInfo(j) {
    if (!j.prazo) return { txt: '', cls: '' };
    if (entregueJa(j)) return { txt: `entregue ${fmtCurta(j.entregueEm || j.prazo)}`, cls: 'ok' };
    const d = -diasDesde(j.prazo);
    if (d < 0) return { txt: `${-d}d atrasado`, cls: 'atrasado' };
    if (d === 0) return { txt: 'hoje', cls: 'hoje' };
    if (d === 1) return { txt: 'amanhã', cls: 'perto' };
    return { txt: `em ${d} dias`, cls: d <= 3 ? 'perto' : '' };
  }
  const fmtCurta = (iso) => { const k = String(iso).slice(0, 10); return `${k.slice(8)}/${k.slice(5, 7)}`; };
  function registrarEntrada(j, brl, q, quando) {
    const em = quando || new Date().toISOString();
    if (!Array.isArray(j.liquidacoes)) j.liquidacoes = (j.liquidado && j.liquidadoBRL > 0) ? [{ em: j.liquidadoEm || j.pagoEm, brl: Number(j.liquidadoBRL), q: liquidadoQDe(j) }] : [];
    const ja = typeof j.liquidadoQ === 'number' ? j.liquidadoQ : liquidadoQDe(j);
    j.liquidacoes.push({ em, brl: Number(brl) || 0, q: Number(q) || 0 });
    j.liquidado = true; if (!j.liquidadoEm) j.liquidadoEm = em;
    j.liquidadoBRL = j.liquidacoes.reduce((a, e) => a + Number(e.brl || 0), 0);
    j.liquidadoQ = Math.min(recebidoDe(j), ja + (Number(q) || 0));
  }
  const zerarLiquidacao = (j) => { delete j.liquidado; delete j.liquidadoEm; delete j.liquidadoBRL; delete j.liquidadoQ; delete j.liquidacoes; };
  const ativo = () => jobs.find(j => j.status === 'fazendo' && !j.pausado);
  const filaOrdenada = () => jobs.filter(j => j.status === 'aceito' || (j.status === 'fazendo' && j.pausado)).sort((a, b) => (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1);
  function ativar(id) {
    const j = jobs.find(x => x.id === id); if (!j) return;
    for (const o of jobs) if (o.status === 'fazendo' && o.id !== id) o.pausado = true; // um por vez
    j.status = 'fazendo'; j.pausado = false; if (!j.iniciadoEm) j.iniciadoEm = new Date().toISOString();
    gravar(); render();
  }
  function avancar(id) {
    const j = jobs.find(x => x.id === id); if (!j) return;
    if (j.status === 'fazendo') { j.status = 'entregue'; j.entregueEm = new Date().toISOString(); j.pausado = false; }
    else if (j.status === 'entregue') { j.status = 'aprovado'; j.aprovadoEm = new Date().toISOString(); }
    gravar(); render();
  }
  function pausar(id) { const j = jobs.find(x => x.id === id); if (!j) return; j.pausado = !j.pausado; gravar(); render(); }
  function devolverFila(id) { const j = jobs.find(x => x.id === id); if (!j) return; j.status = 'aceito'; j.pausado = false; gravar(); render(); }
  function moverPara(id, status) {
    const j = jobs.find(x => x.id === id); if (!j || j.status === status) return;
    if (status === 'fazendo') return ativar(id);
    if (status === 'entregue' && !entregueJa(j)) { j.entregueEm = new Date().toISOString(); }
    j.status = status; j.pausado = false; gravar(); render();
  }
  function cobrei(id) { const j = jobs.find(x => x.id === id); if (j) { j.cobradoEm = hj; gravar(); render(); } }
  function excluir(id) { const j = jobs.find(x => x.id === id); if (!j) return; if (!confirm(`Excluir "${j.titulo}"?`)) return; jobs = jobs.filter(x => x.id !== id); gravar(); render(); }
  const aCobrar = () => jobs.filter(j => entregueJa(j) && faltaDe(j) > 0 && diasDesde(j.entregueEm) >= DIAS_COBRAR && j.cobradoEm !== hj).sort((a, b) => diasDesde(b.entregueEm) - diasDesde(a.entregueEm));
  function aReceber() {
    const lista = jobs.filter(j => entregueJa(j) && faltaDe(j) > 0);
    return { total: lista.reduce((s, j) => s + equivBRL(faltaDe(j), j.valor.m), 0), itens: lista, atrasados: lista.filter(j => diasDesde(j.entregueEm) >= DIAS_COBRAR).length };
  }
  function aConverter() { const out = { USD: 0, RBX: 0 }; for (const j of jobs) if (j.valor.m !== 'BRL' && pendenteDe(j) > 0) out[j.valor.m] += pendenteDe(j); return out; }

  // ---------- recebimento ----------
  let recebJob = null;
  function abrirRecebimento(id) {
    const j = jobs.find(x => x.id === id); if (!j) return; recebJob = j;
    $('rbDetalhe').textContent = `${j.titulo} · ${fmtValor(j.valor)} via ${MOEDA[j.valor.m].forma}`;
    $('rbValor').value = recebidoDe(j) || ''; $('rbMoeda').textContent = j.valor.m === 'BRL' ? 'R$' : j.valor.m === 'USD' ? 'US$' : 'RBX';
    $('ovReceb').hidden = false; setTimeout(() => $('rbValor').select(), 40);
  }
  function confirmarRecebimento() {
    const j = recebJob; if (!j) return;
    const total = Number(j.valor.q); const v = Math.max(0, Math.min(total, parseFloat(String($('rbValor').value).replace(/\./g, '').replace(',', '.')) || 0));
    const antes = recebidoDe(j); j.recebido = v; $('ovReceb').hidden = true; recebJob = null;
    if (v > 0 && !j.recebidoEm) j.recebidoEm = new Date().toISOString();
    if (v > 0 && j.status === 'esperando') j.status = 'aceito'; // o sinal chegou: entra na fila
    if (v <= 0) { j.pagamento = 'nao_pago'; delete j.pagoEm; delete j.recebidoEm; zerarLiquidacao(j); }
    else if (v < total) {
      j.pagamento = 'aguardando';
      if (j.valor.m === 'BRL') { if (v > antes) registrarEntrada(j, v - antes, v - antes); else { j.liquidacoes = [{ em: j.liquidadoEm || new Date().toISOString(), brl: v, q: v }]; j.liquidado = true; j.liquidadoBRL = v; j.liquidadoQ = v; } }
      else if (typeof j.liquidadoQ === 'number' && j.liquidadoQ > v) j.liquidadoQ = v;
    } else {
      j.pagamento = 'pago'; if (!j.pagoEm) j.pagoEm = new Date().toISOString();
      if (j.valor.m === 'BRL') { if (antes < total) registrarEntrada(j, total - antes, total - antes); }
      else if (antes < total && pendenteDe(j) > 0) { gravar(); render(); abrirLiquidacao(j.id); return; }
    }
    gravar(); render();
  }
  let liqJob = null;
  function abrirLiquidacao(id) {
    const j = jobs.find(x => x.id === id); if (!j) return; liqJob = j;
    const parte = pendenteDe(j);
    $('lqTitulo').textContent = j.valor.m === 'RBX' ? 'Vendeu os Robux!' : 'Caiu na conta!';
    $('lqDetalhe').textContent = `${j.titulo} · ${fmtValor({ q: parte, m: j.valor.m })}${parte < Number(j.valor.q) ? ` de ${fmtValor(j.valor)}` : ''}`;
    $('lqValor').value = (Math.round(equivBRL(parte, j.valor.m) * 100) / 100).toFixed(2).replace('.', ',');
    $('ovLiq').hidden = false; setTimeout(() => $('lqValor').select(), 40);
  }
  function confirmarLiquidacao() {
    const j = liqJob; if (!j) return;
    const v = parseFloat(String($('lqValor').value).replace(/\./g, '').replace(',', '.')) || 0;
    registrarEntrada(j, v, pendenteDe(j)); $('ovLiq').hidden = true; liqJob = null; gravar(); render();
  }

  // ---------- novo / editar ----------
  let editando = null;
  function abrirTrabalho(j) {
    editando = j || null;
    $('tbTitulo').textContent = j ? 'editar trabalho' : 'novo trabalho';
    $('tbNome').value = j ? j.titulo : ''; $('tbCliente').value = j ? (j.cliente || '') : '';
    $('tbValor').value = j ? String(j.valor.q).replace('.', ',') : ''; $('tbMoeda').value = j ? j.valor.m : 'BRL';
    $('tbPrazo').value = j ? (j.prazo || '') : ''; $('tbStatus').value = j ? j.status : 'aceito';
    $('tbStatusWrap').hidden = !!j; $('tbExcluir').hidden = !j;
    $('ovTrab').hidden = false; setTimeout(() => $('tbNome').focus(), 40);
  }
  function salvarTrabalho(e) {
    e.preventDefault();
    const titulo = $('tbNome').value.trim(); const q = parseFloat(String($('tbValor').value).replace(/\./g, '').replace(',', '.')) || 0;
    if (!titulo) { $('tbNome').focus(); return; } if (q <= 0) { $('tbValor').focus(); return; }
    if (editando) {
      const j = editando; j.titulo = titulo; j.cliente = $('tbCliente').value.trim(); j.prazo = $('tbPrazo').value || '';
      const m = $('tbMoeda').value; j.valor = { q, m };
      if (typeof j.recebido === 'number') j.recebido = Math.min(j.recebido, q);
      if (typeof j.liquidadoQ === 'number') j.liquidadoQ = Math.min(j.liquidadoQ, j.recebido);
      if (j.pagamento === 'pago' && j.recebido < q) j.pagamento = 'aguardando';
    } else {
      jobs.push({ id: P.novoId(), titulo, cliente: $('tbCliente').value.trim(), valor: { q, m: $('tbMoeda').value }, status: $('tbStatus').value, pagamento: 'nao_pago', recebido: 0, prazo: $('tbPrazo').value || '', criadoEm: new Date().toISOString() });
    }
    $('ovTrab').hidden = true; editando = null; gravar(); render();
  }

  // ---------- tela ----------
  let lente = 'etapa';
  const COLS_ETAPA = [
    { id: 'esperando', titulo: 'Esperando pagamento', sub: 'aceito, esperando o sinal', filtro: j => j.status === 'esperando' },
    { id: 'aceito', titulo: 'Na fila', sub: 'prontos pra começar', filtro: j => j.status === 'aceito' || (j.status === 'fazendo' && j.pausado) },
    { id: 'fazendo', titulo: 'Fazendo', sub: 'o trabalho ativo', filtro: j => j.status === 'fazendo' && !j.pausado },
    { id: 'entregue', titulo: 'Entregue', sub: 'entregues e aprovados', filtro: j => entregueJa(j) }
  ];
  const COLS_PGTO = [
    { id: 'nao_pago', titulo: 'Não pago', sub: 'nada entrou', filtro: j => estagioPgto(j) === 'nao_pago' },
    { id: 'parcial', titulo: 'Sinal / parcial', sub: 'entrou uma parte', filtro: j => estagioPgto(j) === 'parcial' },
    { id: 'a_converter', titulo: 'A converter', sub: 'recebido em dólar ou Robux', filtro: j => estagioPgto(j) === 'a_converter' },
    { id: 'na_conta', titulo: 'Na conta', sub: 'dinheiro de verdade', filtro: j => estagioPgto(j) === 'na_conta' }
  ];
  function cardHTML(j) {
    const est = estagioPgto(j); const [etxt, ecls] = ESTAGIO[est]; const pz = prazoInfo(j);
    const rec = recebidoDe(j), total = Number(j.valor.q);
    let din = etxt;
    if (est === 'parcial' && j.valor.m !== 'BRL') { const nc = liquidadoQDe(j), pend = pendenteDe(j); din = nc > 0 ? `${fmtValor({ q: nc, m: j.valor.m })} na conta${pend > 0 ? ' · ' + fmtValor({ q: pend, m: j.valor.m }) + ' a cair' : ''}` : (j.valor.m === 'RBX' ? 'a vender' : 'a cair na conta'); }
    if (est === 'a_converter') din = j.valor.m === 'RBX' ? 'a vender' : 'a cair na conta';
    const acoes = [];
    if (j.status === 'esperando') acoes.push(`<button type="button" class="btn btn-contorno btn-p" data-acao="fila" data-id="${j.id}">Pra fila</button>`);
    if (j.status === 'aceito' || (j.status === 'fazendo' && j.pausado)) acoes.push(`<button type="button" class="btn btn-primario btn-p" data-acao="ativar" data-id="${j.id}">Ativar</button>`);
    if (j.status === 'fazendo' && !j.pausado) acoes.push(`<button type="button" class="btn btn-primario btn-p" data-acao="avancar" data-id="${j.id}">Marcar entregue</button>`);
    if (j.status === 'entregue') acoes.push(`<button type="button" class="btn btn-contorno btn-p" data-acao="avancar" data-id="${j.id}">Aprovado</button>`);
    if (faltaDe(j) > 0) acoes.push(`<button type="button" class="btn btn-contorno btn-p" data-acao="receber" data-id="${j.id}">Recebi</button>`);
    if (precisaLiquidar(j)) acoes.push(`<button type="button" class="btn btn-contorno btn-p verde" data-acao="liquidar" data-id="${j.id}">${j.valor.m === 'RBX' ? 'Vendi' : 'Caiu na conta'}</button>`);
    return `<article class="tb-card ${pz.cls}" draggable="${lente === 'etapa'}" data-id="${j.id}">
      <div class="tb-topo"><div class="tb-titulo">${esc(j.titulo)}${j.status === 'aprovado' ? '<span class="chip chip-neutro">aprovado</span>' : ''}</div>
        <div class="tb-menu"><button type="button" class="btn-icone btn-ghost" data-acao="editar" data-id="${j.id}" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button type="button" class="btn-icone btn-ghost" data-acao="excluir" data-id="${j.id}" aria-label="Excluir"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>
      <div class="tb-meta"><span>${esc(j.cliente || 'sem cliente')}</span>${pz.txt ? `<span class="tb-prazo ${pz.cls}">${pz.txt}</span>` : ''}</div>
      <button type="button" class="tb-din ${est}" data-acao="receber" data-id="${j.id}" title="Registrar recebimento">
        <span class="tb-din-valor">${est === 'parcial' ? `${fmtValor({ q: rec, m: j.valor.m })} / ${fmtValor(j.valor)}` : fmtValor(j.valor)}</span>
        <span class="tb-din-forma">${MOEDA[j.valor.m].forma}</span>
        <span class="tb-din-estado ${ecls}">${din}</span>
        ${est === 'parcial' ? `<span class="tb-din-bar"><i style="width:${Math.round(rec / total * 100)}%"></i></span>` : ''}
      </button>
      ${acoes.length ? `<div class="tb-acoes">${acoes.join('')}</div>` : ''}
    </article>`;
  }
  function render() {
    if (!$('view-trabalhos') || $('view-trabalhos').hidden) return;
    // trabalho ativo
    const a = ativo(); const fila = filaOrdenada();
    const at = $('tbAtivo');
    if (a) {
      const pz = prazoInfo(a); const [etxt, ecls] = ESTAGIO[estagioPgto(a)];
      at.innerHTML = `<div class="ac-esq">
          <div class="ac-tag"><i></i>trabalho ativo</div>
          <div class="ac-titulo">${esc(a.titulo)}</div><div class="sub">${esc(a.cliente || 'sem cliente')}</div>
        </div>
        <div class="ac-dir">
          <div class="kv"><span>valor</span><b>${fmtValor(a.valor)}</b></div>
          <div class="kv"><span>prazo</span><b class="tb-prazo ${pz.cls}">${pz.txt || '—'}</b></div>
          <div class="kv"><span>pagamento</span><b class="chip chip-neutro ${ecls}">${etxt}</b></div>
        </div>`;
    } else {
      const prox = fila[0];
      at.innerHTML = `<div class="ac-vazio"><div class="ac-tag"><i class="off"></i>nenhum trabalho ativo</div>
        ${prox ? `<div class="ac-titulo">Próximo da fila: ${esc(prox.titulo)}</div><div class="sub">${esc(prox.cliente || '')}${prox.prazo ? ' · ' + prazoInfo(prox).txt : ''}</div>` : `<div class="sub">A fila está vazia. Crie um trabalho novo.</div>`}
      </div>`;
    }
    // cobrar
    const cob = aCobrar(); const cb = $('tbCobrar');
    cb.innerHTML = cob.length ? cob.map(j => `<div class="cb-item"><div><b>${esc(j.cliente || j.titulo)}</b><div class="sub">${esc(j.titulo)} · falta ${fmtValor({ q: faltaDe(j), m: j.valor.m })} · entregue há ${diasDesde(j.entregueEm)} dias</div></div><button type="button" class="btn btn-contorno btn-p" data-acao="cobrei" data-id="${j.id}">Cobrei</button></div>`).join('') : `<div class="sub" style="padding:.5rem 0">Ninguém devendo há mais de ${DIAS_COBRAR} dias.</div>`;
    $('tbCobrarN').textContent = cob.length;
    // quadro
    const cols = lente === 'etapa' ? COLS_ETAPA : COLS_PGTO;
    $('tbLente').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === lente));
    $('tbQuadro').innerHTML = cols.map(c => {
      const lista = jobs.filter(c.filtro).sort((x, y) => (x.prazo || '9999') < (y.prazo || '9999') ? -1 : 1);
      const soma = lista.reduce((s, j) => s + equivBRL(lente === 'etapa' ? (entregueJa(j) ? faltaDe(j) : Number(j.valor.q)) : Number(j.valor.q), j.valor.m), 0);
      return `<section class="tb-col" data-col="${c.id}">
        <header class="tb-col-cab"><div><h2>${c.titulo} <span class="tb-n">${lista.length}</span></h2><div class="sub">${c.sub}</div></div>${soma ? `<div class="sub tb-soma">${lente === 'etapa' && c.id === 'entregue' ? 'falta receber ' : ''}${P.fmtBRL(soma)}</div>` : ''}</header>
        <div class="tb-lista">${lista.map(cardHTML).join('') || `<div class="tb-vazio">vazio</div>`}</div>
      </section>`;
    }).join('');
  }

  // ---------- eventos ----------
  function acao(e) {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const id = b.dataset.id; const a = b.dataset.acao;
    if (a === 'ativar') ativar(id); else if (a === 'avancar') avancar(id); else if (a === 'pausar') pausar(id); else if (a === 'fila') devolverFila(id);
    else if (a === 'receber') abrirRecebimento(id); else if (a === 'liquidar') abrirLiquidacao(id); else if (a === 'cobrei') cobrei(id);
    else if (a === 'editar') abrirTrabalho(jobs.find(x => x.id === id)); else if (a === 'excluir') excluir(id);
  }
  function montar() {
    ['tbAtivo', 'tbCobrar', 'tbQuadro'].forEach(id => $(id).addEventListener('click', acao));
    $('tbLente').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { lente = b.dataset.v; render(); } });
    $('btnNovoTrabalho').onclick = () => abrirTrabalho(null);
    $('tbForm').onsubmit = salvarTrabalho; $('tbCancelar').onclick = () => { $('ovTrab').hidden = true; editando = null; }; $('tbFechar').onclick = $('tbCancelar').onclick;
    $('tbExcluir').onclick = () => { if (editando) { const id = editando.id; $('ovTrab').hidden = true; editando = null; excluir(id); } };
    $('rbForm').onsubmit = (e) => { e.preventDefault(); confirmarRecebimento(); };
    $('rbZero').onclick = () => { $('rbValor').value = 0; }; $('rbMetade').onclick = () => { if (recebJob) $('rbValor').value = Math.round(Number(recebJob.valor.q) / 2 * 100) / 100; }; $('rbTudo').onclick = () => { if (recebJob) $('rbValor').value = recebJob.valor.q; };
    $('rbCancelar').onclick = () => { $('ovReceb').hidden = true; recebJob = null; };
    $('lqForm').onsubmit = (e) => { e.preventDefault(); confirmarLiquidacao(); }; $('lqCancelar').onclick = () => { $('ovLiq').hidden = true; liqJob = null; };
    // arrastar e soltar entre colunas (só na lente por etapa)
    let arrastando = null;
    $('tbQuadro').addEventListener('dragstart', (e) => { const c = e.target.closest('.tb-card'); if (!c || lente !== 'etapa') { e.preventDefault(); return; } arrastando = c.dataset.id; c.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; });
    $('tbQuadro').addEventListener('dragend', () => { arrastando = null; $('tbQuadro').querySelectorAll('.arrastando, .alvo').forEach(x => x.classList.remove('arrastando', 'alvo')); });
    $('tbQuadro').addEventListener('dragover', (e) => { const col = e.target.closest('.tb-col'); if (!col || !arrastando) return; e.preventDefault(); $('tbQuadro').querySelectorAll('.alvo').forEach(x => x.classList.remove('alvo')); col.classList.add('alvo'); });
    $('tbQuadro').addEventListener('drop', (e) => { const col = e.target.closest('.tb-col'); if (!col || !arrastando) return; e.preventDefault(); moverPara(arrastando, col.dataset.col); });
    document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; for (const id of ['ovTrab', 'ovReceb', 'ovLiq']) if (!$(id).hidden) { $(id).hidden = true; } });
    for (const id of ['ovTrab', 'ovReceb', 'ovLiq']) $(id).addEventListener('click', (e) => { if (e.target === $(id)) $(id).hidden = true; });
  }
  window.Trabalhos = { montar, render, semear, lista: () => jobs, aReceber, aConverter, pendenteDe, faltaDe, abrirRecebimento, abrirLiquidacao, abrirTrabalho, estagioPgto, ativar };
})();
