// Tela Planilha › Saldos: grade de 12 meses, painel do dia, formulário de
// movimentação, check-in, ir pra hoje. Usa window.Planilha (modelo).
(() => {
  const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const LETRA = { entrada: 'E', saida: 'S', diario: 'D', economia: 'E', cartao: 'C' };
  const ICONE = { entrada: '↙', saida: '↗', diario: 'D', economia: 'E', cartao: 'C' };
  const REPETE = { mensal: 'mensalmente', semanal: 'semanalmente', diaria: 'diariamente', parcelado: 'parcelado' };

  // ---------- estado (por enquanto localStorage; depois S.fin) ----------
  const CHAVE = 'fin-mock';
  let E = P.estadoVazio();
  try { const s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (s && s.movimentacoes) E = { ...P.estadoVazio(), ...s }; } catch { }
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch { } };

  // dados de exemplo (os mesmos do app do Breno do usuário) quando pedido por ?semente=1
  function semear() {
    if (E.movimentacoes.length) return;
    const tFixo = P.novaTag(E, 'Fixo'), tGuga = P.novaTag(E, 'Cartão do guga'), tMerc = P.novaTag(E, 'Mercado'), tCom = P.novaTag(E, 'Comissão');
    P.adicionar(E, { tipo: 'entrada', valor: 15.87, nome: 'Saldo inicial', data: '2026-08-31' });
    P.adicionar(E, { tipo: 'saida', valor: 59.14, nome: 'Assinatura', data: '2026-09-01', repete: { tipo: 'mensal' } });
    P.adicionar(E, { tipo: 'saida', valor: 62.19, nome: 'Conta de luz', data: '2026-09-04', tags: [] });
    P.adicionar(E, { tipo: 'saida', valor: 2200, nome: 'Emprestimo', data: '2026-09-09' });
    P.adicionar(E, { tipo: 'saida', valor: 916.08, nome: 'Cartão do guga', data: '2026-09-09', repete: { tipo: 'mensal' }, tags: [tGuga.id] });
    P.adicionar(E, { tipo: 'saida', valor: 3000, nome: 'Fixo', data: '2026-09-10', repete: { tipo: 'mensal' }, tags: [tFixo.id] });
    P.adicionar(E, { tipo: 'entrada', valor: 1640.26, nome: 'Furiqus · Thumb Nova flow', data: '2026-09-08', tags: [tCom.id] });
    P.adicionar(E, { tipo: 'diario', valor: 72.64, nome: 'Mercado', data: '2026-09-07', tags: [tMerc.id] });
    P.adicionar(E, { tipo: 'diario', valor: 8.65, nome: 'Café', data: '2026-09-07' });
    P.adicionar(E, { tipo: 'economia', valor: 300, nome: 'Reserva', data: '2026-09-08' });
    P.adicionar(E, { tipo: 'cartao', valor: 1000, nome: 'Monitor', data: '2026-09-12', repete: { tipo: 'parcelado', parcelas: 3 } });
    E.checkins = ['2026-09-01', '2026-09-02', '2026-09-03'];
    gravar();
  }

  // ---------- período visível: 12 meses a partir de `inicio` ----------
  const hj = P.hoje();
  let inicio = { a: +hj.slice(0, 4), m: +hj.slice(5, 7) };
  const mesesVisiveis = () => { const out = []; for (let i = 0; i < 12; i++) { const t = inicio.a * 12 + (inicio.m - 1) + i; out.push({ a: Math.floor(t / 12), m: t % 12 + 1 }); } return out; };
  const rotuloPeriodo = () => { const v = mesesVisiveis(); return `${MES3[v[0].m - 1]}/${v[0].a} – ${MES3[v[11].m - 1]}/${v[11].a}`; };

  // ---------- grade ----------
  function renderMeses() {
    const cont = $('meses'); if (!cont) return;
    $('periodoRotulo').textContent = rotuloPeriodo();
    if (!E.movimentacoes.length) {
      cont.innerHTML = `<div class="vazio-planilha" style="width:100%">Nenhuma movimentação ainda. Use <b>+ Adicionar</b> na barra lateral, ou o + em qualquer célula.</div>`;
      return;
    }
    const cab = P.TIPOS.map(t => `<th><span class="tp"><span class="ic-tipo ${t}">${LETRA[t]}</span>${P.PLURAL[t]}</span></th>`).join('');
    cont.innerHTML = mesesVisiveis().map(({ a, m }) => {
      const r = P.resumoMes(E, a, m);
      const maxAbs = Math.max(1, ...r.dias.map(d => Math.abs(d.saldo)));
      const linhas = r.dias.map(d => {
        const cls = [d.fimDeSemana ? 'fds' : '', d.data === hj ? 'hoje' : '', d.checkin ? 'checkin' : ''].filter(Boolean).join(' ');
        const cels = P.TIPOS.map(t => `<td class="cel ${t}"><div class="cel-in">
          <button type="button" class="add" data-add="${t}" data-data="${d.data}" aria-label="Adicionar ${P.NOMES[t]} em ${d.dia} de ${MESES[m - 1]}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          <button type="button" class="ver ${d[t] ? 'tem' : 'zero'}" data-ver="${d.data}" data-tipo="${t}" aria-label="Ver ${P.PLURAL[t]} do dia ${d.dia}">${P.fmtBRL(d[t])}</button>
        </div></td>`).join('');
        const f = d.saldo < 0 ? (0.18 + 0.55 * Math.abs(d.saldo) / maxAbs).toFixed(2) : (0.06 + 0.25 * Math.abs(d.saldo) / maxAbs).toFixed(2);
        return `<tr class="${cls}" data-linha="${d.data}"><td class="dia"><button type="button" data-checkin="${d.data}" aria-label="Check-in do dia ${d.dia}" aria-pressed="${d.checkin}">${d.dia}</button></td>${cels}<td class="saldo ${d.saldo < 0 ? 'neg' : d.saldo > 0 ? 'pos' : ''}" style="--f:${f}"><button type="button" data-ver="${d.data}" data-tipo="" aria-label="Ver movimentações do dia ${d.dia}" style="width:100%;text-align:right">${P.fmtBRL(d.saldo)}</button></td></tr>`;
      }).join('');
      const tot = P.TIPOS.map(t => `<td><span class="tp"><span class="ic-tipo ${t}">${LETRA[t]}</span></span> ${P.fmtBRL(r.totais[t])}</td>`).join('');
      return `<section class="mes" data-mes="${a}-${String(m).padStart(2, '0')}">
        <div class="mes-titulo">${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} de ${a}</div>
        <div class="grade-dias"><table>
          <thead><tr><th>dia</th>${cab}<th>saldos</th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr><td></td>${tot}<td></td></tr></tfoot>
        </table></div>
      </section>`;
    }).join('');
  }

  // ---------- painel do dia ----------
  let diaAberto = null, filtro = '';
  function abrirDia(data, tipo) {
    diaAberto = data; filtro = tipo || '';
    $('painelDia').hidden = false;
    renderDia();
    $('pdFechar').focus();
  }
  function fecharDia() { $('painelDia').hidden = true; diaAberto = null; fecharMenu(); }
  function renderDia() {
    if (!diaAberto) return;
    const { a, m, d } = P.partes(diaAberto);
    $('pdData').textContent = `${d}/${MES3[m - 1]}`;
    $('pdFiltro').value = filtro;
    const itens = P.materializar(E.movimentacoes, diaAberto, diaAberto).filter(o => !filtro || o.mov.tipo === filtro);
    const lista = $('pdLista');
    if (!itens.length) { lista.innerHTML = `<div class="pd-vazio">Nada ${filtro ? 'em ' + P.PLURAL[filtro] : ''} neste dia.</div>`; return; }
    lista.innerHTML = itens.map(o => {
      const tags = (o.mov.tags || []).map(id => E.tags.find(t => t.id === id)).filter(Boolean).map(t => `<span class="tag-chip" style="--c:${t.cor}">${esc(t.nome)}</span>`).join('');
      const rep = o.mov.repete ? `<svg viewBox="0 0 24 24" aria-label="repete"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>` : '';
      const parc = o.parcela ? ` ${o.parcela}/${o.parcelas}` : '';
      return `<div class="pd-item" data-id="${o.mov.id}">
        <span class="ic-tipo ${o.mov.tipo}">${LETRA[o.mov.tipo]}</span>
        <div class="nome">${esc(o.mov.nome)}${parc}</div>
        <div class="valor">${P.fmtBRL(o.valor)}</div>
        <button type="button" class="btn-icone btn-ghost menu" data-menu="${o.mov.id}" aria-label="Opções"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg></button>
        <div class="meta">${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}${tags}</div>
        <div class="tipo-txt">${rep}${P.NOMES[o.mov.tipo]}</div>
      </div>`;
    }).join('');
  }
  let menuAberto = null;
  function fecharMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; } }
  function abrirMenu(btn, id) {
    fecharMenu();
    const m = E.movimentacoes.find(x => x.id === id); if (!m) return;
    const el = document.createElement('div'); el.className = 'pd-menu'; menuAberto = el;
    el.innerHTML = `<button type="button" data-acao="editar">Editar</button><div class="sep"></div>` + (m.repete
      ? `<button type="button" class="perigo" data-acao="excluir-dia">Excluir só este dia</button><button type="button" class="perigo" data-acao="encerrar">Encerrar a partir daqui</button><button type="button" class="perigo" data-acao="excluir">Excluir a regra inteira</button>`
      : `<button type="button" class="perigo" data-acao="excluir">Excluir</button>`);
    const item = btn.closest('.pd-item'); item.style.position = 'relative'; el.style.top = '2.25rem'; item.appendChild(el);
    el.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const acao = b.dataset.acao; fecharMenu();
      if (acao === 'editar') abrirEditar(m);
      else if (acao === 'excluir-dia') { P.excluir(E, m.id, diaAberto); depoisDeMudar(); }
      else if (acao === 'encerrar') { P.encerrarEm(E, m.id, diaAberto); depoisDeMudar(); }
      else if (acao === 'excluir') { P.excluir(E, m.id); depoisDeMudar(); }
    };
  }
  function depoisDeMudar() { gravar(); renderMeses(); if (diaAberto) renderDia(); }

  // ---------- formulário ----------
  let editando = null; let tagsSel = new Set();
  function abrirNovo(data, tipo) {
    editando = null; tagsSel = new Set();
    $('fmTitulo').textContent = 'adicionar';
    $('fmValor').value = ''; $('fmTipo').value = tipo || 'saida'; $('fmNome').value = ''; $('fmData').value = data || hj;
    $('fmRepete').value = 'nao'; $('fmParcelas').value = 2;
    $('fmExcluir').hidden = true;
    sincronizarForm(); $('ovMov').hidden = false; setTimeout(() => $('fmValor').focus(), 40);
  }
  function abrirEditar(m) {
    editando = m; tagsSel = new Set(m.tags || []);
    $('fmTitulo').textContent = 'editar';
    $('fmValor').value = String(m.valor).replace('.', ','); $('fmTipo').value = m.tipo; $('fmNome').value = m.nome; $('fmData').value = m.data;
    $('fmRepete').value = m.repete ? m.repete.tipo : 'nao'; $('fmParcelas').value = m.repete?.parcelas || 2;
    $('fmCartao').value = m.cartaoId || '';
    $('fmExcluir').hidden = false;
    sincronizarForm(); $('ovMov').hidden = false; setTimeout(() => $('fmValor').focus(), 40);
  }
  function fecharForm() { $('ovMov').hidden = true; editando = null; }
  function sincronizarForm() {
    const tipo = $('fmTipo').value;
    $('fmIcTipo').className = 'ic-tipo ' + tipo; $('fmIcTipo').textContent = LETRA[tipo];
    $('fmNome').placeholder = P.NOMES[tipo];
    $('fmSalvar').className = 'btn-tipo ' + tipo; $('fmSalvar').textContent = (editando ? 'salvar ' : 'adicionar ') + P.NOMES[tipo];
    $('fmParcelasWrap').hidden = $('fmRepete').value !== 'parcelado';
    $('fmCartaoWrap').hidden = tipo !== 'cartao';
    if (tipo === 'cartao') {
      const sel = $('fmCartao'); const atual = sel.value;
      sel.innerHTML = `<option value="">sem cartão</option>` + E.cartoes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
      sel.value = atual; $('fmCartaoAviso').hidden = E.cartoes.length > 0;
    }
    // tags
    $('fmChips').innerHTML = E.tags.map(t => `<button type="button" data-tag="${t.id}" class="${tagsSel.has(t.id) ? 'sel' : ''}" style="--c:${t.cor}">${esc(t.nome)}</button>`).join('') + `<input type="text" id="fmNovaTag" placeholder="+ nova tag" aria-label="Nova tag">`;
    $('fmNovaTag').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const t = P.novaTag(E, e.target.value); if (t) { tagsSel.add(t.id); gravar(); sincronizarForm(); } } };
  }
  function salvarForm(e) {
    e.preventDefault();
    const valor = parseFloat(String($('fmValor').value).replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) { $('fmValor').focus(); return; }
    const rep = $('fmRepete').value === 'nao' ? null : { tipo: $('fmRepete').value, parcelas: +$('fmParcelas').value || 2 };
    const dados = { tipo: $('fmTipo').value, valor, nome: $('fmNome').value, data: $('fmData').value || hj, repete: rep, tags: [...tagsSel], cartaoId: $('fmTipo').value === 'cartao' ? $('fmCartao').value : '' };
    if (editando) P.editar(E, editando.id, dados); else P.adicionar(E, dados);
    fecharForm(); depoisDeMudar();
    // se o mês do lançamento não está visível, traz pra perto
    const { a, m } = P.partes(dados.data); const idx = mesesVisiveis().findIndex(x => x.a === a && x.m === m);
    if (idx < 0) { inicio = { a, m }; renderMeses(); }
    rolarAte(dados.data);
  }

  // ---------- navegação ----------
  function rolarAte(data, marcar) {
    const { a, m } = P.partes(data);
    const mes = document.querySelector(`.mes[data-mes="${a}-${String(m).padStart(2, '0')}"]`); if (!mes) return;
    mes.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    const linha = mes.querySelector(`tr[data-linha="${data}"]`);
    if (linha) { linha.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (marcar) { linha.classList.add('marcada'); setTimeout(() => linha.classList.remove('marcada'), 1600); } }
  }
  function irParaHoje() {
    const { a, m } = P.partes(hj);
    if (!mesesVisiveis().some(x => x.a === a && x.m === m)) { inicio = { a, m }; renderMeses(); }
    rolarAte(hj, true);
  }
  function moverPeriodo(n) { const t = inicio.a * 12 + (inicio.m - 1) + n; inicio = { a: Math.floor(t / 12), m: t % 12 + 1 }; renderMeses(); }

  // ---------- montagem ----------
  function montar() {
    const q = new URLSearchParams(location.search);
    if (q.get('semente') === '1') semear();
    renderMeses();
    // estado inicial pela URL, pra captura e teste
    if (q.get('dia')) setTimeout(() => abrirDia(q.get('dia'), q.get('tipo') || ''), 50);
    if (q.get('novo') === '1') setTimeout(() => abrirNovo(q.get('dia') || hj, q.get('tipo') || 'saida'), 50);
    $('periodoAnoAnt').onclick = () => moverPeriodo(-12); $('periodoMesAnt').onclick = () => moverPeriodo(-1);
    $('periodoMesProx').onclick = () => moverPeriodo(1); $('periodoAnoProx').onclick = () => moverPeriodo(12);
    $('meses').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.add) abrirNovo(b.dataset.data, b.dataset.add);
      else if (b.dataset.ver) abrirDia(b.dataset.ver, b.dataset.tipo);
      else if (b.dataset.checkin) { P.alternarCheckin(E, b.dataset.checkin); depoisDeMudar(); }
    });
    // painel
    $('pdFechar').onclick = fecharDia;
    $('pdAnt').onclick = () => { diaAberto = P.addDias(diaAberto, -1); renderDia(); };
    $('pdProx').onclick = () => { diaAberto = P.addDias(diaAberto, 1); renderDia(); };
    $('pdAdd').onclick = () => abrirNovo(diaAberto, filtro || 'saida');
    $('pdFiltro').onchange = (e) => { filtro = e.target.value; renderDia(); };
    $('pdLista').addEventListener('click', (e) => { const b = e.target.closest('button[data-menu]'); if (b) { e.stopPropagation(); abrirMenu(b, b.dataset.menu); } });
    document.addEventListener('click', (e) => { if (menuAberto && !e.target.closest('.pd-menu') && !e.target.closest('[data-menu]')) fecharMenu(); });
    // formulário
    $('fmForm').onsubmit = salvarForm;
    $('fmCancelar').onclick = fecharForm; $('fmFechar').onclick = fecharForm;
    $('ovMov').addEventListener('click', (e) => { if (e.target === $('ovMov')) fecharForm(); });
    $('fmTipo').onchange = sincronizarForm; $('fmRepete').onchange = sincronizarForm;
    $('fmChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-tag]'); if (!b) return; const id = b.dataset.tag; if (tagsSel.has(id)) tagsSel.delete(id); else tagsSel.add(id); sincronizarForm(); });
    $('fmExcluir').onclick = () => { if (editando) { P.excluir(E, editando.id); fecharForm(); depoisDeMudar(); } };
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (menuAberto) { fecharMenu(); return; }
      if (!$('ovMov').hidden) { fecharForm(); return; }
      if (!$('painelDia').hidden) fecharDia();
    });
  }

  // abre a grade num mês / dia (usado por Totais, Tags e Horizonte)
  function irParaMes(a, m) { if (!mesesVisiveis().some(x => x.a === a && x.m === m)) { inicio = { a, m }; renderMeses(); } setTimeout(() => rolarAte(P.chave(a, m, 1)), 30); }
  function irParaDia(data) { const { a, m } = P.partes(data); if (!mesesVisiveis().some(x => x.a === a && x.m === m)) { inicio = { a, m }; renderMeses(); } setTimeout(() => rolarAte(data, true), 30); }
  window.Saldos = { montar, irParaHoje, irParaMes, irParaDia, abrirNovo, renderMeses, gravar, get estado() { return E; } };
})();
