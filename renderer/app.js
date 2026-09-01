// Crava — lógica da janela principal
let S = null; // estado completo {config, jobs, stats}

const $ = (id) => document.getElementById(id);
const hoje = () => new Date().toISOString().slice(0, 10);
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
function ganhoMes(moeda) {
  const mes = hoje().slice(0, 7);
  return S.jobs
    .filter(j => j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 7) === mes && j.valor.m === moeda)
    .reduce((a, j) => a + Number(j.valor.q), 0);
}
function totalPagoBRLequiv() {
  const c = S.config;
  return S.jobs.filter(j => j.pagamento === 'pago').reduce((a, j) => {
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
async function tornarAtivo(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  const atual = ativo();
  if (atual && atual.id !== id) { atual.status = 'aceito'; delete atual.fazendoDesde; }
  j.status = 'fazendo';
  j.fazendoDesde = Date.now();
  await salvar();
}
async function pausar(id) {
  const j = S.jobs.find(x => x.id === id);
  if (j) { j.status = 'aceito'; delete j.fazendoDesde; await salvar(); }
}
async function avancar(id) {
  const j = S.jobs.find(x => x.id === id);
  if (!j) return;
  if (j.status === 'fazendo') {
    j.status = 'entregue';
    j.entregueEm = new Date().toISOString();
    delete j.fazendoDesde;
    const dia = hoje();
    S.stats.historico[dia] = (S.stats.historico[dia] || 0) + 1;
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
    abrirCofre(j);
  }
  await salvar();
}
async function excluir(id) {
  if (!confirm('Excluir esse trabalho?')) return;
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
      $('metaDetalhe').textContent = `${S.config.metaDiaria} de ${S.config.metaDiaria} concluídos hoje.`;
      $('metaStreak').textContent = `Streak: ${S.stats.streak} ${S.stats.streak === 1 ? 'dia' : 'dias seguidos'}`;
      $('ovMeta').classList.add('open');
    }
  }
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
  $('cofreDetalhe').textContent = `${j.titulo} · entrou ${fmtValor(j.valor)}`;
  $('cofreValor').textContent = `Separa ${fmtValor({ q: guardar, m: j.valor.m })} (${pct}%)`;
  $('ovCofre').classList.add('open');
}
$('cofreSim').onclick = async () => {
  S.stats.cofres.push({ data: hoje(), valor: cofreJob ? fmtValor({ q: cofreJob.valor.q * S.config.cofrePct / 100, m: cofreJob.valor.m }) : '', confirmado: true });
  $('ovCofre').classList.remove('open');
  await salvar();
};
$('cofreDepois').onclick = async () => {
  S.stats.cofres.push({ data: hoje(), valor: '', confirmado: false });
  $('ovCofre').classList.remove('open');
  await salvar();
};
$('metaFechar').onclick = () => $('ovMeta').classList.remove('open');

// ---------- Render ----------
function render() {
  document.documentElement.dataset.theme = S.config.tema || 'escuro';
  document.documentElement.dataset.mascote = S.config.mascote || 'azul';
  atualizarSprites();

  // saudação e data
  const h = new Date().getHours();
  const sauda = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('saudacao').textContent = `${sauda}, ${S.config.nome || 'você'}`;
  $('dataHoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // chips
  const st = streakVigente();
  $('chipStreak').textContent = `${st} ${st === 1 ? 'dia' : 'dias'}`;

  // slots
  const occ = ocupados(), tot = S.config.slots;
  $('slotsCount').textContent = `${occ} de ${tot}`;
  $('slotsBar').innerHTML = Array.from({ length: tot }, (_, i) =>
    `<div class="slot ${i < occ ? 'on' : ''}"></div>`).join('');

  renderStats();
  renderUser();
  renderAtivo();
  renderFila();
  renderCobrador();
  renderTodos();
  renderInsignias();
  renderConfig();
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
      <div class="stat-label">META DO DIA</div>
      <div class="stat-value">${feitos}<span style="opacity:0.7;font-size:18px"> / ${meta}</span></div>
      <div class="stat-segs">${segs}</div>
      <div class="stat-sub ${glow ? '' : (feitos >= meta ? 'c-green' : 'c-blue')}">${feitos >= meta ? 'meta batida — jogo liberado!' : `faltam ${meta - feitos} pro jogo liberar`}</div>
    </div>
    <div class="stat-card ${glow ? 'solid-orange' : ''}">
      ${badge}
      <div class="stat-label">PRA RECEBER</div>
      <div class="stat-value ${glow ? '' : 'c-amber'}">${recParts[0] || 'R$ 0'}</div>
      <div class="stat-sub">${recParts.length > 1 ? '+ ' + recParts.slice(1).join(' · ') : `${recN} trabalho${recN === 1 ? '' : 's'} aguardando pgto`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">PRAZO MAIS PRÓXIMO</div>
      <div class="stat-value ${prox ? prazoClasse(prox.prazo) || 'c-amber' : ''}">${prox ? prazoTexto(prox.prazo) : '—'}</div>
      <div class="stat-sub">${prox ? esc(prox.titulo) : 'nenhum prazo aberto'}</div>
    </div>
    <div class="stat-card ${glow ? 'solid-green' : ''}">
      ${badge}
      <div class="stat-label">GANHO NO MÊS</div>
      <div class="stat-value ${glow ? '' : 'c-green'}">${MOEDA.BRL.fmt(gb)}</div>
      <div class="stat-sub">${gSubs.length ? '+ ' + gSubs.join(' · ') : 'só R$ até agora'}</div>
    </div>`;
}

// ---------- Card do usuário / perfil ----------
function avatarStyle() {
  return S.config.foto ? `background-image:url(${S.config.foto})` : '';
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
  $('perfilSubShow').textContent = `${user} · GFX designer`;
  if (document.activeElement !== $('pfNome')) $('pfNome').value = nome === 'você' ? '' : nome;
  if (document.activeElement !== $('pfUser')) $('pfUser').value = S.config.usuario || '';
}

const PIPE = ['aceito', 'fazendo', 'entregue', 'aprovado'];
const PIPE_LABEL = { aceito: 'ACEITO', fazendo: 'FAZENDO', entregue: 'ENTREGUE', aprovado: 'APROVADO' };
const PGTO_CHIP = {
  nao_pago: ['Não pago', 'bc-faint'],
  aguardando: ['Aguardando pgto', 'bc-amber'],
  pago: ['Pago', 'bc-green']
};

function pipelineHTML(j) {
  const idx = PIPE.indexOf(j.status);
  return `<div class="pipeline">${PIPE.map((_, i) =>
      `<div class="pipe ${i < idx ? 'done' : i === idx ? 'now' : ''}"></div>`).join('')}</div>
    <div class="pipe-labels">${PIPE.map((p, i) =>
      `<div class="pipe-label ${i < idx ? 'done' : i === idx ? 'now' : ''}">${PIPE_LABEL[p]}</div>`).join('')}</div>`;
}

function renderAtivo() {
  const j = ativo();
  if (!j) {
    const prox = S.jobs.find(x => x.status === 'aceito');
    $('activeArea').innerHTML = `
      <div class="active-card" style="justify-content:center">
        <div class="empty-state" style="padding:18px 0">
          <div class="big">Nenhum trabalho ativo</div>
          <div>${prox ? 'Escolhe um da fila e crava nele.' : 'Fila vazia — captura um pedido novo com Ctrl+Shift+N.'}</div>
          ${prox ? `<div class="btn btn-primary" style="margin-top:6px;padding:10px 22px" onclick="tornarAtivo('${prox.id}')">Começar: ${esc(prox.titulo)}</div>` : ''}
        </div>
      </div>`;
    return;
  }
  const [ptxt, pcls] = PGTO_CHIP[j.pagamento];
  const btnLabel = j.status === 'fazendo' ? 'Marcar entregue' : 'Marcar aprovado';
  $('activeArea').innerHTML = `
    <div class="active-card">
      <div class="ac-left">
        <div class="ac-tag"><div class="dot"></div><div class="ac-tag-text">TRABALHO ATIVO</div></div>
        <div><div class="ac-title">${esc(j.titulo)}</div><div class="ac-sub">${esc(j.cliente || 'sem cliente')}</div></div>
        ${pipelineHTML(j)}
      </div>
      <div class="ac-right">
        <div class="kv"><div class="kv-k">Valor</div><div class="kv-v">${fmtValor(j.valor)}</div></div>
        <div class="kv"><div class="kv-k">Prazo</div><div class="kv-v ${prazoClasse(j.prazo)}" style="font-size:12px">${prazoTexto(j.prazo) || '—'}</div></div>
        <div class="kv"><div class="kv-k">Pagamento</div><div class="badge-chip ${pcls} click" onclick="ciclarPagamento('${j.id}')">${ptxt}</div></div>
        <div class="ac-spacer"></div>
        <div class="btn btn-primary" onclick="avancar('${j.id}')">✓ ${btnLabel}</div>
        <div class="btn-row">
          ${j.pagamento !== 'pago' ? `<div class="btn btn-green" onclick="ciclarPagamento('${j.id}')" style="font-size:12px">Recebi o pgto</div>` : ''}
          <div class="btn btn-ghost" onclick="pausar('${j.id}')" style="font-size:12px">Pausar</div>
        </div>
      </div>
    </div>`;
}

function jobRowHTML(j, num, dim) {
  const [ptxt, pcls] = PGTO_CHIP[j.pagamento];
  const acts = [];
  if (j.status === 'aceito') acts.push(`<div class="mini-btn primary" onclick="tornarAtivo('${j.id}')">Cravar</div>`);
  if (j.status === 'entregue') acts.push(`<div class="mini-btn" onclick="avancar('${j.id}')">Aprovado ✓</div>`);
  acts.push(`<div class="mini-btn" onclick="excluir('${j.id}')">✕</div>`);
  return `
    <div class="job-row ${dim ? 'dim' : ''}">
      <div class="job-main">
        ${num ? `<div class="job-num">${num}</div>` :
          `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`}
        <div>
          <div class="job-title">${esc(j.titulo)}</div>
          <div class="job-client">${esc(j.cliente || '')} · ${PIPE_LABEL[j.status].toLowerCase()} · <span class="${prazoClasse(j.prazo)}">${prazoTexto(j.prazo) || 'sem prazo'}</span></div>
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
  const fila = S.jobs.filter(j => j.status === 'aceito');
  const feitos = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 10) === hoje());
  let html = '';
  if (fila.length) {
    html += `<div class="section-label">NA FILA · ${fila.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${fila.map((j, i) => jobRowHTML(j, i + 2, false)).join('')}</div>`;
  }
  if (feitos.length) {
    html += `<div class="section-label" style="margin-top:12px">CONCLUÍDOS HOJE · ${feitos.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${feitos.map(j => jobRowHTML(j, null, true)).join('')}</div>`;
  }
  if (!html) html = `<div class="empty-state"><img src="${spr('espiar')}" alt="" style="width:64px;height:auto;image-rendering:pixelated;opacity:0.85"><div class="big">Dia limpo</div><div>Ctrl+Shift+N captura um pedido novo em 5 segundos.</div></div>`;
  $('filaArea').innerHTML = html;
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
      <div class="cobrador-btn" onclick="cobrei('${alvo.id}')">Cobrei</div>
    </div>`;
}

let busca = '';
function renderTodos() {
  let todos = [...S.jobs].sort((a, b) => (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1);
  if (busca) todos = todos.filter(j => `${j.titulo} ${j.cliente || ''}`.toLowerCase().includes(busca));
  $('listaTodos').innerHTML = todos.length
    ? `<div class="job-grid">${todos.map(j => jobRowHTML(j, null, j.status === 'aprovado' && j.pagamento === 'pago')).join('')}</div>`
    : `<div class="empty-state"><div class="big">${busca ? 'Nada encontrado' : 'Nenhum trabalho ainda'}</div><div>${busca ? `nenhum trabalho bate com "${esc(busca)}"` : 'Aceita um pedido e ele aparece aqui.'}</div></div>`;
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
  const c = S.config;
  return S.jobs.filter(j => j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 7) === mes)
    .reduce((a, j) => {
      if (j.valor.m === 'BRL') return a + Number(j.valor.q);
      if (j.valor.m === 'USD') return a + Number(j.valor.q) * c.cotacaoUSD;
      return a + (Number(j.valor.q) / 1000) * c.cotacaoRBX1k;
    }, 0);
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

// Categorias: dia, mês, prazo, dinheiro (R$/US$/Robux)
const INSIGNIAS = [
  { id: 'maquina', nome: 'Máquina', desc: '5 entregas num único dia', cor: 'var(--blue)', icon: IC.bolt,
    check: () => Object.values(S.stats.historico).some(n => n >= 5) },
  { id: 'semana', nome: 'Semana Cravada', desc: '7 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 7 },
  { id: 'ferro', nome: 'Mês de Ferro', desc: '30 dias de meta seguidos', cor: 'var(--flame)', icon: IC.flame,
    check: () => S.stats.maxStreak >= 30 },
  { id: 'monstro', nome: 'Mês Monstro', desc: '20 entregas num mês', cor: 'var(--blue)', icon: IC.calendario,
    check: () => mesesComAtividade().some(m => entregasDoMes(m).length >= 20) },
  { id: 'mes-ouro', nome: 'Mês de Ouro', desc: 'R$ 20.000 recebidos num mês (equiv.)', cor: 'var(--amber)', icon: IC.coin,
    check: () => mesesComAtividade().some(m => ganhoEquivDoMes(m) >= 20000) },
  { id: 'pontual', nome: 'Pontualidade', desc: 'Mês com 5+ entregas e zero atraso', cor: 'var(--green)', icon: IC.relogio,
    check: algumMesPontual },
  { id: 'dez-k', nome: 'Primeiros 10k', desc: 'R$ 10.000 no total (equiv.)', cor: 'var(--green)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 10000 },
  { id: 'cem-k', nome: 'Clube dos 100k', desc: 'R$ 100.000 no total (equiv.)', cor: 'var(--green)', icon: IC.coin,
    check: () => totalPagoBRLequiv() >= 100000 },
  { id: 'gringo', nome: 'Gringo', desc: 'US$ 1.000 recebidos no total', cor: 'var(--blue)', icon: IC.dolar,
    check: () => totalMoedaPaga('USD') >= 1000 },
  { id: 'robuxeiro', nome: 'Robuxeiro', desc: '100.000 Robux recebidos', cor: '#2fd39c', icon: IC.robux,
    check: () => totalMoedaPaga('RBX') >= 100000 },
  { id: 'rei-robux', nome: 'Rei dos Robux', desc: '1.000.000 Robux recebidos', cor: 'var(--amber)', icon: IC.coroa,
    check: () => totalMoedaPaga('RBX') >= 1000000 }
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
      try { new Notification('Insígnia desbloqueada! 🏅', { body: b.nome }); } catch { }
    }
  }
  return mudou;
}

function fmtMes(mes) {
  const [a, m] = mes.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[+m - 1]}/${a}`;
}

function renderInsignias() {
  const ganhas = S.stats.insigniasGanhas || {};
  let n = 0;
  $('insigniasGrid').innerHTML = INSIGNIAS.map(b => {
    const data = ganhas[b.id];
    const ok = !!data;
    if (ok) n++;
    return `
      <div class="insignia ${ok ? '' : 'locked'}" ${ok ? `style="border-color:${b.cor}66"` : ''}>
        <div class="insignia-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ok ? b.cor : 'var(--faint)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ok ? b.icon : CADEADO}</svg>
        </div>
        <div class="insignia-name">${b.nome}</div>
        <div class="insignia-desc">${b.desc}</div>
        ${ok ? `<div class="insignia-data">conquistada em ${data.split('-').reverse().join('/')}</div>` : ''}
      </div>`;
  }).join('');
  $('insigniasCount').textContent = `· ${n} de ${INSIGNIAS.length}`;
  renderHistorico();
}

// ---------- Histórico mensal ----------
function renderHistorico() {
  const meses = mesesComAtividade();
  const ganhas = S.stats.insigniasGanhas || {};
  if (!meses.length) { $('historicoMeses').innerHTML = ''; return; }
  $('historicoMeses').innerHTML = `<div class="section-label" style="margin-top:16px">HISTÓRICO POR MÊS</div>` +
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
            <span><b>${doMes.length}</b> entrega${doMes.length === 1 ? '' : 's'}</span>
            <span class="${atrasos ? 'c-red' : 'c-green'}"><b>${atrasos}</b> atraso${atrasos === 1 ? '' : 's'}</span>
            <span class="c-green">${partes.length ? partes.join(' · ') : 'nada recebido'}</span>
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
  document.querySelectorAll('#mascotePicker .tema-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.mascote === (S.config.mascote || 'azul')));
}
$('glowPicker').onclick = async (e) => {
  const g = e.target.dataset.glow;
  if (g) { S.config.glowCards = g === 'on'; await salvar(); }
};
$('mascotePicker').onclick = async (e) => {
  const m = e.target.dataset.mascote;
  if (m) { S.config.mascote = m; await salvar(); }
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
  if (nome === 'share') drawShareCard();
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

// ---------- Card do mês (share card estilo GMGN) ----------
const FUNDOS = [
  ['#0c1322', '#0f1d3a', '#12264e'],
  ['#120a1e', '#1a0f2e', '#351b5e'],
  ['#081710', '#0d2418', '#12503a'],
  ['#1c0d05', '#2b1408', '#6e3d12']
];
let fundoSel = 0, mascoteOn = true;

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Mascotes por tema ----------
const SPRITES = {
  azul: {
    logo: '../assets/macaco/macaco-02.png',
    shareHead: '../assets/macaco/macaco-02.png',
    shareBig: '../assets/macaco/macaco-03.png',
    metaModal: '../assets/macaco/macaco-03.png',
    cofre: '../assets/macaco/macaco-06.png',
    espiar: '../assets/macaco/macaco-01.png'
  },
  gato: {
    logo: '../assets/gato/gato-01.png',
    shareHead: '../assets/gato/gato-01.png',
    shareBig: '../assets/gato/gato-14.png',
    metaModal: '../assets/gato/gato-14.png',
    cofre: '../assets/gato/gato-19.png',
    espiar: '../assets/gato/gato-20.png'
  }
};
function spr(slot) {
  const m = S && S.config.mascote === 'gato' ? 'gato' : 'azul';
  return SPRITES[m][slot];
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
}

function drawShareCard() {
  const cv = $('shareCanvas'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height; // 1120x680 (2x)
  ctx.clearRect(0, 0, W, H);

  // fundo
  const [c1, c2, c3] = FUNDOS[fundoSel];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1); g.addColorStop(0.7, c2); g.addColorStop(1, c3);
  rrect(ctx, 0, 0, W, H, 44);
  ctx.fillStyle = g; ctx.fill();

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
  ctx.fillStyle = '#7d8cab'; ctx.font = F(700, 22); ctx.textAlign = 'right';
  ctx.fillText(mes, W - 56, 88); ctx.textAlign = 'left';

  // faturamento
  const gb = ganhoMes('BRL'), gu = ganhoMes('USD'), gr = ganhoMes('RBX');
  ctx.fillStyle = '#7d8cab'; ctx.font = F(700, 24); ctx.fillText('FATUREI', 56, 190);
  ctx.fillStyle = '#34d399'; ctx.font = F(800, 84);
  ctx.fillText(MOEDA.BRL.fmt(gb), 52, 272);
  const subs = [];
  if (gu) subs.push(MOEDA.USD.fmt(gu));
  if (gr) subs.push(MOEDA.RBX.fmt(gr));
  if (subs.length) { ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 26); ctx.fillText('+ ' + subs.join(' · '), 56, 314); }

  // mascote
  if (mascoteOn && MASCOTE_IMG.complete && MASCOTE_IMG.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    const mh = 230, mw = mh * MASCOTE_IMG.naturalWidth / MASCOTE_IMG.naturalHeight;
    ctx.drawImage(MASCOTE_IMG, W - mw - 64, 116, mw, mh);
    ctx.imageSmoothingEnabled = true;
  }

  // stats
  const mesKey = hoje().slice(0, 7);
  const trab = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 7) === mesKey).length;
  const pagosMes = S.jobs.filter(j => j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 7) === mesKey);
  const ticket = pagosMes.length ? Math.round(totalPagoBRLequiv() / Math.max(1, S.jobs.filter(j => j.pagamento === 'pago').length)) : 0;
  const nIns = INSIGNIAS.filter(b => b.check()).length;
  const stats = [
    ['TRABALHOS', String(trab), '#eef2f9'],
    ['MAIOR STREAK', `${S.stats.maxStreak} dias`, '#fbbf24'],
    ['TICKET MÉDIO', `R$ ${fmtNum(ticket)}`, '#eef2f9'],
    ['INSÍGNIAS', String(nIns), '#34d399']
  ];
  let sx = 56;
  for (const [lab, val, cor] of stats) {
    ctx.fillStyle = '#7d8cab'; ctx.font = F(700, 19); ctx.fillText(lab, sx, 408);
    ctx.fillStyle = cor; ctx.font = F(800, 33); ctx.fillText(val, sx, 448);
    sx += Math.max(ctx.measureText(val).width, ctx.measureText(lab).width) + 70;
  }

  // rodapé: avatar + nome + selo
  const nome = S.config.nome || 'você';
  const user = S.config.usuario || '@' + nome.toLowerCase().replace(/\s+/g, '');
  const ay = H - 120;
  const ag = ctx.createLinearGradient(56, ay, 120, ay + 64);
  ag.addColorStop(0, '#3b82f6'); ag.addColorStop(1, '#1d4ed8');
  ctx.beginPath(); ctx.arc(88, ay + 32, 32, 0, 7); ctx.fillStyle = ag; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = F(800, 26); ctx.textAlign = 'center';
  ctx.fillText(nome[0].toUpperCase(), 88, ay + 42); ctx.textAlign = 'left';
  ctx.fillStyle = '#eef2f9'; ctx.font = F(800, 26); ctx.fillText(nome, 136, ay + 26);
  ctx.fillStyle = '#7d8cab'; ctx.font = F(600, 21); ctx.fillText(`${user} · GFX pra Roblox`, 136, ay + 56);

  ctx.fillStyle = '#7d8cab'; ctx.font = F(700, 18); ctx.textAlign = 'right';
  ctx.fillText('feito com', W - 152, ay + 22);
  ctx.fillText('Crava', W - 152, ay + 46); ctx.textAlign = 'left';
  // QR decorativo
  rrect(ctx, W - 132, ay - 4, 76, 76, 14); ctx.fillStyle = '#eef2f9'; ctx.fill();
  ctx.fillStyle = c1;
  const QR = [[0, 0], [1, 0], [3, 0], [1, 1], [2, 1], [0, 2], [2, 2], [3, 2], [0, 3], [1, 3], [3, 3]];
  for (const [qx, qy] of QR) ctx.fillRect(W - 132 + 12 + qx * 14, ay - 4 + 12 + qy * 14, 11, 11);

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

// picker de fundo
$('fundoPicker').innerHTML = FUNDOS.map((f, i) =>
  `<div class="fundo-opt ${i === 0 ? 'sel' : ''}" data-i="${i}" style="background:linear-gradient(150deg,${f[1]},${f[2]})"></div>`).join('');
$('fundoPicker').onclick = (e) => {
  const i = e.target.dataset.i;
  if (i === undefined) return;
  fundoSel = +i;
  document.querySelectorAll('.fundo-opt').forEach(x => x.classList.toggle('sel', x.dataset.i === i));
  drawShareCard();
};
$('mascoteToggle').classList.add('on');
$('mascoteToggle').onclick = () => {
  mascoteOn = !mascoteOn;
  $('mascoteToggle').classList.toggle('on', mascoteOn);
  drawShareCard();
};
$('btnCopiarCard').onclick = () => {
  window.api.copyImage($('shareCanvas').toDataURL('image/png'));
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
Object.assign(window, { tornarAtivo, pausar, avancar, ciclarPagamento, excluir, cobrei });

// ---------- Boot ----------
(async () => {
  S = await window.api.getState();
  if (verificarInsignias()) await window.api.saveState(S);
  render();
  window.api.onState((s) => { S = s; render(); });
  setInterval(render, 60 * 1000); // atualiza prazos/saudação
})();
