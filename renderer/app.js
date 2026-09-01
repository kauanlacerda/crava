// Crava — lógica da janela principal
let S = null; // estado completo {config, jobs, stats}

const $ = (id) => document.getElementById(id);
const hoje = () => new Date().toISOString().slice(0, 10);
const loc = () => (IDIOMA === 'en' ? 'en-US' : 'pt-BR');
const ontem = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

const MOEDA = {
  BRL: { fmt: (v) => `R$ ${fmtNum(v)}` },
  USD: { fmt: (v) => `US$ ${fmtNum(v)}` },
  RBX: { fmt: (v) => v >= 1000 ? `${fmtNum(v / 1000)}k Robux` : `${fmtNum(v)} Robux` }
};
function fmtNum(v) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
function fmtValor(valor) { return (MOEDA[valor.m] || MOEDA.BRL).fmt(valor.q); }

function diasAte(prazo) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo + 'T23:59:59') - Date.now()) / 864e5);
}
function prazoTexto(prazo) {
  const d = diasAte(prazo);
  if (d === null) return '';
  if (d < 0) return `${-d}d atrasado`;
  if (d === 0) return 'é HOJE';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}
function prazoClasse(prazo) {
  const d = diasAte(prazo);
  if (d === null) return '';
  if (d <= 1) return 'c-red';
  if (d <= 2) return 'c-amber';
  return '';
}

// ---------- Derivados ----------
const ativo = () => S.jobs.find(j => j.status === 'fazendo');
const abertos = () => S.jobs.filter(j => j.status !== 'aprovado' || j.pagamento !== 'pago');
const ocupados = () => S.jobs.filter(j => j.pagamento !== 'pago').length;

function concluidosHoje() {
  return S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 10) === hoje());
}
// quanto virou dinheiro de verdade (R$) e quando
function realizadoBRL(j) { return j.liquidado ? Number(j.liquidadoBRL || 0) : 0; }
function dataRealizado(j) { return j.liquidadoEm || j.pagoEm || ''; }

// R$: tudo que virou real no mês (inclui robux/dólar já vendidos)
// USD/RBX: o que entrou nessa moeda e AINDA não foi convertido
function ganhoMes(moeda) {
  const mes = hoje().slice(0, 7);
  if (moeda === 'BRL') {
    return S.jobs.filter(j => j.liquidado && dataRealizado(j).slice(0, 7) === mes)
      .reduce((a, j) => a + realizadoBRL(j), 0);
  }
  return S.jobs
    .filter(j => j.pagamento === 'pago' && !j.liquidado && j.valor.m === moeda && j.pagoEm && j.pagoEm.slice(0, 7) === mes)
    .reduce((a, j) => a + Number(j.valor.q), 0);
}
function totalPagoBRLequiv() {
  const c = S.config;
  return S.jobs.filter(j => j.pagamento === 'pago').reduce((a, j) => {
    if (j.liquidado) return a + realizadoBRL(j);
    if (j.valor.m === 'BRL') return a + Number(j.valor.q);
    if (j.valor.m === 'USD') return a + Number(j.valor.q) * c.cotacaoUSD;
    return a + (Number(j.valor.q) / 1000) * c.cotacaoRBX1k;
  }, 0);
}

// ---------- Persistência ----------
async function salvar() {
  try { verificarInsignias(); } catch { }
  await window.api.saveState(S);
  render();
}

// ---------- Ações ----------
function acumularTempo(j) {
  if (j.fazendoDesde) {
    j.tempoAcumulado = (j.tempoAcumulado || 0) + (Date.now() - j.fazendoDesde);
    delete j.fazendoDesde;
  }
}
async function tornarAtivo(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  const atual = ativo();
  if (atual && atual.id !== id) { acumularTempo(atual); atual.status = 'aceito'; atual.pausado = false; }
  j.status = 'fazendo';
  j.pausado = false;
  j.fazendoDesde = Date.now();
  await salvar();
}
// pausa/retoma o cronômetro sem largar o trabalho
async function pausarRetomar(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  if (j.pausado) { j.pausado = false; j.fazendoDesde = Date.now(); }
  else { acumularTempo(j); j.pausado = true; }
  await salvar();
}
// devolve o trabalho pra fila (o antigo "pausar")
async function voltarFila(id) {
  const j = S.jobs.find(x => x.id === id);
  if (j) { acumularTempo(j); j.status = 'aceito'; j.pausado = false; await salvar(); }
}
async function avancar(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  if (j.status === 'fazendo') {
    acumularTempo(j);
    j.tempoTotalMs = j.tempoAcumulado || 0;
    delete j.tempoAcumulado;
    j.pausado = false;
    j.status = 'entregue';
    j.entregueEm = new Date().toISOString();
    const dia = hoje();
    S.stats.historico[dia] = (S.stats.historico[dia] || 0) + 1;
    celebrar();
    checarMeta();
  } else if (j.status === 'entregue') {
    j.status = 'aprovado';
  } else if (j.status === 'aceito') {
    return tornarAtivo(id);
  }
  await salvar();
}
async function ciclarPagamento(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  const ordem = ['nao_pago', 'aguardando', 'pago'];
  j.pagamento = ordem[(ordem.indexOf(j.pagamento) + 1) % 3];
  if (j.pagamento === 'pago') {
    j.pagoEm = new Date().toISOString();
    if (j.valor.m === 'BRL') { j.liquidado = true; j.liquidadoEm = j.pagoEm; j.liquidadoBRL = Number(j.valor.q); abrirCofre(j); }
    else j.liquidado = false; // robux/dólar: só vira dinheiro depois da venda/conversão
  } else {
    delete j.liquidado; delete j.liquidadoEm; delete j.liquidadoBRL;
  }
  await salvar();
}
async function excluir(id) {
  if (!confirm(t('excluirConfirma'))) return;
  S.jobs = S.jobs.filter(x => x.id !== id);
  await salvar();
}
async function cobrei(id) {
  const j = S.jobs.find(x => x.id === id);
  if (j) { j.cobradoEm = hoje(); await salvar(); }
}

function checarMeta() {
  const n = concluidosHoje().length + 1; // +1: o que acabou de ser entregue ainda não re-renderizou
  if (n >= S.config.metaDiaria && S.stats.ultimoDiaMeta !== hoje()) {
    const seguido = S.stats.ultimoDiaMeta === ontem();
    S.stats.streak = seguido ? S.stats.streak + 1 : 1;
    S.stats.maxStreak = Math.max(S.stats.maxStreak, S.stats.streak);
    S.stats.ultimoDiaMeta = hoje();
    if (S.stats.recompensaMostrada !== hoje()) {
      S.stats.recompensaMostrada = hoje();
      $('metaDetalhe').textContent = `${S.config.metaDiaria} ${t('deConcluidos')} ${S.config.metaDiaria} ${t('concluidosHoje')}.`;
      $('metaStreak').textContent = `${t('streakDe')} ${S.stats.streak} ${S.stats.streak === 1 ? t('dia') : t('diasSeguidos')}`;
      $('ovMeta').classList.add('open');
    }
  }
}

// ---------- Celebração (estilo Duolingo) ----------
function celebrar() {
  const cores = ['#339dff', '#2fd39c', '#f5b74e', '#ff8fa3', '#a06bff', '#ff6b5e'];
  const frases = ['Mandou bem!', 'Cravou!', 'Mais uma!', 'Boa!', 'É isso!'];
  const el = document.createElement('div');
  el.className = 'celebra com-fundo';
  let html = `<img class="celebra-mascote" src="${spr('metaModal')}" alt="">`;
  html += `<div class="celebra-texto">${frases[Math.floor(Math.random() * frases.length)]}</div>`;
  for (let i = 0; i < 30; i++) {
    const c = cores[i % cores.length];
    const tx = (Math.random() * 2 - 1) * 320;
    const ty = -(100 + Math.random() * 300);
    const rot = Math.random() * 720 - 360;
    const dur = (1.3 + Math.random() * 0.9).toFixed(2);
    const s = 7 + Math.random() * 9;
    html += `<div class="confete" style="background:${c};width:${s}px;height:${s * 0.62}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;animation-duration:${dur}s"></div>`;
  }
  el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function streakVigente() {
  if (S.stats.ultimoDiaMeta === hoje() || S.stats.ultimoDiaMeta === ontem()) return S.stats.streak;
  return 0;
}

// ---------- Cofre ----------
let cofreJob = null;
function abrirCofre(j) {
  cofreJob = j;
  const pct = S.config.cofrePct;
  const guardar = Number(j.valor.q) * pct / 100;
  $('cofreDetalhe').textContent = `${j.titulo} · ${t('cofreEntrou')} ${fmtValor(j.valor)}`;
  $('cofreValor').textContent = `${t('cofreSepara')} ${fmtValor({ q: guardar, m: j.valor.m })} (${pct}%)`;
  $('ovCofre').classList.add('open');
}
function novoCofre(confirmado) {
  return {
    data: hoje(),
    valor: cofreJob ? fmtValor({ q: cofreJob.valor.q * S.config.cofrePct / 100, m: cofreJob.valor.m }) : '',
    q: cofreJob ? cofreJob.valor.q * S.config.cofrePct / 100 : 0,
    m: cofreJob ? cofreJob.valor.m : 'BRL',
    titulo: cofreJob ? cofreJob.titulo : '',
    confirmado
  };
}
$('cofreSim').onclick = async () => {
  S.stats.cofres.push(novoCofre(true));
  $('ovCofre').classList.remove('open');
  await salvar();
};
$('cofreDepois').onclick = async () => {
  S.stats.cofres.push(novoCofre(false));
  $('ovCofre').classList.remove('open');
  await salvar();
};
async function separeiCofre(idx) {
  const c = S.stats.cofres[idx];
  if (c) { c.confirmado = true; c.confirmadoEm = hoje(); await salvar(); }
}
$('metaFechar').onclick = () => $('ovMeta').classList.remove('open');

// ---------- Render ----------
function render() {
  IDIOMA = S.config.idioma === 'en' ? 'en' : 'pt';
  aplicarIdiomaHTML();
  document.documentElement.dataset.theme = S.config.tema || 'escuro';
  document.documentElement.dataset.cor = S.config.cor || 'azul';
  atualizarSprites();

  // saudação e data
  const h = new Date().getHours();
  const sauda = h < 12 ? t('bomDia') : h < 18 ? t('boaTarde') : t('boaNoite');
  $('saudacao').textContent = `${sauda}, ${S.config.nome || 'você'}`;
  $('dataHoje').textContent = new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });

  // chips
  const st = streakVigente();
  $('chipStreak').textContent = `${st} ${st === 1 ? t('dia') : t('dias')}`;

  // slots
  const occ = ocupados(), tot = S.config.slots;
  $('slotsCount').textContent = `${occ} ${t('slotsDe')} ${tot} ${t('slots')}`;
  $('slotsBar').innerHTML = Array.from({ length: tot }, (_, i) =>
    `<div class="slot ${i < occ ? 'on' : ''}"></div>`).join('');

  renderStats();
  renderUser();
  renderAtivo();
  renderFila();
  renderCofrePendente();
  renderCobrador();
  renderTodos();
  renderInsignias();
  renderConfig();
  renderCalendario();
  try { desenharViz(); } catch { }
  try { renderCarteira(); renderMoedas(); calcularConversao(); } catch { }
}

// ---------- Stat cards (fileira do topo, como no design) ----------
function renderStats() {
  const feitos = concluidosHoje().length, meta = S.config.metaDiaria;
  const segs = Array.from({ length: meta }, (_, i) =>
    `<div class="seg ${i < feitos ? 'done' : i === feitos ? 'active' : ''}" style="flex-grow:1"></div>`).join('');

  // prazo mais próximo entre trabalhos abertos
  const comPrazo = S.jobs.filter(j => j.prazo && (j.status !== 'aprovado' || j.pagamento !== 'pago'))
    .sort((a, b) => a.prazo < b.prazo ? -1 : 1);
  const prox = comPrazo[0];

  // a receber = pagamento aguardando
  const rec = { BRL: 0, USD: 0, RBX: 0 };
  let recN = 0;
  for (const j of S.jobs) if (j.pagamento === 'aguardando') { rec[j.valor.m] += Number(j.valor.q); recN++; }
  const recParts = [];
  if (rec.BRL) recParts.push(MOEDA.BRL.fmt(rec.BRL));
  if (rec.USD) recParts.push(MOEDA.USD.fmt(rec.USD));
  if (rec.RBX) recParts.push(MOEDA.RBX.fmt(rec.RBX));

  const gb = ganhoMes('BRL'), gu = ganhoMes('USD'), gr = ganhoMes('RBX');
  const gSubs = [];
  if (gu) gSubs.push(MOEDA.USD.fmt(gu));
  if (gr) gSubs.push(MOEDA.RBX.fmt(gr));

  const glow = S.config.glowCards !== false;
  const badge = glow ? '<div class="arrow-badge">↗</div>' : '';
  $('statRow').innerHTML = `
    <div class="stat-card ${glow ? 'solid-blue' : ''}">
      ${badge}
      <div class="stat-label">${t('statMeta')}</div>
      <div class="stat-value">${feitos}<span style="opacity:0.7;font-size:18px"> / ${meta}</span></div>
      <div class="stat-segs">${segs}</div>
      <div class="stat-sub ${glow ? '' : (feitos >= meta ? 'c-green' : 'c-blue')}">${feitos >= meta ? t('metaBatidaSub') : `${t('faltam')} ${meta - feitos} ${t('proJogo')}`}</div>
    </div>
    <div class="stat-card ${glow ? 'solid-orange' : ''}">
      ${badge}
      <div class="stat-label">${t('statReceber')}</div>
      <div class="stat-value ${glow ? '' : 'c-amber'}">${recParts[0] || 'R$ 0'}</div>
      <div class="stat-sub">${recParts.length > 1 ? '+ ' + recParts.slice(1).join(' · ') : `${recN} ${recN === 1 ? t('trabalho') : t('trabalhos')} ${t('aguardandoPgtoSub')}`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t('statPrazo')}</div>
      <div class="stat-value ${prox ? prazoClasse(prox.prazo) || 'c-amber' : ''}">${prox ? prazoTexto(prox.prazo) : '—'}</div>
      <div class="stat-sub">${prox ? esc(prox.titulo) : t('nenhumPrazo')}</div>
    </div>
    <div class="stat-card ${glow ? 'solid-green' : ''}">
      ${badge}
      <div class="stat-label">${t('statGanho')}</div>
      <div class="stat-value ${glow ? '' : 'c-green'}">${MOEDA.BRL.fmt(gb)}</div>
      <div class="stat-sub">${gSubs.length ? '+ ' + gSubs.join(' · ') : t('soReais')}</div>
    </div>`;
}

// ---------- Card do usuário / perfil ----------
function avatarStyle() {
  return S.config.foto ? `background-image:url(${S.config.foto});background-size:cover;background-position:center` : '';
}
function renderUser() {
  const nome = S.config.nome || 'você';
  const user = S.config.usuario || '@' + nome.toLowerCase().replace(/\s+/g, '');
  $('userName').textContent = nome;
  $('userSub').textContent = user;
  $('userAvatar').textContent = S.config.foto ? '' : nome[0].toUpperCase();
  $('userAvatar').style.cssText = avatarStyle();
  $('perfilAvatar').textContent = S.config.foto ? '' : nome[0].toUpperCase();
  $('perfilAvatar').style.cssText = avatarStyle();
  $('perfilNomeShow').textContent = nome;
  $('perfilSubShow').textContent = `${user} · ${t('designer')}`;
  if (document.activeElement !== $('pfNome')) $('pfNome').value = nome === 'você' ? '' : nome;
  if (document.activeElement !== $('pfUser')) $('pfUser').value = S.config.usuario || '';

  // insígnia de destaque ao lado do nome
  const fav = S.config.insigniaFavorita;
  const ganhas = S.stats.insigniasGanhas || {};
  if (fav && ganhas[fav]) {
    $('userBadge').src = `../assets/insignias/${fav}.png`;
    $('userBadge').style.display = '';
    const b = INSIGNIAS.find(x => x.id === fav);
    $('userBadge').title = b ? b.nome : '';
  } else {
    $('userBadge').style.display = 'none';
  }
  renderFavPicker(ganhas, fav);
}

function renderFavPicker(ganhas, fav) {
  const desbloq = INSIGNIAS.filter(b => ganhas[b.id]);
  $('favPicker').innerHTML = desbloq.length
    ? desbloq.map(b => `
        <div class="fav-opt ${b.id === fav ? 'sel' : ''}" title="${b.nome}" onclick="escolherFavorita('${b.id}')">
          <img src="../assets/insignias/${b.id}.png" alt="">
        </div>`).join('')
    : `<div class="config-sub">${t('semInsignias')}</div>`;
}
async function escolherFavorita(id) {
  S.config.insigniaFavorita = S.config.insigniaFavorita === id ? '' : id;
  await salvar();
}

const PIPE = ['aceito', 'fazendo', 'entregue', 'aprovado'];
const pipeLabel = () => ({ aceito: t('aceito'), fazendo: t('fazendo'), entregue: t('entregue'), aprovado: t('aprovado') });
const pgtoChip = () => ({
  nao_pago: [t('naoPago'), 'bc-faint'],
  aguardando: [t('aguardandoPgto'), 'bc-amber'],
  pago: [t('pago'), 'bc-green']
});

function pipelineHTML(j) {
  const idx = PIPE.indexOf(j.status);
  return `<div class="pipeline">${PIPE.map((_, i) =>
      `<div class="pipe ${i < idx ? 'done' : i === idx ? 'now' : ''}"></div>`).join('')}</div>
    <div class="pipe-labels">${PIPE.map((p, i) =>
      `<div class="pipe-label ${i < idx ? 'done' : i === idx ? 'now' : ''}">${pipeLabel()[p]}</div>`).join('')}</div>`;
}

function renderAtivo() {
  const j = ativo();
  if (!j) {
    const prox = S.jobs.find(x => x.status === 'aceito');
    $('activeArea').innerHTML = `
      <div class="active-card" style="justify-content:center">
        <div class="empty-state" style="padding:18px 0">
          <div class="big">${t('nenhumAtivo')}</div>
          <div>${prox ? t('escolheFila') : t('filaVazia')}</div>
          ${prox ? `<div class="btn btn-primary" style="margin-top:6px;padding:10px 22px" onclick="tornarAtivo('${prox.id}')">${t('comecar')}: ${esc(prox.titulo)}</div>` : ''}
        </div>
      </div>`;
    return;
  }
  const [ptxt, pcls] = pgtoChip()[j.pagamento];
  const btnLabel = j.status === 'fazendo' ? t('btnMarcarEntregue') : t('btnMarcarAprovado');
  $('activeArea').innerHTML = `
    <div class="active-card">
      <div class="ac-left">
        <div class="ac-tag"><div class="dot"></div><div class="ac-tag-text">${t('trabalhoAtivo')}</div></div>
        <div><div class="ac-title">${esc(j.titulo)}</div><div class="ac-sub">${esc(j.cliente || t('semCliente'))}</div></div>
        ${pipelineHTML(j)}
      </div>
      <div class="ac-right">
        <div class="kv"><div class="kv-k">${t('valor')}</div><div class="kv-v">${fmtValor(j.valor)}</div></div>
        <div class="kv"><div class="kv-k">${t('prazo')}</div><div class="kv-v ${prazoClasse(j.prazo)}" style="font-size:12px">${prazoTexto(j.prazo) || '—'}</div></div>
        <div class="kv"><div class="kv-k">${t('pagamento')}</div><div class="badge-chip ${pcls} click" onclick="ciclarPagamento('${j.id}')">${ptxt}</div></div>
        <div class="ac-spacer"></div>
        ${precisaLiquidar(j) ? `<div class="btn btn-green" onclick="abrirLiquidacao('${j.id}')" style="margin-bottom:6px">${j.valor.m === 'RBX' ? t('btnVendi') : t('btnCaiu')}</div>` : ''}
        <div class="btn btn-primary" onclick="avancar('${j.id}')">✓ ${btnLabel}</div>
        <div class="btn-row">
          ${j.pagamento !== 'pago' ? `<div class="btn btn-green" onclick="ciclarPagamento('${j.id}')" style="font-size:12px">${t('btnRecebiPgto')}</div>` : ''}
          <div class="btn btn-ghost" onclick="pausarRetomar('${j.id}')" style="font-size:12px">${j.pausado ? t('btnRetomar') : t('btnPausar')}</div>
          <div class="btn btn-ghost" onclick="voltarFila('${j.id}')" style="font-size:12px;max-width:70px" title="${t('btnDevolverFila')}">${t('btnFila')}</div>
        </div>
      </div>
    </div>`;
}

function jobRowHTML(j, num, dim) {
  const [ptxt, pcls] = pgtoChip()[j.pagamento];
  const acts = [];
  if (j.status === 'aceito') acts.push(`<div class="mini-btn primary" onclick="tornarAtivo('${j.id}')">${t('btnCravar')}</div>`);
  if (j.status === 'entregue') acts.push(`<div class="mini-btn" onclick="avancar('${j.id}')">${t('btnAprovado')}</div>`);
  if (precisaLiquidar(j)) acts.push(`<div class="mini-btn liquidar" onclick="abrirLiquidacao('${j.id}')">${j.valor.m === 'RBX' ? t('btnVendi') : t('btnCaiu')}</div>`);
  acts.push(`<div class="mini-btn" onclick="excluir('${j.id}')">✕</div>`);
  return `
    <div class="job-row ${dim ? 'dim' : ''}">
      <div class="job-main">
        ${num ? `<div class="job-num">${num}</div>` :
          `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`}
        <div>
          <div class="job-title">${esc(j.titulo)}</div>
          <div class="job-client">${esc(j.cliente || '')} · ${pipeLabel()[j.status].toLowerCase()} · <span class="${prazoClasse(j.prazo)}">${prazoTexto(j.prazo) || t('semPrazo')}</span></div>
        </div>
      </div>
      <div class="job-foot">
        <div class="badge-chip ${pcls} click" onclick="ciclarPagamento('${j.id}')">${ptxt}</div>
        <div class="foot-spacer"></div>
        <div class="job-value">${fmtValor(j.valor)}</div>
        <div class="job-actions">${acts.join('')}</div>
      </div>
    </div>`;
}

function renderFila() {
  // fila ordenada por urgência: prazo mais próximo primeiro, sem prazo por último
  const fila = S.jobs.filter(j => j.status === 'aceito')
    .sort((a, b) => {
      const pa = a.prazo || '9999-99', pb = b.prazo || '9999-99';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
  const feitosHoje = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 10) === hoje());
  const esperandoPgto = feitosHoje.filter(j => j.pagamento !== 'pago');
  const pagos = feitosHoje.filter(j => j.pagamento === 'pago');
  let html = '';
  if (fila.length) {
    html += `<div class="section-label">${t('naFila')} · ${fila.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${fila.map((j, i) => jobRowHTML(j, i + 2, false)).join('')}</div>`;
  }
  if (esperandoPgto.length) {
    html += `<div class="section-label" style="margin-top:12px">${t('concluidosEsperando')} · ${esperandoPgto.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${esperandoPgto.map(j => jobRowHTML(j, null, false)).join('')}</div>`;
  }
  if (pagos.length) {
    html += `<div class="section-label" style="margin-top:12px">${t('concluidosPagos')} · ${pagos.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${pagos.map(j => jobRowHTML(j, null, true)).join('')}</div>`;
  }
  if (!html) html = `<div class="empty-state"><img src="${spr('espiar')}" alt="" style="width:64px;height:auto;image-rendering:pixelated;opacity:0.85"><div class="big">${t('diaLimpo')}</div><div>${t('capturaDica')}</div></div>`;
  $('filaArea').innerHTML = html;
}

// lembretes de cofre não separados (quem clicou "Depois" no popup)
function renderCofrePendente() {
  const pendentes = S.stats.cofres
    .map((c, idx) => ({ ...c, idx }))
    .filter(c => !c.confirmado);
  if (!pendentes.length) { $('cofreArea').innerHTML = ''; return; }
  $('cofreArea').innerHTML = pendentes.slice(0, 3).map(c => `
    <div class="cobrador" style="border-color:rgba(47,211,156,0.35);background:linear-gradient(rgba(47,211,156,0.08),rgba(47,211,156,0.08)),var(--panel)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="16" cy="13" r="1"/></svg>
      <div class="cobrador-text" style="color:var(--green)">${t('cofrePendente')}${c.valor ? `: ${t('cofreSepara2')} ${esc(c.valor)}` : ''}${c.titulo ? ` — ${esc(c.titulo)}` : ''} · ${t('desde')} ${c.data.split('-').reverse().join('/')}</div>
      <div class="cobrador-btn" style="background:var(--green)" onclick="separeiCofre(${c.idx})">${t('btnSeparei')}</div>
    </div>`).join('') +
    (pendentes.length > 3 ? `<div class="section-label">+ ${pendentes.length - 3} ${t('maisCofres')}</div>` : '');
}

function renderCobrador() {
  const alvo = S.jobs.find(j =>
    (j.status === 'entregue' || j.status === 'aprovado') &&
    j.pagamento === 'aguardando' && j.entregueEm &&
    (Date.now() - new Date(j.entregueEm)) > 2 * 864e5 &&
    j.cobradoEm !== hoje());
  if (!alvo) { $('cobradorArea').innerHTML = ''; return; }
  const dias = Math.floor((Date.now() - new Date(alvo.entregueEm)) / 864e5);
  $('cobradorArea').innerHTML = `
    <div class="cobrador">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
      <div class="cobrador-text">${esc(alvo.titulo)} está entregue há ${dias} dias sem pagamento. Cobra ${esc(alvo.cliente || 'o cliente')}.</div>
      <div class="cobrador-btn" onclick="cobrei('${alvo.id}')">${t('btnCobrei')}</div>
    </div>`;
}

let busca = '';
let verTodosPagos = false;

// colunas do quadro
// as colunas seguem SÓ a etapa do trabalho; o pagamento é um selo no card
const COLUNAS = [
  { id: 'fila', i18n: 'colFila', cor: 'var(--muted)', filtro: j => j.status === 'aceito' },
  { id: 'fazendo', i18n: 'colFazendo', cor: 'var(--blue)', filtro: j => j.status === 'fazendo' },
  { id: 'entregue', i18n: 'colEntregue', cor: 'var(--amber)', filtro: j => j.status === 'entregue' },
  { id: 'aprovado', i18n: 'colAprovado', cor: 'var(--green)', filtro: j => j.status === 'aprovado' }
];

function urgencia(j) {
  const d = diasAte(j.prazo);
  if (d === null) return 3;
  if (d < 0) return 0;      // atrasado
  if (d <= 1) return 1;     // hoje/amanhã
  if (d <= 3) return 2;
  return 3;
}
function classeUrgencia(j) {
  if (j.pagamento === 'pago' && j.status === 'aprovado') return '';
  const u = urgencia(j);
  return u === 0 ? 'urg-atrasado' : u === 1 ? 'urg-hoje' : u === 2 ? 'urg-perto' : '';
}

function cardKanbanHTML(j) {
  const [ptxt, pcls] = pgtoChip()[j.pagamento];
  const acts = [];
  if (j.status === 'aceito') acts.push(`<div class="mini-btn primary" onclick="event.stopPropagation();tornarAtivo('${j.id}')">${t('btnCravar')}</div>`);
  if (j.status === 'fazendo') acts.push(`<div class="mini-btn primary" onclick="event.stopPropagation();avancar('${j.id}')">${t('btnMarcarEntregue')}</div>`);
  if (j.status === 'entregue') acts.push(`<div class="mini-btn" onclick="event.stopPropagation();avancar('${j.id}')">${t('btnAprovado')}</div>`);
  if (precisaLiquidar(j)) acts.push(`<div class="mini-btn liquidar" onclick="event.stopPropagation();abrirLiquidacao('${j.id}')">${j.valor.m === 'RBX' ? t('btnVendi') : t('btnCaiu')}</div>`);
  acts.push(`<div class="mini-btn" onclick="event.stopPropagation();excluir('${j.id}')">✕</div>`);
  const prazo = prazoTexto(j.prazo);
  return `
    <div class="kb-card ${classeUrgencia(j)}" draggable="true" data-id="${j.id}">
      <div class="kb-titulo">${esc(j.titulo)}</div>
      <div class="kb-meta">
        <span class="kb-cliente">${esc(j.cliente || t('semCliente'))}</span>
        ${prazo ? `<span class="kb-prazo ${prazoClasse(j.prazo)}">${prazo}</span>` : ''}
      </div>
      <div class="kb-rodape">
        <div class="kb-valor">${fmtValor(j.valor)}</div>
        <div class="badge-chip ${pcls} click" onclick="event.stopPropagation();ciclarPagamento('${j.id}')">${ptxt}</div>
      </div>
      <div class="kb-acoes">${acts.join('')}</div>
    </div>`;
}

function renderTodos() {
  let todos = [...S.jobs];
  if (busca) todos = todos.filter(j => `${j.titulo} ${j.cliente || ''}`.toLowerCase().includes(busca));

  const html = COLUNAS.map(col => {
    let lista = todos.filter(col.filtro);
    if (col.id === 'aprovado') {
      // não pagos primeiro (dinheiro parado), depois os mais recentes
      lista.sort((a, b) => {
        const pa = a.pagamento === 'pago' ? 1 : 0, pb = b.pagamento === 'pago' ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (dataRealizado(b) || b.entregueEm || '').localeCompare(dataRealizado(a) || a.entregueEm || '');
      });
      if (!verTodosPagos && !busca) {
        const limite = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
        lista = lista.filter(j => j.pagamento !== 'pago' ||
          (dataRealizado(j) || j.entregueEm || '').slice(0, 10) >= limite);
      }
    } else {
      lista.sort((a, b) => {
        const u = urgencia(a) - urgencia(b);
        if (u !== 0) return u;
        return (a.prazo || '9999').localeCompare(b.prazo || '9999');
      });
    }
    // soma por moeda
    const soma = { BRL: 0, USD: 0, RBX: 0 };
    for (const j of lista) soma[j.valor.m] += Number(j.valor.q);
    const partes = [];
    if (soma.BRL) partes.push(MOEDA.BRL.fmt(soma.BRL));
    if (soma.USD) partes.push(MOEDA.USD.fmt(soma.USD));
    if (soma.RBX) partes.push(MOEDA.RBX.fmt(soma.RBX));
    const totalPagos = todos.filter(col.filtro).length;

    return `
      <div class="kb-col" data-col="${col.id}">
        <div class="kb-col-head" style="--col:${col.cor}">
          <span class="kb-col-nome">${t(col.i18n)}</span>
          <span class="kb-col-num">${lista.length}</span>
          <span class="kb-col-soma">${partes.join(' · ')}</span>
        </div>
        <div class="kb-lista">
          ${lista.length ? lista.map(cardKanbanHTML).join('') : `<div class="kb-vazio">${t('colVazia')}</div>`}
          ${col.id === 'aprovado' && totalPagos > lista.length && !verTodosPagos
            ? `<div class="kb-vertodos" onclick="alternarVerTodos()">${t('verTodos')} (${totalPagos})</div>` : ''}
          ${col.id === 'aprovado' && verTodosPagos
            ? `<div class="kb-vertodos" onclick="alternarVerTodos()">${t('verRecentes')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  $('listaTodos').innerHTML = `<div class="kanban">${html}</div>`;
  ligarDragDrop();
}
function alternarVerTodos() { verTodosPagos = !verTodosPagos; renderTodos(); }

// ---------- arrastar e soltar ----------
let arrastando = null;
// balanço: o card inclina pro lado que o mouse move e volta com molinha
let tiltAlvo = 0, tiltAtual = 0, tiltEl = null, tiltRaf = null, tiltUltimoX = 0;
function loopTilt() {
  tiltAtual += (tiltAlvo - tiltAtual) * 0.18;
  tiltAlvo *= 0.88; // sem movimento, volta ao centro
  if (tiltEl) tiltEl.style.transform = `scale(0.97) rotate(${tiltAtual.toFixed(2)}deg)`;
  if (Math.abs(tiltAtual) > 0.05 || Math.abs(tiltAlvo) > 0.05) tiltRaf = requestAnimationFrame(loopTilt);
  else { if (tiltEl) tiltEl.style.transform = ''; tiltRaf = null; }
}
function ligarDragDrop() {
  $('listaTodos').querySelectorAll('.kb-card').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      arrastando = el.dataset.id;
      el.classList.add('arrastando');
      tiltEl = el; tiltUltimoX = e.clientX; tiltAlvo = 0; tiltAtual = 0;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(loopTilt);
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', el.dataset.id); } catch { }
    });
    el.addEventListener('drag', (e) => {
      if (!e.clientX) return; // o último evento vem zerado
      const dx = e.clientX - tiltUltimoX;
      tiltUltimoX = e.clientX;
      tiltAlvo = Math.max(-15, Math.min(15, tiltAlvo + dx * 0.9));
      if (!tiltRaf) tiltRaf = requestAnimationFrame(loopTilt);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('arrastando');
      arrastando = null;
      tiltAlvo = 0;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(loopTilt);
      setTimeout(() => { if (tiltEl === el) { el.style.transform = ''; tiltEl = null; } }, 500);
      $('listaTodos').querySelectorAll('.kb-col').forEach(c => c.classList.remove('alvo'));
    });
  });
  $('listaTodos').querySelectorAll('.kb-col').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('alvo'); });
    col.addEventListener('dragleave', () => col.classList.remove('alvo'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('alvo');
      const id = arrastando || e.dataTransfer.getData('text/plain');
      if (id) await moverPara(id, col.dataset.col);
    });
  });
}

async function moverPara(id, coluna) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  if (coluna === 'fila') { acumularTempo(j); j.status = 'aceito'; j.pausado = false; }
  else if (coluna === 'fazendo') { return tornarAtivo(id); }
  else if (coluna === 'entregue') {
    if (j.status === 'fazendo') return avancar(id);   // conta a entrega e celebra
    j.status = 'entregue';
    if (!j.entregueEm) j.entregueEm = new Date().toISOString();
  }
  else if (coluna === 'aprovado') {
    if (!j.entregueEm) j.entregueEm = new Date().toISOString();
    j.status = 'aprovado';
  }
  await salvar();
}

// ---------- Insígnias ----------
// Helpers de métricas
function totalMoedaPaga(m) {
  return S.jobs.filter(j => j.pagamento === 'pago' && j.valor.m === m)
    .reduce((a, j) => a + Number(j.valor.q), 0);
}
function entregasDoMes(mes) {
  return S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 7) === mes);
}
function ganhoEquivDoMes(mes) {
  return S.jobs.filter(j => j.liquidado && dataRealizado(j).slice(0, 7) === mes)
    .reduce((a, j) => a + realizadoBRL(j), 0);
}
function mesesComAtividade() {
  const set = new Set();
  for (const j of S.jobs) {
    if (j.entregueEm) set.add(j.entregueEm.slice(0, 7));
    if (j.pagoEm) set.add(j.pagoEm.slice(0, 7));
  }
  return [...set].sort().reverse();
}
function algumMesPontual() {
  return mesesComAtividade().some(mes => {
    const doMes = entregasDoMes(mes);
    return doMes.length >= 5 && doMes.every(j => !j.prazo || j.entregueEm.slice(0, 10) <= j.prazo);
  });
}

const IC = {
  flame: '<path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.5-1.4-4.6-3-6.5-.5 1.2-1.3 2-2.5 2.5C13.8 9 14 5.5 11 2c-.3 3-1.5 4.7-3 6.2C6.4 9.8 5 11.9 5 15.5 5 19.2 7.6 22 12 22z"/>',
  bolt: '<path d="M13 2L4.1 12.5a1 1 0 0 0 .8 1.5H11l-1 8 8.9-10.5a1 1 0 0 0-.8-1.5H13z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.7-1.4-1.2-2.5-1.2-1.7 0-3 1-3 2.2s1.1 1.8 3 2c2 .2 3 .9 3 2.1 0 1.2-1.3 2.2-3 2.2-1.1 0-2-.5-2.5-1.2"/><path d="M12 6.5V8"/><path d="M12 16.5V18"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  robux: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" transform="rotate(45 12 12)"/><rect x="10" y="10" width="4" height="4" rx="0.5" transform="rotate(45 12 12)"/>',
  coroa: '<path d="M3 18h18"/><path d="M4 18l-1-9 5.5 4L12 5l3.5 8L21 9l-1 9z"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/><path d="M9 15l2 2 4-4"/>',
  dolar: '<path d="M12 2v20"/><path d="M17 6.5c-.8-1.2-2.5-2-5-2-3 0-5 1.5-5 3.6 0 2.2 2 3 5 3.4 3.3.5 5 1.4 5 3.6 0 2.1-2 3.6-5 3.6-2.5 0-4.2-.8-5-2"/>'
};

// Categorias da coleção (cada insígnia pode ter arte própria em
// assets/insignias/<id>.png — estilo NFT; sem arquivo, usa o ícone SVG)
const CATEGORIAS_INSIGNIAS = [
  { id: 'rotina', nome: 'ROTINA', i18n: 'catRotina' },
  { id: 'mes', nome: 'MÊS', i18n: 'catMes' },
  { id: 'brl', nome: 'GANHOS EM R$', i18n: 'catBrl' },
  { id: 'usd', nome: 'GANHOS EM US$', i18n: 'catUsd' },
  { id: 'rbx', nome: 'GANHOS EM ROBUX', i18n: 'catRbx' },
  { id: 'geral', nome: 'GERAL — TODAS AS MOEDAS', i18n: 'catGeral' }
];

const INSIGNIAS = [
  // ---- ROTINA ----
  { id: 'primeiro-crava', cat: 'rotina', nome: 'Primeiro Crava', desc: 'Sua primeira entrega', cor: 'var(--blue)', icon: IC.bolt,
    check: () => S.jobs.some(j => j.entregueEm) },
  { id: 'maquina', cat: 'rotina', nome: 'Máquina', desc: '5 entregas num único dia', cor: 'var(--blue)', icon: IC.bolt,
    check: () => Object.values(S.stats.historico).some(n => n >= 5) },
  { id: 'fabrica', cat: 'rotina', nome: 'Fábrica', desc: '10 entregas num único dia', cor: 'var(--blue)', icon: IC.bolt,
    check: () => Object.values(S.stats.historico).some(n => n >= 10) },
  { id: 'esquenta', cat: 'rotina', nome: 'Esquenta', desc: '3 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 3 },
  { id: 'semana', cat: 'rotina', nome: 'Semana Cravada', desc: '7 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 7 },
  { id: 'quinzena', cat: 'rotina', nome: 'Quinzena Bruta', desc: '14 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 14 },
  { id: 'ferro', cat: 'rotina', nome: 'Mês de Ferro', desc: '30 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 30 },
  { id: 'streak-60', cat: 'rotina', nome: 'Bimestre de Aço', desc: '60 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 60 },
  { id: 'streak-100', cat: 'rotina', nome: 'Centurião', desc: '100 dias de meta seguidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => S.stats.maxStreak >= 100 },
  // ---- MÊS ----
  { id: 'mes-10', cat: 'mes', nome: 'Mês Consistente', desc: '10 entregas num mês', cor: 'var(--blue)', icon: IC.calendario,
    check: () => mesesComAtividade().some(m => entregasDoMes(m).length >= 10) },
  { id: 'monstro', cat: 'mes', nome: 'Mês Monstro', desc: '20 entregas num mês', cor: 'var(--blue)', icon: IC.calendario,
    check: () => mesesComAtividade().some(m => entregasDoMes(m).length >= 20) },
  { id: 'mes-40', cat: 'mes', nome: 'Mês Lendário', desc: '40 entregas num mês', cor: 'var(--amber)', icon: IC.calendario,
    check: () => mesesComAtividade().some(m => entregasDoMes(m).length >= 40) },
  { id: 'mes-ouro', cat: 'mes', nome: 'Mês de Ouro', desc: 'R$ 20.000 recebidos num mês (equiv.)', cor: 'var(--amber)', icon: IC.coin,
    check: () => mesesComAtividade().some(m => ganhoEquivDoMes(m) >= 20000) },
  { id: 'mes-diamante', cat: 'mes', nome: 'Mês de Diamante', desc: 'R$ 50.000 recebidos num mês (equiv.)', cor: 'var(--amber)', icon: IC.coroa,
    check: () => mesesComAtividade().some(m => ganhoEquivDoMes(m) >= 50000) },
  { id: 'pontual', cat: 'mes', nome: 'Pontualidade', desc: 'Mês com 5+ entregas e zero atraso', cor: 'var(--green)', icon: IC.relogio,
    check: algumMesPontual },
  { id: 'pontual-3', cat: 'mes', nome: 'Relógio Suíço', desc: '3 meses com 5+ entregas e zero atraso', cor: 'var(--green)', icon: IC.relogio,
    check: () => mesesComAtividade().filter(mes => {
      const doMes = entregasDoMes(mes);
      return doMes.length >= 5 && doMes.every(j => !j.prazo || j.entregueEm.slice(0, 10) <= j.prazo);
    }).length >= 3 },
  // ---- GANHOS EM R$ ----
  { id: 'brl-250', cat: 'brl', nome: 'Primeira Grana', desc: 'R$ 250 recebidos em R$', cor: 'var(--green)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 250 },
  { id: 'brl-1k', cat: 'brl', nome: 'Primeiro Pila', desc: 'R$ 1.000 recebidos em R$', cor: 'var(--green)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 1000 },
  { id: 'brl-5k', cat: 'brl', nome: 'Cofrinho Cheio', desc: 'R$ 5.000 recebidos em R$', cor: 'var(--green)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 5000 },
  { id: 'brl-10k', cat: 'brl', nome: 'Dez Barão', desc: 'R$ 10.000 recebidos em R$', cor: 'var(--green)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 10000 },
  { id: 'brl-50k', cat: 'brl', nome: 'Cinquentão', desc: 'R$ 50.000 recebidos em R$', cor: 'var(--green)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 50000 },
  { id: 'brl-100k', cat: 'brl', nome: 'Clube dos 100k', desc: 'R$ 100.000 recebidos em R$', cor: 'var(--amber)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 100000 },
  { id: 'brl-500k', cat: 'brl', nome: 'Barão do Pix', desc: 'R$ 500.000 recebidos em R$', cor: 'var(--amber)', icon: IC.coin,
    check: () => totalMoedaPaga('BRL') >= 500000 },
  { id: 'brl-1m', cat: 'brl', nome: 'Milhão em Pila', desc: 'R$ 1.000.000 recebidos em R$', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('BRL') >= 1000000 },
  // ---- GANHOS EM US$ ----
  { id: 'usd-100', cat: 'usd', nome: 'Primeiro Dólar', desc: 'US$ 100 recebidos', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 100 },
  { id: 'usd-500', cat: 'usd', nome: 'Meio Grand', desc: 'US$ 500 recebidos', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 500 },
  { id: 'gringo', cat: 'usd', nome: 'Gringo', desc: 'US$ 1.000 recebidos', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 1000 },
  { id: 'usd-2500', cat: 'usd', nome: 'Um Quarto', desc: 'US$ 2.500 recebidos', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 2500 },
  { id: 'usd-5k', cat: 'usd', nome: 'Exportador', desc: 'US$ 5.000 recebidos', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 5000 },
  { id: 'usd-10k', cat: 'usd', nome: 'Dolarizado', desc: 'US$ 10.000 recebidos', cor: 'var(--amber)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 10000 },
  { id: 'usd-25k', cat: 'usd', nome: 'Gringo Rico', desc: 'US$ 25.000 recebidos', cor: 'var(--amber)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 25000 },
  { id: 'usd-50k', cat: 'usd', nome: 'Tio Sam', desc: 'US$ 50.000 recebidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('USD') >= 50000 },
  // ---- GANHOS EM ROBUX ----
  { id: 'rbx-1k', cat: 'rbx', nome: 'Robux de Bolso', desc: '1.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 1000 },
  { id: 'rbx-10k', cat: 'rbx', nome: 'Primeiros Robux', desc: '10.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 10000 },
  { id: 'rbx-50k', cat: 'rbx', nome: 'Bolso de Robux', desc: '50.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 50000 },
  { id: 'robuxeiro', cat: 'rbx', nome: 'Robuxeiro', desc: '100.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 100000 },
  { id: 'rbx-250k', cat: 'rbx', nome: 'Cofre de Robux', desc: '250.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 250000 },
  { id: 'rbx-500k', cat: 'rbx', nome: 'Magnata do Robux', desc: '500.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 500000 },
  { id: 'rei-robux', cat: 'rbx', nome: 'Rei dos Robux', desc: '1.000.000 Robux recebidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('RBX') >= 1000000 },
  { id: 'rbx-2m', cat: 'rbx', nome: 'Imperador do Robux', desc: '2.500.000 Robux recebidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('RBX') >= 2500000 },
  { id: 'rbx-5m', cat: 'rbx', nome: 'Deus do Robux', desc: '5.000.000 Robux recebidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('RBX') >= 5000000 },
  // ---- GERAL (soma equivalente de todas as moedas) ----
  { id: 'triplo', cat: 'geral', nome: 'Câmbio Triplo', desc: 'Recebeu em R$, US$ e Robux', cor: 'var(--flame)', icon: IC.bolt,
    check: () => totalMoedaPaga('BRL') > 0 && totalMoedaPaga('USD') > 0 && totalMoedaPaga('RBX') > 0 },
  { id: 'geral-5k', cat: 'geral', nome: 'Primeiro Salário', desc: 'R$ 5.000 no total (equiv.)', cor: 'var(--green)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 5000 },
  { id: 'dez-k', cat: 'geral', nome: 'Faturador', desc: 'R$ 10.000 no total (equiv.)', cor: 'var(--green)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 10000 },
  { id: 'geral-50k', cat: 'geral', nome: 'Empresa de Um', desc: 'R$ 50.000 no total (equiv.)', cor: 'var(--green)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 50000 },
  { id: 'cem-k', cat: 'geral', nome: 'Seis Dígitos', desc: 'R$ 100.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 100000 },
  { id: 'geral-250k', cat: 'geral', nome: 'Quarto de Milhão', desc: 'R$ 250.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 250000 },
  { id: 'geral-500k', cat: 'geral', nome: 'Meio Milhão', desc: 'R$ 500.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalPagoBRLequiv() >= 500000 },
  { id: 'geral-1m', cat: 'geral', nome: 'Milionário do Pixel', desc: 'R$ 1.000.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalPagoBRLequiv() >= 1000000 },
  { id: 'geral-2m', cat: 'geral', nome: 'Dois Milhões', desc: 'R$ 2.000.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalPagoBRLequiv() >= 2000000 },
  { id: 'geral-5m', cat: 'geral', nome: 'Lenda do GFX', desc: 'R$ 5.000.000 no total (equiv.)', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalPagoBRLequiv() >= 5000000 }
];
const CADEADO = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';

// registra a data em que cada insígnia foi conquistada (uma vez só)
function verificarInsignias() {
  let mudou = false;
  for (const b of INSIGNIAS) {
    if (!S.stats.insigniasGanhas) S.stats.insigniasGanhas = {};
    if (!S.stats.insigniasGanhas[b.id] && b.check()) {
      S.stats.insigniasGanhas[b.id] = hoje();
      mudou = true;
      try { new Notification(t('insigniaDesbloqueada'), { body: nomeInsignia(b) }); } catch { }
    }
  }
  return mudou;
}

function fmtMes(mes) {
  const [a, m] = mes.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[+m - 1]}/${a}`;
}

function insigniaHTML(b, ganhas) {
  const data = ganhas[b.id];
  const ok = !!data;
  return `
    <div class="insignia ${ok ? '' : 'locked'}" ${ok ? `style="border-color:${b.cor}66"` : ''}>
      <div class="insignia-icon">
        <img class="insignia-art" src="../assets/insignias/${b.id}.png" alt=""
          onerror="this.style.display='none';this.nextElementSibling.style.display=''">
        <svg style="display:none" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ok ? b.cor : 'var(--faint)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ok ? b.icon : CADEADO}</svg>
      </div>
      <div class="insignia-name">${nomeInsignia(b)}</div>
      <div class="insignia-desc">${descInsignia(b)}</div>
      ${ok ? `<div class="insignia-data">${t('conquistadaEm')} ${data.split('-').reverse().join('/')}</div>` : ''}
    </div>`;
}

function renderInsignias() {
  const ganhas = S.stats.insigniasGanhas || {};
  const n = INSIGNIAS.filter(b => ganhas[b.id]).length;
  $('insigniasGrid').innerHTML = CATEGORIAS_INSIGNIAS.map(cat => {
    const doCat = INSIGNIAS.filter(b => b.cat === cat.id);
    if (!doCat.length) return '';
    const nCat = doCat.filter(b => ganhas[b.id]).length;
    return `
      <div class="section-label" style="margin-top:14px">${t(cat.i18n)} · ${nCat}/${doCat.length}</div>
      <div class="insignias-grid" style="margin-top:9px">${doCat.map(b => insigniaHTML(b, ganhas)).join('')}</div>`;
  }).join('');
  $('insigniasCount').textContent = `· ${n} ${t('de')} ${INSIGNIAS.length}`;
  renderHistorico();
}

// ---------- Histórico mensal ----------
function renderHistorico() {
  const meses = mesesComAtividade();
  const ganhas = S.stats.insigniasGanhas || {};
  if (!meses.length) { $('historicoMeses').innerHTML = ''; return; }
  $('historicoMeses').innerHTML = `<div class="section-label" style="margin-top:16px">${t('historicoMes')}</div>` +
    meses.map(mes => {
      const doMes = entregasDoMes(mes);
      const atrasos = doMes.filter(j => j.prazo && j.entregueEm.slice(0, 10) > j.prazo).length;
      const g = { BRL: 0, USD: 0, RBX: 0 };
      for (const j of S.jobs) {
        if (j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 7) === mes) g[j.valor.m] += Number(j.valor.q);
      }
      const partes = [];
      if (g.BRL) partes.push(MOEDA.BRL.fmt(g.BRL));
      if (g.USD) partes.push(MOEDA.USD.fmt(g.USD));
      if (g.RBX) partes.push(MOEDA.RBX.fmt(g.RBX));
      const insMes = INSIGNIAS.filter(b => ganhas[b.id] && ganhas[b.id].slice(0, 7) === mes);
      return `
        <div class="mes-row">
          <div class="mes-nome">${fmtMes(mes)}</div>
          <div class="mes-stats">
            <span><b>${doMes.length}</b> ${doMes.length === 1 ? t('entrega') : t('entregas')}</span>
            <span class="${atrasos ? 'c-red' : 'c-green'}"><b>${atrasos}</b> ${atrasos === 1 ? t('atraso') : t('atrasos')}</span>
            <span class="c-green">${partes.length ? partes.join(' · ') : t('nadaRecebido')}</span>
          </div>
          <div class="mes-insignias">${insMes.map(b =>
            `<span class="mes-badge" style="border-color:${b.cor}66;color:${b.cor}" title="${b.desc}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${b.cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${b.icon}</svg>
              ${b.nome}</span>`).join('') || '<span class="mes-vazio">—</span>'}</div>
        </div>`;
    }).join('');
}

// ---------- Config ----------
function renderConfig() {
  const setIf = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  setIf('cfgMeta', S.config.metaDiaria);
  setIf('cfgSlots', S.config.slots);
  setIf('cfgCofre', S.config.cofrePct);
  setIf('cfgUSD', S.config.cotacaoUSD);
  setIf('cfgRBX', S.config.cotacaoRBX1k);
  document.querySelectorAll('#temaPicker .tema-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.tema === (S.config.tema || 'escuro')));
  document.querySelectorAll('#glowPicker .tema-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.glow === (S.config.glowCards !== false ? 'on' : 'off')));
  document.querySelectorAll('#idiomaPicker .tema-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.idioma === (S.config.idioma || 'pt')));
  document.querySelectorAll('#corPicker .cor-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.cor === (S.config.cor || 'azul')));
}
$('idiomaPicker').onclick = async (e) => {
  const i = e.target.dataset.idioma;
  if (i) { S.config.idioma = i; await salvar(); }
};
$('glowPicker').onclick = async (e) => {
  const g = e.target.dataset.glow;
  if (g) { S.config.glowCards = g === 'on'; await salvar(); }
};
$('corPicker').onclick = async (e) => {
  const c = e.target.dataset.cor;
  if (c) { S.config.cor = c; await salvar(); }
};
$('temaPicker').onclick = async (e) => {
  const t = e.target.dataset.tema;
  if (t) { S.config.tema = t; await salvar(); }
};
$('btnSalvarConfig').onclick = async () => {
  S.config.metaDiaria = Math.max(1, +$('cfgMeta').value || 5);
  S.config.slots = Math.max(1, +$('cfgSlots').value || 3);
  S.config.cofrePct = Math.min(90, Math.max(0, +$('cfgCofre').value || 30));
  S.config.cotacaoUSD = +$('cfgUSD').value || 5.4;
  S.config.cotacaoRBX1k = +$('cfgRBX').value || 28;
  await salvar();
};

// ---------- Navegação ----------
function abrirView(nome) {
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.view === nome));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('open'));
  $('view-' + nome).classList.add('open');
  if (nome === 'share') {
    drawShareCard();
    requestAnimationFrame(() => { try { desenharViz(); } catch { } });
  }
}
document.querySelectorAll('.nav-item').forEach(el => { el.onclick = () => abrirView(el.dataset.view); });
$('userCard').onclick = () => abrirView('perfil');
$('btnWidget').onclick = () => window.api.toggleWidget();

// busca da topbar — filtra a lista de trabalhos
$('searchInput').oninput = () => {
  busca = $('searchInput').value.trim().toLowerCase();
  if (busca && !$('view-trabalhos').classList.contains('open')) abrirView('trabalhos');
  renderTodos();
};

// ---------- Perfil ----------
$('btnFoto').onclick = () => $('fotoInput').click();
$('fotoInput').onchange = () => {
  const f = $('fotoInput').files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => { S.config.foto = r.result; await salvar(); };
  r.readAsDataURL(f);
};
$('btnSalvarPerfil').onclick = async () => {
  S.config.nome = $('pfNome').value.trim() || 'você';
  let u = $('pfUser').value.trim();
  if (u && !u.startsWith('@')) u = '@' + u;
  S.config.usuario = u;
  await salvar();
};

// ---------- Card do mês (share card estilo GMGN, fundo preto) ----------
let mascoteOn = true;

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Mascote (macaco) na cor escolhida ----------
const CORES_MASCOTE = ['azul', 'vermelho', 'verde', 'roxo', 'laranja', 'branco'];
const SLOTS = {
  logo: 'macaco-02.png',
  shareHead: 'macaco-02.png',
  shareBig: 'macaco-03.png',
  metaModal: 'macaco-03.png',
  cofre: 'macaco-06.png',
  espiar: 'macaco-01.png'
};
function spr(slot) {
  const c = S && CORES_MASCOTE.includes(S.config.cor) ? S.config.cor : 'azul';
  return `../assets/macaco/${c}/${SLOTS[slot]}`;
}

const MASCOTE_IMG = new Image();
const HEAD_IMG = new Image();
HEAD_IMG.onload = () => { if ($('view-share').classList.contains('open')) drawShareCard(); };
MASCOTE_IMG.onload = () => { if ($('view-share').classList.contains('open')) drawShareCard(); };
document.fonts.ready.then(() => { if ($('view-share').classList.contains('open')) drawShareCard(); });

function atualizarSprites() {
  const big = spr('shareBig'), head = spr('shareHead');
  if (!MASCOTE_IMG.src.includes(big.replace('../', ''))) MASCOTE_IMG.src = big;
  if (!HEAD_IMG.src.includes(head.replace('../', ''))) HEAD_IMG.src = head;
  $('logoImg').src = spr('logo');
  $('metaImg').src = spr('metaModal');
  $('cofreImg').src = spr('cofre');
  if (S.config.shareMidia) {
    const alvo = midiaSrc(S.config.shareMidia);
    if (alvo && MEDIA_IMG.src !== alvo) {
      MEDIA_IMG.src = alvo;
      prepararGifPreview();
    }
  }
  if (S.config.calMidia) {
    const alvoCal = midiaSrc(S.config.calMidia);
    if (alvoCal && CAL_MEDIA_IMG.src !== alvoCal) { CAL_MEDIA_IMG.src = alvoCal; prepararCalGif(); }
  }
  const fav = S.config.insigniaFavorita;
  if (fav && !FAV_IMG.src.includes(`insignias/${fav}.png`)) FAV_IMG.src = `../assets/insignias/${fav}.png`;
}

const CW = 1120, CH = 680;

function drawFundo(ctx) {
  rrect(ctx, 0, 0, CW, CH, 44);
  ctx.fillStyle = '#060608';
  ctx.fill();
}

// mídia como FUNDO do card (cover), com opacidade controlável
function drawMediaLayer(ctx, fonte, alpha) {
  const fw = fonte.naturalWidth || fonte.displayWidth || fonte.codedWidth || fonte.width;
  const fh = fonte.naturalHeight || fonte.displayHeight || fonte.codedHeight || fonte.height;
  if (!fw || !fh) return;
  const esc = Math.max(CW / fw, CH / fh);
  const dw = fw * esc, dh = fh * esc;
  ctx.save();
  rrect(ctx, 0, 0, CW, CH, 44);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(fonte, (CW - dw) / 2, (CH - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
  // véu escuro leve pra manter o texto legível
  ctx.fillStyle = 'rgba(8, 12, 24, 0.35)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.restore();
}

function drawConteudo(ctx) {
  const F = (w, s) => `${w} ${s}px Manrope, "Segoe UI", sans-serif`;
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

  // topo: mascote + nome + mês (como o card da GMGN)
  if (HEAD_IMG.complete && HEAD_IMG.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    const hw = 72, hh = hw * HEAD_IMG.naturalHeight / HEAD_IMG.naturalWidth;
    ctx.drawImage(HEAD_IMG, 52, 44, hw, hh);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.fillStyle = '#eef2f9'; ctx.font = "28px 'Press Start 2P', Manrope, monospace"; ctx.fillText('CRAVA', 140, 92);
  ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 22); ctx.textAlign = 'right';
  ctx.fillText(mes, CW - 56, 88); ctx.textAlign = 'left';

  // faturamento
  const gb = ganhoMes('BRL'), gu = ganhoMes('USD'), gr = ganhoMes('RBX');
  ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 24); ctx.fillText(t('faturei'), 56, 190);
  ctx.fillStyle = '#34d399'; ctx.font = F(800, 84);
  ctx.fillText(MOEDA.BRL.fmt(gb), 52, 272);
  const subs = [];
  if (gu) subs.push(MOEDA.USD.fmt(gu));
  if (gr) subs.push(MOEDA.RBX.fmt(gr));
  if (subs.length) { ctx.fillStyle = '#c3d0e8'; ctx.font = F(700, 26); ctx.fillText('+ ' + subs.join(' · '), 56, 314); }

  // mascote (só quando não tem mídia de fundo disputando atenção o toggle decide)
  if (mascoteOn && MASCOTE_IMG.complete && MASCOTE_IMG.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    const mh = 230, mw = mh * MASCOTE_IMG.naturalWidth / MASCOTE_IMG.naturalHeight;
    ctx.drawImage(MASCOTE_IMG, CW - mw - 64, 116, mw, mh);
    ctx.imageSmoothingEnabled = true;
  }

  // stats
  const mesKey = hoje().slice(0, 7);
  const trab = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 7) === mesKey).length;
  const pagosTot = S.jobs.filter(j => j.pagamento === 'pago').length;
  const ticket = pagosTot ? Math.round(totalPagoBRLequiv() / pagosTot) : 0;
  const nIns = Object.keys(S.stats.insigniasGanhas || {}).length;
  const mx = S.stats.maxStreak;
  const stats = [
    [t('trabalhosCard'), String(trab), '#eef2f9'],
    [t('maiorStreak'), `${mx} ${mx === 1 ? t('dia') : t('dias')}`, '#fbbf24'],
    [t('ticketMedio'), `R$ ${fmtNum(ticket)}`, '#eef2f9'],
    [t('insigniasCard'), String(nIns), '#34d399']
  ];
  let sx = 56;
  for (const [lab, val, cor] of stats) {
    ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 19); ctx.fillText(lab, sx, 408);
    ctx.fillStyle = cor; ctx.font = F(800, 33); ctx.fillText(val, sx, 448);
    sx += Math.max(ctx.measureText(val).width, ctx.measureText(lab).width) + 70;
  }

  // rodapé: avatar + nome + selo
  const nome = S.config.nome || 'você';
  const user = S.config.usuario || '@' + nome.toLowerCase().replace(/\s+/g, '');
  const ay = CH - 120;
  const ag = ctx.createLinearGradient(56, ay, 120, ay + 64);
  ag.addColorStop(0, '#3b82f6'); ag.addColorStop(1, '#1d4ed8');
  ctx.beginPath(); ctx.arc(88, ay + 32, 32, 0, 7); ctx.fillStyle = ag; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = F(800, 26); ctx.textAlign = 'center';
  ctx.fillText(nome[0].toUpperCase(), 88, ay + 42); ctx.textAlign = 'left';
  ctx.fillStyle = '#eef2f9'; ctx.font = F(800, 26); ctx.fillText(nome, 136, ay + 26);
  // insígnia de destaque ao lado do nome
  if (S.config.insigniaFavorita && (S.stats.insigniasGanhas || {})[S.config.insigniaFavorita]
      && FAV_IMG.complete && FAV_IMG.naturalWidth) {
    const nw = ctx.measureText(nome).width;
    ctx.imageSmoothingEnabled = false;
    const fh = 40, fw = fh * FAV_IMG.naturalWidth / FAV_IMG.naturalHeight;
    ctx.drawImage(FAV_IMG, 136 + nw + 14, ay - 6, fw, fh);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.fillStyle = '#9fb0d0'; ctx.font = F(600, 21); ctx.fillText(`${user} · GFX pra Roblox`, 136, ay + 56);

  ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 18); ctx.textAlign = 'right';
  ctx.fillText(t('feitoCom'), CW - 152, ay + 22);
  ctx.fillText('Crava', CW - 152, ay + 46); ctx.textAlign = 'left';
  rrect(ctx, CW - 132, ay - 4, 76, 76, 14); ctx.fillStyle = '#eef2f9'; ctx.fill();
  ctx.fillStyle = '#0c1322';
  const QR = [[0, 0], [1, 0], [3, 0], [1, 1], [2, 1], [0, 2], [2, 2], [3, 2], [0, 3], [1, 3], [3, 3]];
  for (const [qx, qy] of QR) ctx.fillRect(CW - 132 + 12 + qx * 14, ay - 4 + 12 + qy * 14, 11, 11);

  // avatar com foto (async por cima)
  if (S.config.foto) {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath(); ctx.arc(88, ay + 32, 32, 0, 7); ctx.clip();
      ctx.drawImage(img, 56, ay, 64, 64);
      ctx.restore();
    };
    img.src = S.config.foto;
  }
}

function drawShareCard() {
  const cv = $('shareCanvas'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CW, CH);
  drawFundo(ctx);
  const midia = S.config.shareMidia;
  const fonte = (midia && midia.tipo === 'gif' && gifFrames && gifFrames.length)
    ? gifFrames[gifIdx]
    : (MEDIA_IMG.complete && MEDIA_IMG.naturalWidth ? MEDIA_IMG : null);
  const temMidia = !SKIP_MEDIA && midia && fonte;
  if (temMidia) drawMediaLayer(ctx, fonte, (S.config.shareMidiaOp ?? 40) / 100);
  drawConteudo(ctx);
  if (temMidia && midia.tipo === 'gif') {
    rrect(ctx, CW - 122, 118, 60, 30, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 17px Manrope, sans-serif';
    ctx.fillText('GIF', CW - 108, 139);
  }

  // controles da barra
  $('btnMidiaRemover').style.display = midia ? '' : 'none';
  $('opacidadeWrap').style.display = midia ? '' : 'none';
  if (document.activeElement !== $('midiaOpacidade')) $('midiaOpacidade').value = S.config.shareMidiaOp ?? 40;
  $('btnCopiarCard').textContent = midia && midia.tipo === 'gif' ? t('salvarGif') : t('copiarImagem');
}

$('mascoteToggle').classList.add('on');
$('mascoteToggle').onclick = () => {
  mascoteOn = !mascoteOn;
  $('mascoteToggle').classList.toggle('on', mascoteOn);
  drawShareCard();
};
// ---------- Mídia personalizada no card (foto/gif, estilo GMGN) ----------
const FAV_IMG = new Image();
FAV_IMG.onload = () => { if ($('view-share').classList.contains('open')) drawShareCard(); };
const MEDIA_IMG = new Image();
MEDIA_IMG.onload = () => { if ($('view-share').classList.contains('open')) drawShareCard(); };
let SKIP_MEDIA = false;

// ---------- Preview animado do GIF dentro do app ----------
let gifFrames = null, gifDelays = null, gifIdx = 0, gifTimer = null, gifPreparando = false;

function pararGifPreview() {
  if (gifTimer) { clearTimeout(gifTimer); gifTimer = null; }
}
function iniciarGifPreview() {
  pararGifPreview();
  if (!gifFrames || !gifFrames.length) return;
  const tick = () => {
    if ($('view-share').classList.contains('open')) {
      gifIdx = (gifIdx + 1) % gifFrames.length;
      drawShareCard();
    }
    gifTimer = setTimeout(tick, gifDelays[gifIdx]);
  };
  gifTimer = setTimeout(tick, gifDelays[0]);
}
// mídia pode estar em arquivo (novo, aguenta 15 MB) ou dataURL (legado)
function midiaSrc(midia) {
  if (midia.path) return 'file:///' + midia.path.replace(/\\/g, '/');
  return midia.dataURL || '';
}
async function midiaBuffer(midia) {
  if (midia.path) {
    const bytes = await window.api.readMidia(midia.path);
    if (!bytes) throw new Error('arquivo da mídia sumiu');
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return await (await fetch(midia.dataURL)).arrayBuffer();
}

async function prepararGifPreview() {
  const midia = S.config.shareMidia;
  pararGifPreview();
  gifFrames = null; gifIdx = 0;
  if (!midia || midia.tipo !== 'gif' || gifPreparando) return;
  gifPreparando = true;
  try {
    const buf = await midiaBuffer(midia);
    const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
    await dec.tracks.ready;
    await dec.completed.catch(() => { });
    const total = Math.min(dec.tracks.selectedTrack.frameCount || 1, 90);
    const fr = [], dl = [];
    for (let i = 0; i < total; i++) {
      const { image, duration } = await dec.decode({ frameIndex: i });
      fr.push(await createImageBitmap(image));
      dl.push(Math.max(20, (duration || 70000) / 1000));
      image.close();
    }
    gifFrames = fr; gifDelays = dl; gifIdx = 0;
    iniciarGifPreview();
    drawShareCard();
  } catch { }
  gifPreparando = false;
}

$('btnMidia').onclick = () => $('midiaInput').click();
$('midiaInput').onchange = () => {
  const f = $('midiaInput').files[0];
  if (!f) return;
  if (f.size > 100 * 1024 * 1024) { alert('Arquivo muito grande (máx. 100 MB).'); return; }
  const ehGif = f.type === 'image/gif';
  const instalar = async (p) => {
    if (!p) { alert('Não consegui salvar a mídia.'); return; }
    S.config.shareMidia = { tipo: ehGif ? 'gif' : 'foto', path: p };
    MEDIA_IMG.src = midiaSrc(S.config.shareMidia);
    await salvar();
    prepararGifPreview();
    drawShareCard();
  };
  const caminho = window.api.pathDoArquivo(f);
  if (caminho) {
    // caminho real: copia direto no disco, sem base64 (rápido pra arquivo grande)
    window.api.importMidia(caminho, ehGif).then(instalar);
  } else {
    const r = new FileReader();
    r.onload = async () => instalar(await window.api.saveMidia(r.result));
    r.readAsDataURL(f);
  }
  $('midiaInput').value = '';
};
$('btnMidiaRemover').onclick = async () => {
  delete S.config.shareMidia;
  window.api.clearMidia();
  pararGifPreview();
  gifFrames = null;
  await salvar();
  drawShareCard();
};
$('midiaOpacidade').oninput = () => {
  S.config.shareMidiaOp = +$('midiaOpacidade').value;
  drawShareCard();
};
$('midiaOpacidade').onchange = async () => { await salvar(); drawShareCard(); };




// ---------- Liquidação: moeda estrangeira virando R$ ----------
let liqJob = null;
function precisaLiquidar(j) {
  return j.pagamento === 'pago' && j.valor.m !== 'BRL' && !j.liquidado;
}
function estimativaBRL(j) {
  if (j.valor.m === 'USD') return Number(j.valor.q) * (typeof taxaUSD === 'function' ? taxaUSD() : S.config.cotacaoUSD);
  return (Number(j.valor.q) / 1000) * S.config.cotacaoRBX1k;
}
function abrirLiquidacao(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  liqJob = j;
  $('liqTitulo').textContent = j.valor.m === 'RBX' ? t('liqVendi') : t('liqCaiu');
  $('liqDetalhe').textContent = `${j.titulo} · ${fmtValor(j.valor)}`;
  $('liqValor').value = Math.round(estimativaBRL(j) * 100) / 100;
  $('ovLiq').classList.add('open');
  setTimeout(() => $('liqValor').select(), 60);
}
$('liqCancelar').onclick = () => { $('ovLiq').classList.remove('open'); liqJob = null; };
$('liqConfirmar').onclick = async () => {
  if (!liqJob) return;
  const v = parseFloat($('liqValor').value) || 0;
  liqJob.liquidado = true;
  liqJob.liquidadoEm = new Date().toISOString();
  liqJob.liquidadoBRL = v;
  $('ovLiq').classList.remove('open');
  // o cofre agora é sobre o dinheiro que realmente entrou
  cofreJob = { titulo: liqJob.titulo, valor: { q: v, m: 'BRL' } };
  const pct = S.config.cofrePct;
  $('cofreDetalhe').textContent = `${liqJob.titulo} · ${t('cofreEntrou')} ${MOEDA.BRL.fmt(v)}`;
  $('cofreValor').textContent = `${t('cofreSepara')} ${MOEDA.BRL.fmt(v * pct / 100)} (${pct}%)`;
  $('ovCofre').classList.add('open');
  liqJob = null;
  await salvar();
};

// totais da carteira
function recebidoLiquido() {
  return S.jobs.filter(j => j.pagamento === 'pago' && j.liquidado)
    .reduce((a, j) => a + Number(j.liquidadoBRL || 0), 0);
}
function pendenteLiquidar() {
  const out = { USD: 0, RBX: 0, equiv: 0 };
  for (const j of S.jobs) {
    if (!precisaLiquidar(j)) continue;
    out[j.valor.m] += Number(j.valor.q);
    out.equiv += estimativaBRL(j);
  }
  return out;
}

// ================= CARTEIRA · MOEDAS · CONVERSOR =================

// valor de um cofre em R$ equivalente (novos guardam q/m; antigos, só texto)
function cofreEquiv(c) {
  if (typeof c.q === 'number') {
    if (c.m === 'BRL') return c.q;
    if (c.m === 'USD') return c.q * S.config.cotacaoUSD;
    return (c.q / 1000) * S.config.cotacaoRBX1k;
  }
  const num = parseFloat(String(c.valor || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}
function totalGuardado() {
  return S.stats.cofres.filter(c => c.confirmado).reduce((a, c) => a + cofreEquiv(c), 0);
}

// ---------- Carteira ----------
let carteiraFrente = 0;
function renderCarteira() {
  const recebido = recebidoLiquido();
  const guardado = totalGuardado();
  const livre = Math.max(0, recebido - guardado);
  const pend = pendenteLiquidar();
  const pct = recebido > 0 ? Math.round(guardado / recebido * 100) : 0;
  const pendentesCofre = S.stats.cofres.filter(c => !c.confirmado).length;
  const aLiquidar = S.jobs.filter(precisaLiquidar).length;

  const partes = [];
  if (pend.USD > 0) partes.push(MOEDA.USD.fmt(pend.USD));
  if (pend.RBX > 0) partes.push(MOEDA.RBX.fmt(pend.RBX));

  const cartoes = [
    { rot: t('cartGuardado'), val: MOEDA.BRL.fmt(Math.round(guardado)), sub: `${pct}% ${t('cartDoQueEntrou')}`, cls: 'verde' },
    { rot: t('cartLivre'), val: MOEDA.BRL.fmt(Math.round(livre)), sub: `${t('cartDe')} ${MOEDA.BRL.fmt(Math.round(recebido))} ${t('cartNaConta')}`, cls: 'azul' },
    { rot: t('cartALiquidar'), val: partes.length ? partes.join(' · ') : MOEDA.BRL.fmt(0), sub: partes.length ? `≈ ${MOEDA.BRL.fmt(Math.round(pend.equiv))} · ${aLiquidar} ${t('cartTrabalhos')}` : t('cartTudoLiquidado'), cls: 'ambar' }
  ];
  $('carteiraPalco').innerHTML = cartoes.map((c, i) => {
    const pos = (i - carteiraFrente + 3) % 3;
    return `<div class="cartao ${c.cls} pos${pos}">
      <div class="cartao-topo">
        <div class="cartao-chip"></div>
        <img class="cartao-mascote" src="${spr('logo')}" alt="">
      </div>
      <div class="cartao-rot">${c.rot}</div>
      <div class="cartao-val">${c.val}</div>
      <div class="cartao-sub">${c.sub}</div>
    </div>`;
  }).join('');
  $('carteiraPontos').innerHTML = cartoes.map((_, i) =>
    `<span class="cart-ponto ${i === carteiraFrente ? 'on' : ''}"></span>`).join('');

  $('carteiraLinhas').innerHTML = `
    <div class="cart-linha"><span>${t('cartRecebidoConta')}</span><b>${MOEDA.BRL.fmt(Math.round(recebido))}</b></div>
    <div class="cart-linha"><span>${t('cartGuardadoLinha')}</span><b class="c-green">${MOEDA.BRL.fmt(Math.round(guardado))}</b></div>
    <div class="cart-linha"><span>${t('cartMetaCofre')}</span><b>${S.config.cofrePct}%</b></div>
    ${aLiquidar ? `<div class="cart-linha alerta"><span>${t('cartEsperandoConversao')}</span><b class="c-amber">${aLiquidar}</b></div>` : ''}
    ${pendentesCofre ? `<div class="cart-linha alerta"><span>${t('cartCofresPendentes')}</span><b class="c-amber">${pendentesCofre}</b></div>` : ''}`;
}
$('btnTrocarCarteira').onclick = () => { carteiraFrente = (carteiraFrente + 1) % 3; renderCarteira(); };
$('carteiraPalco').onclick = () => { carteiraFrente = (carteiraFrente + 1) % 3; renderCarteira(); };

// ---------- Moedas do mês (donut) ----------
let moedasMes = hoje().slice(0, 7);
const MOEDA_COR = { BRL: '#2fd39c', USD: '#339dff', RBX: '#f5b74e' };
const moedaNome = () => ({ BRL: t('real'), USD: t('dolar'), RBX: t('robux') });

function renderMoedas() {
  const [a, m] = moedasMes.split('-').map(Number);
  $('moedasMes').textContent = new Date(a, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

  const bruto = { BRL: 0, USD: 0, RBX: 0 };
  const equiv = { BRL: 0, USD: 0, RBX: 0 };
  for (const j of S.jobs) {
    if (j.pagamento !== 'pago') continue;
    const quando = dataRealizado(j).slice(0, 7);
    if (quando !== moedasMes) continue;
    bruto[j.valor.m] += Number(j.valor.q);
    equiv[j.valor.m] += j.liquidado ? realizadoBRL(j)
      : j.valor.m === 'BRL' ? Number(j.valor.q)
      : j.valor.m === 'USD' ? Number(j.valor.q) * S.config.cotacaoUSD
      : (Number(j.valor.q) / 1000) * S.config.cotacaoRBX1k;
  }
  const total = equiv.BRL + equiv.USD + equiv.RBX;

  const cv = $('donutCanvas'), ctx = cv.getContext('2d');
  const W = cv.width, R = W / 2, raio = R - 14, esp = 34;
  ctx.clearRect(0, 0, W, W);
  ctx.lineWidth = esp;
  ctx.lineCap = 'butt';
  if (total <= 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.arc(R, R, raio - esp / 2, 0, Math.PI * 2); ctx.stroke();
  } else {
    let ang = -Math.PI / 2;
    for (const k of ['BRL', 'USD', 'RBX']) {
      if (equiv[k] <= 0) continue;
      const fatia = (equiv[k] / total) * Math.PI * 2;
      ctx.strokeStyle = MOEDA_COR[k];
      ctx.beginPath();
      ctx.arc(R, R, raio - esp / 2, ang + 0.03, ang + fatia - 0.03);
      ctx.stroke();
      ang += fatia;
    }
  }

  const maior = ['BRL', 'USD', 'RBX'].sort((x, y) => equiv[y] - equiv[x])[0];
  const pctMaior = total > 0 ? Math.round(equiv[maior] / total * 100) : 0;
  $('donutCentro').innerHTML = total > 0
    ? `<div class="donut-pct">${pctMaior}%</div><div class="donut-sub">${t('em')} ${moedaNome()[maior]}</div>`
    : `<div class="donut-pct" style="font-size:20px">—</div><div class="donut-sub">${t('semEntradas')}</div>`;

  $('donutLegenda').innerHTML = ['BRL', 'USD', 'RBX'].map(k => {
    const pct = total > 0 ? Math.round(equiv[k] / total * 100) : 0;
    const cru = k === 'BRL' ? MOEDA.BRL.fmt(bruto.BRL) : k === 'USD' ? MOEDA.USD.fmt(bruto.USD) : MOEDA.RBX.fmt(bruto.RBX);
    return `<div class="leg-item">
      <span class="leg-dot" style="background:${MOEDA_COR[k]}"></span>
      <span class="leg-nome">${moedaNome()[k]}</span>
      <span class="leg-val">${bruto[k] > 0 ? cru : '—'}</span>
      <b class="leg-pct">${pct}%</b>
    </div>`;
  }).join('');
}
document.querySelector('.trio-card .trio-head [data-moe="prev"]').parentElement.addEventListener('click', (e) => {
  const acao = e.target.dataset.moe;
  if (!acao) return;
  let [a, m] = moedasMes.split('-').map(Number);
  m += acao === 'next' ? 1 : -1;
  if (m === 0) { m = 12; a--; }
  if (m === 13) { m = 1; a++; }
  moedasMes = `${a}-${String(m).padStart(2, '0')}`;
  renderMoedas();
});

// ---------- Conversor ----------
let cotacaoUSDonline = null, cotacaoQuando = '';
async function buscarCotacao() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    if (j && j.rates && j.rates.BRL) {
      cotacaoUSDonline = j.rates.BRL;
      cotacaoQuando = new Date().toLocaleDateString('pt-BR');
      $('cotacaoInfo').textContent = `US$ 1 = R$ ${cotacaoUSDonline.toFixed(2)}`;
      $('convRodape').textContent = `${t('cotacaoOnline')} ${cotacaoQuando} · ${t('robuxPelaConfig')} (1k = R$ ${S.config.cotacaoRBX1k})`;
      calcularConversao();
      return;
    }
    throw new Error('resposta inválida');
  } catch {
    $('cotacaoInfo').textContent = `US$ 1 = R$ ${Number(S.config.cotacaoUSD).toFixed(2)}`;
    $('convRodape').textContent = t('semInternet');
  }
}
function taxaUSD() { return cotacaoUSDonline || S.config.cotacaoUSD; }
function paraBRL(q, m) {
  if (m === 'BRL') return q;
  if (m === 'USD') return q * taxaUSD();
  return (q / 1000) * S.config.cotacaoRBX1k;
}
function deBRL(v, m) {
  if (m === 'BRL') return v;
  if (m === 'USD') return v / taxaUSD();
  return (v / S.config.cotacaoRBX1k) * 1000;
}
function calcularConversao() {
  const q = parseFloat($('convValor').value) || 0;
  const de = $('convDe').value, para = $('convPara').value;
  const res = deBRL(paraBRL(q, de), para);
  $('convResultado').textContent = para === 'BRL' ? MOEDA.BRL.fmt(Math.round(res * 100) / 100)
    : para === 'USD' ? MOEDA.USD.fmt(Math.round(res * 100) / 100)
    : MOEDA.RBX.fmt(Math.round(res));
}
$('convValor').oninput = calcularConversao;
$('convDe').onchange = calcularConversao;
$('convPara').onchange = calcularConversao;
$('btnConvTrocar').onclick = () => {
  const a = $('convDe').value;
  $('convDe').value = $('convPara').value;
  $('convPara').value = a;
  $('btnConvTrocar').classList.add('girando');
  setTimeout(() => $('btnConvTrocar').classList.remove('girando'), 400);
  calcularConversao();
};

// ---------- Visualizer de lucro mensal (stream graph) ----------
let vizMeses = 8;

function ganhoEquivPeriodo(de, ate) {
  return S.jobs.filter(j => j.liquidado && dataRealizado(j).slice(0, 10) >= de && dataRealizado(j).slice(0, 10) <= ate)
    .reduce((a, j) => a + realizadoBRL(j), 0);
}
function diaMenos(n) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}
function serieMensal(n) {
  const hojeD = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(hojeD.getFullYear(), hojeD.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      key,
      nome: dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      valor: ganhoEquivDoMes(key)
    });
  }
  return out;
}

// curva suave por pontos médios
function curva(ctx, pts, mover = true) {
  if (mover) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

function desenharViz() {
  const cv = $('vizCanvas'); if (!cv) return;
  const larguraCss = cv.parentElement.clientWidth;
  if (!larguraCss) return; // aba escondida: desenha quando abrir
  if (cv.width !== larguraCss * 2) cv.width = larguraCss * 2;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const F = (w, sz, fam) => `${w} ${sz}px ${fam || 'Manrope'}, sans-serif`;

  rrect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = '#0b0e13'; ctx.fill();
  ctx.save();
  rrect(ctx, 0, 0, W, H, 36); ctx.clip();

  const serie = serieMensal(vizMeses);
  const max = Math.max(...serie.map(m => m.valor), 1);

  // ---- topo: título + estatísticas ----
  const pad = 44;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8edf4'; ctx.font = F(700, 26, "'Baloo 2'");
  ctx.fillText(t('lucro'), pad, 58);

  const semana = ganhoEquivPeriodo(diaMenos(6), hoje());
  const semanaAnt = ganhoEquivPeriodo(diaMenos(13), diaMenos(7));
  const mesAtual = ganhoEquivDoMes(hoje().slice(0, 7));
  const mesAnt = serie.length > 1 ? serie[serie.length - 2].valor : 0;
  const anoKey = hoje().slice(0, 4);
  const ano = S.jobs.filter(j => j.liquidado && dataRealizado(j).slice(0, 4) === anoKey)
    .reduce((a, j) => a + realizadoBRL(j), 0);

  const variacao = (atual, ant) => {
    if (!ant) return atual > 0 ? '+100%' : '—';
    const v = Math.round((atual - ant) / ant * 100);
    return (v >= 0 ? '+' : '') + v + '%';
  };
  const cols = [
    [t('semana'), semana, variacao(semana, semanaAnt), t('vsSemana')],
    [t('mes'), mesAtual, variacao(mesAtual, mesAnt), t('vsMes')],
    [t('ano'), ano, '', String(anoKey)]
  ];
  let cx = pad;
  const larg = (W - pad * 2) / 3;
  for (const [rot, val, dif, sub] of cols) {
    ctx.fillStyle = '#8b98a9'; ctx.font = F(700, 19);
    ctx.fillText(rot, cx, 108);
    ctx.fillStyle = '#e8edf4'; ctx.font = F(800, 40, "'Baloo 2'");
    const txt = 'R$ ' + fmtCompacto(val);
    ctx.fillText(txt, cx, 154);
    if (dif) {
      const w = ctx.measureText(txt).width;
      ctx.fillStyle = dif.startsWith('-') ? '#f0564e' : '#2fd39c';
      ctx.font = F(800, 18);
      ctx.fillText(dif, cx + w + 12, 150);
    }
    ctx.fillStyle = '#5a6676'; ctx.font = F(600, 16);
    ctx.fillText(sub, cx, 180);
    cx += larg;
  }

  // ---- stream graph ----
  const topo = 232, base = H - 78;
  const meio = (topo + base) / 2;
  const maxMeia = (base - topo) / 2;
  const passo = (W - pad * 2) / Math.max(1, serie.length - 1);
  const xs = serie.map((_, i) => pad + i * passo);
  const norm = serie.map(m => 0.10 + 0.90 * (m.valor / max));

  const camadas = [
    { esc: 1.00, cor: '#1b2a6b', alpha: 0.95 },
    { esc: 0.78, cor: '#3b3bd8', alpha: 0.95 },
    { esc: 0.56, cor: '#2f7ff0', alpha: 0.95 },
    { esc: 0.34, cor: '#25c8e8', alpha: 0.95 },
    { esc: 0.16, cor: '#2fd39c', alpha: 1 }
  ];
  for (const c of camadas) {
    const cima = xs.map((x, i) => [x, meio - maxMeia * norm[i] * c.esc]);
    const baixo = xs.map((x, i) => [x, meio + maxMeia * norm[i] * c.esc]).reverse();
    ctx.beginPath();
    curva(ctx, cima);
    curva(ctx, baixo, false);
    ctx.closePath();
    const g = ctx.createLinearGradient(pad, 0, W - pad, 0);
    g.addColorStop(0, c.cor + '00');
    g.addColorStop(0.12, c.cor);
    g.addColorStop(1, c.cor);
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = g;
    if (c.esc <= 0.16) { ctx.shadowColor = 'rgba(47,211,156,0.75)'; ctx.shadowBlur = 40; }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ---- marcadores nos meses com lucro ----
  const destaques = serie
    .map((m, i) => ({ ...m, i }))
    .filter(m => m.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i);
  ctx.textAlign = 'center';
  for (const d of destaques) {
    const x = xs[d.i];
    const topoY = meio - maxMeia * norm[d.i];
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, topoY); ctx.lineTo(x, meio + maxMeia * norm[d.i]); ctx.stroke();
    const rot = 'R$ ' + fmtCompacto(d.valor);
    ctx.font = F(800, 19);
    const w = ctx.measureText(rot).width + 28;
    rrect(ctx, x - w / 2, topoY - 40, w, 32, 16);
    ctx.fillStyle = '#0b0e13'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#eef2f9';
    ctx.fillText(rot, x, topoY - 18);
  }

  // ---- meses na base ----
  ctx.fillStyle = '#5a6676'; ctx.font = F(700, 17);
  for (let i = 0; i < serie.length; i++) ctx.fillText(serie[i].nome, xs[i], H - 34);
  ctx.textAlign = 'left';
  ctx.restore();
}

$('vizMenos').onclick = () => { vizMeses = Math.max(4, vizMeses - 2); desenharViz(); };
$('vizMais').onclick = () => { vizMeses = Math.min(14, vizMeses + 2); desenharViz(); };
$('btnCopiarViz').onclick = () => window.api.copyImage($('vizCanvas').toDataURL('image/png'));
window.addEventListener('resize', () => { try { desenharViz(); } catch { } });

// ---------- Calendário de lucro (estilo PnL da GMGN) ----------
let calMes = hoje().slice(0, 7);
let calModo = 'valores'; // 'calor' (mapa de calor) | 'valores'

function ganhoEquivDoDia(dia) {
  return S.jobs.filter(j => j.liquidado && dataRealizado(j).slice(0, 10) === dia)
    .reduce((a, j) => a + realizadoBRL(j), 0);
}
function fmtCompacto(v) {
  if (v >= 1000000) return (v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
  if (v >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  return Math.round(v).toString();
}

function renderCalendario() {
  const [ano, mes] = calMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offset = new Date(ano, mes - 1, 1).getDay(); // 0 = domingo
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

  // ganho por dia, máximo, dias com lucro e melhor sequência
  const ganhos = [];
  let totalMes = 0, maxDia = 0, melhorIdx = -1, diasComLucro = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const g = ganhoEquivDoDia(`${calMes}-${String(d).padStart(2, '0')}`);
    ganhos.push(g);
    totalMes += g;
    if (g > 0) diasComLucro++;
    if (g > maxDia) { maxDia = g; melhorIdx = d; }
  }
  let seq = 0, melhorSeq = 0;
  for (const g of ganhos) { seq = g > 0 ? seq + 1 : 0; if (seq > melhorSeq) melhorSeq = seq; }

  const totalAno = S.jobs
    .filter(j => j.liquidado && dataRealizado(j).slice(0, 4) === String(ano))
    .reduce((a, j) => a + realizadoBRL(j), 0);

  const hj = hoje();
  const dows = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let grid = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');

  let celulas = [];
  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length < 42) celulas.push(null); // sempre 6 semanas: altura fixa

  for (const d of celulas) {
    if (d === null) { grid += `<div class="cal-cell vazia"></div>`; continue; }
    const g = ganhos[d - 1];
    const ehHoje = `${calMes}-${String(d).padStart(2, '0')}` === hj;
    const ehMelhor = d === melhorIdx && g > 0;
    const int = maxDia > 0 ? g / maxDia : 0;
    const celOp = (S.config.calCelOp ?? 100) / 100;
    const bg = ehMelhor
      ? `background:rgba(245,183,78,${(0.22 * celOp).toFixed(2)})`
      : (g > 0 ? `background:rgba(47,211,156,${((0.07 + 0.30 * int) * celOp).toFixed(2)})` : '');
    grid += `<div class="cal-cell ${ehHoje ? 'hoje' : ''} ${ehMelhor ? 'melhor' : ''}" style="${bg}" title="${d}/${mes}: R$ ${fmtNum(Math.round(g))}">
      <div class="cal-dia">${d}</div>
      <div class="cal-val ${ehMelhor ? 'c-amber' : (g > 0 ? 'c-green' : 'sem-lucro')}">${g > 0 ? '+R$ ' + fmtCompacto(g) : ''}</div>
    </div>`;
  }

  $('calPanel').innerHTML = `
    <div class="cal-head">
      <div class="cal-titulo-app">${t('calendarioLucro')}</div>
      <div style="flex-grow:1"></div>
      <div class="mini-btn" data-cal="prev">‹</div>
      <div class="cal-titulo">${nomeMes.replace('.', '')}</div>
      <div class="mini-btn" data-cal="next">›</div>
      
      </div>
    </div>
    <div class="cal-total-grande">R$ ${fmtNum(Math.round(totalMes))}</div>
    <div class="cal-linha"></div>
    <div class="cal-sub">
      <span class="c-green"><b>${diasComLucro}</b> / R$ ${fmtNum(Math.round(totalMes))}</span>
      <span class="cal-sub-dir">${t('noAno')} <b class="c-green">R$ ${fmtNum(Math.round(totalAno))}</b></span>
    </div>
    <div class="cal-grid">${grid}</div>
    <div class="cal-rodape"><span>${t('melhorSeq')} <b>${melhorSeq}d</b>${maxDia > 0 ? ` · ${t('melhorDia')} <b class="c-amber">+R$ ${fmtCompacto(maxDia)}</b>` : ''}</span><span class="cal-marca"><img src="${spr('logo')}" alt=""><b>CRAVA</b></span></div>`;
  try { pintarFundoCal(); } catch { }
}
$('calPanel').onclick = (e) => {
  const acao = e.target.dataset.cal;
  if (!acao) return;
  if (acao === 'prev' || acao === 'next') {
    let [a, m] = calMes.split('-').map(Number);
    m += acao === 'next' ? 1 : -1;
    if (m === 0) { m = 12; a--; }
    if (m === 13) { m = 1; a++; }
    calMes = `${a}-${String(m).padStart(2, '0')}`;
    renderCalendario();
  } else {
    // troca de modo sem re-render: só a classe muda e o CSS anima
    calModo = acao;
    $('calPanel').querySelector('.cal-grid').classList.toggle('modo-calor', calModo === 'calor');
    $('calPanel').querySelectorAll('.tema-opt').forEach(el =>
      el.classList.toggle('sel', el.dataset.cal === calModo));
  }
};

// ---------- Fundo e compartilhamento do calendário ----------
const CAL_MEDIA_IMG = new Image();
CAL_MEDIA_IMG.onload = () => renderCalendario();
let calGifFrames = null, calGifDelays = null, calGifIdx = 0, calGifTimer = null, calGifPreparando = false;

function pararCalGif() { if (calGifTimer) { clearTimeout(calGifTimer); calGifTimer = null; } }
function iniciarCalGif() {
  pararCalGif();
  if (!calGifFrames || !calGifFrames.length) return;
  const tick = () => {
    if ($('ovCal').classList.contains('open')) {
      calGifIdx = (calGifIdx + 1) % calGifFrames.length;
      pintarFundoCal();
    }
    calGifTimer = setTimeout(tick, calGifDelays[calGifIdx]);
  };
  calGifTimer = setTimeout(tick, calGifDelays[0]);
}
async function prepararCalGif() {
  const midia = S.config.calMidia;
  pararCalGif();
  calGifFrames = null; calGifIdx = 0;
  if (!midia || midia.tipo !== 'gif' || calGifPreparando) return;
  calGifPreparando = true;
  try {
    const buf = await midiaBuffer(midia);
    const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
    await dec.tracks.ready;
    await dec.completed.catch(() => { });
    const total = Math.min(dec.tracks.selectedTrack.frameCount || 1, 90);
    const fr = [], dl = [];
    for (let i = 0; i < total; i++) {
      const { image, duration } = await dec.decode({ frameIndex: i });
      fr.push(await createImageBitmap(image));
      dl.push(Math.max(20, (duration || 70000) / 1000));
      image.close();
    }
    calGifFrames = fr; calGifDelays = dl; calGifIdx = 0;
    iniciarCalGif();
  } catch { }
  calGifPreparando = false;
  pintarFundoCal();
}

// pinta o fundo do painel (imagem estática via CSS; GIF quadro a quadro em canvas)
function pintarFundoCal() {
  const painel = $('calPanel');
  const midia = S.config.calMidia;
  const op = (S.config.calMidiaOp ?? 35) / 100;
  let cv = painel.querySelector('.cal-bg');
  if (!midia) {
    if (cv) cv.remove();
    painel.style.backgroundImage = '';
    painel.classList.remove('com-fundo');
    return;
  }
  painel.classList.add('com-fundo');
  if (!painel.getBoundingClientRect().width) return; // modal fechado
  if (midia.tipo === 'gif' && calGifFrames && calGifFrames.length) {
    painel.style.backgroundImage = '';
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'cal-bg';
      painel.prepend(cv);
    }
    const r = painel.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width));
    cv.height = Math.max(1, Math.round(r.height));
    const ctx = cv.getContext('2d');
    const img = calGifFrames[calGifIdx];
    const esc = Math.max(cv.width / img.width, cv.height / img.height);
    const dw = img.width * esc, dh = img.height * esc;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = op;
    ctx.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  } else {
    if (cv) cv.remove();
    painel.style.backgroundImage =
      `linear-gradient(rgba(8,12,24,${(1 - op).toFixed(2)}),rgba(8,12,24,${(1 - op).toFixed(2)})),url("${midiaSrc(midia)}")`;
  }
  painel.style.setProperty('--celop', String((S.config.calCelOp ?? 100) / 100));
  $('btnCalFundoRemover').style.display = '';
  $('calOpacidadeWrap').style.display = '';
  $('calCelWrap').style.display = '';
  if (document.activeElement !== $('calOpacidade')) $('calOpacidade').value = S.config.calMidiaOp ?? 35;
  if (document.activeElement !== $('calCelOp')) $('calCelOp').value = S.config.calCelOp ?? 100;
}

$('btnCalFundo').onclick = () => $('calMidiaInput').click();
$('calMidiaInput').onchange = () => {
  const f = $('calMidiaInput').files[0];
  if (!f) return;
  if (f.size > 100 * 1024 * 1024) { alert('Arquivo muito grande (máx. 100 MB).'); return; }
  const ehGif = f.type === 'image/gif';
  const instalar = async (p) => {
    if (!p) { alert('Não consegui salvar a mídia.'); return; }
    S.config.calMidia = { tipo: ehGif ? 'gif' : 'foto', path: p };
    CAL_MEDIA_IMG.src = midiaSrc(S.config.calMidia);
    await salvar();
    prepararCalGif();
    pintarFundoCal();
  };
  const caminho = window.api.pathDoArquivo(f);
  if (caminho) window.api.importMidia(caminho, ehGif, 'cal').then(instalar);
  else { const r = new FileReader(); r.onload = async () => instalar(await window.api.saveMidia(r.result, 'cal')); r.readAsDataURL(f); }
  $('calMidiaInput').value = '';
};
$('btnCalFundoRemover').onclick = async () => {
  delete S.config.calMidia;
  window.api.clearMidia('cal');
  pararCalGif(); calGifFrames = null;
  $('btnCalFundoRemover').style.display = 'none';
  $('calOpacidadeWrap').style.display = 'none';
  $('calCelWrap').style.display = 'none';
  await salvar();
  pintarFundoCal();
};
$('calOpacidade').oninput = () => { S.config.calMidiaOp = +$('calOpacidade').value; pintarFundoCal(); };
$('calOpacidade').onchange = async () => { await salvar(); };
$('calCelOp').oninput = () => { S.config.calCelOp = +$('calCelOp').value; renderCalendario(); };
$('calCelOp').onchange = async () => { await salvar(); };

// compartilhar: imagem do calendário (PNG no clipboard; GIF animado salvo em arquivo)
// dados do mês corrente do calendário (mesma conta do render)
function dadosCal() {
  const [ano, mes] = calMes.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offset = new Date(ano, mes - 1, 1).getDay();
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
  const ganhos = [];
  let totalMes = 0, maxDia = 0, melhorIdx = -1, diasComLucro = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const g = ganhoEquivDoDia(`${calMes}-${String(d).padStart(2, '0')}`);
    ganhos.push(g);
    totalMes += g;
    if (g > 0) diasComLucro++;
    if (g > maxDia) { maxDia = g; melhorIdx = d; }
  }
  let seq = 0, melhorSeq = 0;
  for (const g of ganhos) { seq = g > 0 ? seq + 1 : 0; if (seq > melhorSeq) melhorSeq = seq; }
  const totalAno = S.jobs
    .filter(j => j.liquidado && dataRealizado(j).slice(0, 4) === String(ano))
    .reduce((a, j) => a + realizadoBRL(j), 0);
  const celulas = [];
  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length < 42) celulas.push(null); // sempre 6 semanas: altura fixa
  return { ano, mes, nomeMes, ganhos, totalMes, totalAno, maxDia, melhorIdx, diasComLucro, melhorSeq, celulas };
}

// desenha o calendário inteiro num canvas (fontes reais, sem captura de DOM)
function desenharCalCanvas(ctx, W, H, dc, fonteMidia, op) {
  const F = (w, s, fam) => `${w} ${s}px ${fam || 'Manrope'}, sans-serif`;
  rrect(ctx, 0, 0, W, H, 26);
  ctx.fillStyle = '#12161d'; ctx.fill();
  if (fonteMidia) {
    ctx.save();
    rrect(ctx, 0, 0, W, H, 26); ctx.clip();
    const fw = fonteMidia.naturalWidth || fonteMidia.width, fh = fonteMidia.naturalHeight || fonteMidia.height;
    const esc = Math.max(W / fw, H / fh);
    ctx.globalAlpha = op;
    ctx.drawImage(fonteMidia, (W - fw * esc) / 2, (H - fh * esc) / 2, fw * esc, fh * esc);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,12,24,0.40)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const gap = 12, cw = 150, ch = 92;
  const gridX = Math.round((W - (cw * 7 + gap * 6)) / 2);
  const pad = gridX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8edf4'; ctx.font = F(700, 24, "'Baloo 2'");
  ctx.fillText('Calendário de Lucro', pad, 62);
  ctx.fillStyle = '#8b98a9'; ctx.font = F(700, 20); ctx.textAlign = 'right';
  ctx.fillText(dc.nomeMes, W - pad, 60); ctx.textAlign = 'left';

  ctx.fillStyle = '#2fd39c'; ctx.font = F(700, 44, "'Baloo 2'");
  ctx.fillText('R$ ' + fmtNum(Math.round(dc.totalMes)), pad, 126);
  ctx.fillStyle = 'rgba(47,211,156,0.9)';
  ctx.fillRect(pad, 144, W - pad * 2, 4);

  ctx.font = F(700, 17);
  ctx.fillStyle = '#2fd39c';
  ctx.fillText(`${dc.diasComLucro} / R$ ${fmtNum(Math.round(dc.totalMes))}`, pad, 180);
  ctx.fillStyle = '#8b98a9'; ctx.textAlign = 'right';
  ctx.fillText(`no ano: R$ ${fmtNum(Math.round(dc.totalAno))}`, W - pad, 180); ctx.textAlign = 'left';

  const dows = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  ctx.font = F(800, 13); ctx.fillStyle = '#5a6676'; ctx.textAlign = 'center';
  for (let c = 0; c < 7; c++) ctx.fillText(dows[c], gridX + c * (cw + gap) + cw / 2, 214);
  ctx.textAlign = 'left';

  const topo = 228;
  const hj = hoje();
  for (let i = 0; i < dc.celulas.length; i++) {
    const d = dc.celulas[i];
    if (d === null) continue;
    const lin = Math.floor(i / 7), col = i % 7;
    const x = gridX + col * (cw + gap), y = topo + lin * (ch + gap);
    const g = dc.ganhos[d - 1];
    const int = dc.maxDia > 0 ? g / dc.maxDia : 0;
    const ehMelhor = d === dc.melhorIdx && g > 0;
    rrect(ctx, x, y, cw, ch, 12);
    const celOp = (S.config.calCelOp ?? 100) / 100;
    ctx.fillStyle = fonteMidia ? `rgba(255,255,255,${(0.07 * celOp).toFixed(3)})` : '#171c24';
    ctx.fill();
    if (g > 0) {
      rrect(ctx, x, y, cw, ch, 12);
      ctx.fillStyle = ehMelhor ? `rgba(245,183,78,${(0.24 * celOp).toFixed(2)})` : `rgba(47,211,156,${((0.07 + 0.30 * int) * celOp).toFixed(2)})`;
      ctx.fill();
    }
    if (ehMelhor) { rrect(ctx, x, y, cw, ch, 12); ctx.strokeStyle = 'rgba(245,183,78,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (`${calMes}-${String(d).padStart(2, '0')}` === hj) {
      rrect(ctx, x, y, cw, ch, 12); ctx.strokeStyle = 'rgba(51,157,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,237,244,0.75)'; ctx.font = F(700, 13);
    ctx.fillText(String(d), x + 10, y + 22);
    if (g > 0) {
      ctx.fillStyle = ehMelhor ? '#f5b74e' : '#2fd39c';
      ctx.font = F(800, 17); ctx.textAlign = 'center';
      ctx.fillText('+R$ ' + fmtCompacto(g), x + cw / 2, y + ch / 2 + 12);
      ctx.textAlign = 'left';
    }
  }

  const rodapeY = topo + (dc.celulas.length / 7) * (ch + gap) + 26;
  ctx.fillStyle = '#8b98a9'; ctx.font = F(600, 15);
  ctx.fillText(`Melhor sequência no mês: ${dc.melhorSeq}d${dc.maxDia > 0 ? '  ·  melhor dia: +R$ ' + fmtCompacto(dc.maxDia) : ''}`, pad, rodapeY);
  ctx.font = "16px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillStyle = '#e8edf4';
  ctx.fillText('CRAVA', W - pad, rodapeY);
  const wMarca = ctx.measureText('CRAVA').width;
  if (HEAD_IMG.complete && HEAD_IMG.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    const lh = 32, lw = lh * HEAD_IMG.naturalWidth / HEAD_IMG.naturalHeight;
    ctx.drawImage(HEAD_IMG, W - pad - wMarca - lw - 12, rodapeY - 24, lw, lh);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.textAlign = 'left';
}

async function compartilharCalendario() {
  const btn = $('btnCompartilharCal');
  const midia = S.config.calMidia;
  const op = (S.config.calMidiaOp ?? 35) / 100;
  const txtOriginal = btn.textContent;
  btn.textContent = t('gerando');
  try {
    const dc = dadosCal();
    const linhas = dc.celulas.length / 7;
    const H = 228 + linhas * 104 + 56;
    const W = Math.round(H * 16 / 9); // 16:9
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    if (midia && midia.tipo === 'gif' && calGifFrames && calGifFrames.length) {
      const { GIFEncoder, quantize, applyPalette } = await import('./lib/gifenc.esm.js');
      const outW = Math.round(W * 0.6), outH = Math.round(H * 0.6);
      const mini = document.createElement('canvas');
      mini.width = outW; mini.height = outH;
      const mctx = mini.getContext('2d');
      const enc = GIFEncoder();
      const passo = Math.ceil(calGifFrames.length / 60);
      for (let i = 0; i < calGifFrames.length; i += passo) {
        desenharCalCanvas(ctx, W, H, dc, calGifFrames[i], op);
        mctx.drawImage(cv, 0, 0, outW, outH);
        const dados = mctx.getImageData(0, 0, outW, outH).data;
        const paleta = quantize(dados, 256);
        enc.writeFrame(applyPalette(dados, paleta), outW, outH, { palette: paleta, delay: Math.max(20, calGifDelays[i] * passo) });
      }
      enc.finish();
      await window.api.saveGif(enc.bytes());
    } else {
      const fonte = midia && CAL_MEDIA_IMG.complete && CAL_MEDIA_IMG.naturalWidth ? CAL_MEDIA_IMG : null;
      desenharCalCanvas(ctx, W, H, dc, fonte, op);
      window.api.copyImage(cv.toDataURL('image/png'));
    }
  } catch (err) {
    alert('Não consegui gerar a imagem: ' + err.message);
  }
  btn.textContent = txtOriginal;
}
$('btnCompartilharCal').onclick = compartilharCalendario;
$('btnAbrirCal').onclick = () => {
  $('ovCal').classList.add('open');
  renderCalendario();          // redesenha já com o painel visível
  iniciarCalGif();
};
$('btnFecharCal').onclick = () => { $('ovCal').classList.remove('open'); pararCalGif(); };
$('ovCal').onclick = (e) => {
  if (e.target === $('ovCal')) { $('ovCal').classList.remove('open'); pararCalGif(); }
};

// GIF animado: decodifica com ImageDecoder (nativo) e re-encoda com gifenc
async function gerarGifAnimado() {
  const midia = S.config.shareMidia;
  if (!midia || midia.tipo !== 'gif') return;
  const btn = $('btnCopiarCard');
  btn.textContent = 'Gerando GIF…';
  try {
    const { GIFEncoder, quantize, applyPalette } = await import('./lib/gifenc.esm.js');
    const buf = await midiaBuffer(midia);
    const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
    await dec.tracks.ready;
    await dec.completed.catch(() => { });
    const total = dec.tracks.selectedTrack.frameCount || 1;
    const passo = Math.ceil(total / 120); // até 120 quadros no resultado (liso)

    // camadas: fundo (gradiente) e conteúdo (textos etc, transparente)
    const fundoCv = document.createElement('canvas');
    fundoCv.width = CW; fundoCv.height = CH;
    drawFundo(fundoCv.getContext('2d'));
    const contCv = document.createElement('canvas');
    contCv.width = CW; contCv.height = CH;
    drawConteudo(contCv.getContext('2d'));

    const outW = 560, outH = 340;
    const quadro = document.createElement('canvas');
    quadro.width = CW; quadro.height = CH;
    const qctx = quadro.getContext('2d');
    const mini = document.createElement('canvas');
    mini.width = outW; mini.height = outH;
    const mctx = mini.getContext('2d');
    const op = (S.config.shareMidiaOp ?? 40) / 100;

    const enc = GIFEncoder();
    for (let i = 0; i < total; i += passo) {
      const { image, duration } = await dec.decode({ frameIndex: i });
      qctx.clearRect(0, 0, CW, CH);
      qctx.drawImage(fundoCv, 0, 0);
      drawMediaLayer(qctx, image, op);
      qctx.drawImage(contCv, 0, 0);
      image.close();
      mctx.drawImage(quadro, 0, 0, outW, outH);
      const dados = mctx.getImageData(0, 0, outW, outH).data;
      const paleta = quantize(dados, 256);
      const idx = applyPalette(dados, paleta);
      const delayMs = Math.max(20, Math.round(((duration || 70000) / 1000) * passo));
      enc.writeFrame(idx, outW, outH, { palette: paleta, delay: delayMs });
    }
    enc.finish();
    drawShareCard();
    await window.api.saveGif(enc.bytes());
  } catch (err) {
    alert('Não consegui gerar o GIF: ' + err.message);
  }
  drawShareCard();
}

$('btnCopiarCard').onclick = () => {
  const midia = S.config.shareMidia;
  if (midia && midia.tipo === 'gif') gerarGifAnimado();
  else window.api.copyImage($('shareCanvas').toDataURL('image/png'));
};

// ---------- Novo pedido ----------
let npM = 'BRL';
$('btnNovo').onclick = () => { $('ovNovo').classList.add('open'); $('npTitulo').focus(); };
$('npCancelar').onclick = () => $('ovNovo').classList.remove('open');
$('npMoeda').onclick = (e) => {
  const m = e.target.dataset.m;
  if (!m) return;
  npM = m;
  document.querySelectorAll('#npMoeda .moeda-opt').forEach(x => x.classList.toggle('sel', x.dataset.m === m));
};
$('npSalvar').onclick = async () => {
  const titulo = $('npTitulo').value.trim();
  if (!titulo) { $('npTitulo').focus(); return; }
  if (ocupados() >= S.config.slots &&
      !confirm(`Seus ${S.config.slots} slots estão cheios (trabalhos ainda não pagos). Aceitar mesmo assim?`)) return;
  S.jobs.push({
    id: 'j' + Date.now(),
    titulo,
    cliente: $('npCliente').value.trim(),
    valor: { q: +$('npValor').value || 0, m: npM },
    prazo: $('npPrazo').value || '',
    status: 'aceito',
    pagamento: $('npPgto').value,
    pagoEm: $('npPgto').value === 'pago' ? new Date().toISOString() : undefined,
    criadoEm: new Date().toISOString()
  });
  ['npTitulo', 'npCliente', 'npValor', 'npPrazo'].forEach(i => $(i).value = '');
  $('ovNovo').classList.remove('open');
  await salvar();
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => o.classList.remove('open'));
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); $('searchInput').focus(); }
});

function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

// expõe ações pros onclick inline
Object.assign(window, { tornarAtivo, pausarRetomar, voltarFila, avancar, ciclarPagamento, excluir, cobrei, separeiCofre, escolherFavorita, abrirLiquidacao, alternarVerTodos });

// ---------- Boot ----------
function migrarLiquidacao() {
  let mudou = false;
  for (const j of S.jobs) {
    if (j.pagamento === 'pago' && j.liquidado === undefined) {
      j.liquidado = true;
      j.liquidadoEm = j.pagoEm;
      j.liquidadoBRL = j.valor.m === 'BRL' ? Number(j.valor.q)
        : j.valor.m === 'USD' ? Number(j.valor.q) * S.config.cotacaoUSD
        : (Number(j.valor.q) / 1000) * S.config.cotacaoRBX1k;
      mudou = true;
    }
  }
  return mudou;
}

(async () => {
  S = await window.api.getState();
  if (migrarLiquidacao()) await window.api.saveState(S);
  if (verificarInsignias()) await window.api.saveState(S);
  render();
  window.api.onState((s) => { S = s; render(); });
  buscarCotacao();
  setInterval(() => {
    const main = document.querySelector('.main');
    main.classList.add('sem-anim');
    render();
    setTimeout(() => main.classList.remove('sem-anim'), 60);
  }, 60 * 1000); // atualiza prazos/saudação sem repetir as animações
})();
