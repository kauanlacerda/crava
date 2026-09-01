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

// ---------- Celebração (estilo Duolingo) ----------
function celebrar() {
  const cores = ['#339dff', '#2fd39c', '#f5b74e', '#ff8fa3', '#a06bff', '#ff6b5e'];
  const frases = ['Mandou bem!', 'Cravou!', 'Mais uma!', 'Boa!', 'É isso!'];
  const el = document.createElement('div');
  el.className = 'celebra';
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
  $('cofreDetalhe').textContent = `${j.titulo} · entrou ${fmtValor(j.valor)}`;
  $('cofreValor').textContent = `Separa ${fmtValor({ q: guardar, m: j.valor.m })} (${pct}%)`;
  $('ovCofre').classList.add('open');
}
function novoCofre(confirmado) {
  return {
    data: hoje(),
    valor: cofreJob ? fmtValor({ q: cofreJob.valor.q * S.config.cofrePct / 100, m: cofreJob.valor.m }) : '',
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
  document.documentElement.dataset.theme = S.config.tema || 'escuro';
  document.documentElement.dataset.cor = S.config.cor || 'azul';
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
  renderCofrePendente();
  renderCobrador();
  renderTodos();
  renderInsignias();
  renderConfig();
  renderCalendario();
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
  $('perfilSubShow').textContent = `${user} · GFX designer`;
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
    : `<div class="config-sub">Nenhuma insígnia desbloqueada ainda — crava uns trabalhos primeiro!</div>`;
}
async function escolherFavorita(id) {
  S.config.insigniaFavorita = S.config.insigniaFavorita === id ? '' : id;
  await salvar();
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
          <div class="btn btn-ghost" onclick="pausarRetomar('${j.id}')" style="font-size:12px">${j.pausado ? '▶ Retomar' : '⏸ Pausar'}</div>
          <div class="btn btn-ghost" onclick="voltarFila('${j.id}')" style="font-size:12px;max-width:70px" title="Devolver pra fila">Fila</div>
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
    html += `<div class="section-label">NA FILA · ${fila.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${fila.map((j, i) => jobRowHTML(j, i + 2, false)).join('')}</div>`;
  }
  if (esperandoPgto.length) {
    html += `<div class="section-label" style="margin-top:12px">CONCLUÍDOS HOJE — ESPERANDO PAGAMENTO · ${esperandoPgto.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${esperandoPgto.map(j => jobRowHTML(j, null, false)).join('')}</div>`;
  }
  if (pagos.length) {
    html += `<div class="section-label" style="margin-top:12px">CONCLUÍDOS HOJE — PAGOS ✓ · ${pagos.length}</div>`;
    html += `<div class="job-grid" style="margin-top:9px">${pagos.map(j => jobRowHTML(j, null, true)).join('')}</div>`;
  }
  if (!html) html = `<div class="empty-state"><img src="${spr('espiar')}" alt="" style="width:64px;height:auto;image-rendering:pixelated;opacity:0.85"><div class="big">Dia limpo</div><div>Ctrl+Shift+N captura um pedido novo em 5 segundos.</div></div>`;
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
      <div class="cobrador-text" style="color:var(--green)">Cofre pendente${c.valor ? `: separa ${esc(c.valor)}` : ''}${c.titulo ? ` — ${esc(c.titulo)}` : ''} · desde ${c.data.split('-').reverse().join('/')}</div>
      <div class="cobrador-btn" style="background:var(--green)" onclick="separeiCofre(${c.idx})">Separei ✓</div>
    </div>`).join('') +
    (pendentes.length > 3 ? `<div class="section-label">+ ${pendentes.length - 3} cofres pendentes</div>` : '');
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
  if (!todos.length) {
    $('listaTodos').innerHTML = `<div class="empty-state"><div class="big">${busca ? 'Nada encontrado' : 'Nenhum trabalho ainda'}</div><div>${busca ? `nenhum trabalho bate com "${esc(busca)}"` : 'Aceita um pedido e ele aparece aqui.'}</div></div>`;
    return;
  }
  // seções: ativo → fila → esperando aprovação/pagamento → finalizados
  const grupos = [
    ['EM ANDAMENTO', todos.filter(j => j.status === 'fazendo'), false],
    ['NA FILA', todos.filter(j => j.status === 'aceito'), false],
    ['ESPERANDO APROVAÇÃO OU PAGAMENTO', todos.filter(j =>
      (j.status === 'entregue' || j.status === 'aprovado') && j.pagamento !== 'pago'), false],
    ['FINALIZADOS E PAGOS', todos.filter(j => j.status === 'aprovado' && j.pagamento === 'pago')
      .sort((a, b) => (b.pagoEm || '') < (a.pagoEm || '') ? -1 : 1), true],
    ['ENTREGUES E PAGOS (FALTA APROVAR)', todos.filter(j => j.status === 'entregue' && j.pagamento === 'pago'), false]
  ];
  $('listaTodos').innerHTML = grupos.map(([nome, lista, dim]) => {
    if (!lista.length) return '';
    return `
      <div class="section-label" style="margin-top:12px">${nome} · ${lista.length}</div>
      <div class="job-grid" style="margin-top:9px">${lista.map(j => jobRowHTML(j, null, dim)).join('')}</div>`;
  }).join('');
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

// Categorias da coleção (cada insígnia pode ter arte própria em
// assets/insignias/<id>.png — estilo NFT; sem arquivo, usa o ícone SVG)
const CATEGORIAS_INSIGNIAS = [
  { id: 'rotina', nome: 'ROTINA' },
  { id: 'mes', nome: 'MÊS' },
  { id: 'brl', nome: 'GANHOS EM R$' },
  { id: 'usd', nome: 'GANHOS EM US$' },
  { id: 'rbx', nome: 'GANHOS EM ROBUX' },
  { id: 'geral', nome: 'GERAL — TODAS AS MOEDAS' }
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
      <div class="insignia-name">${b.nome}</div>
      <div class="insignia-desc">${b.desc}</div>
      ${ok ? `<div class="insignia-data">conquistada em ${data.split('-').reverse().join('/')}</div>` : ''}
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
      <div class="section-label" style="margin-top:14px">${cat.nome} · ${nCat}/${doCat.length}</div>
      <div class="insignias-grid" style="margin-top:9px">${doCat.map(b => insigniaHTML(b, ganhas)).join('')}</div>`;
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
  document.querySelectorAll('#corPicker .cor-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.cor === (S.config.cor || 'azul')));
}
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
  ctx.fillStyle = '#9fb0d0'; ctx.font = F(700, 24); ctx.fillText('FATUREI', 56, 190);
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
    ['TRABALHOS', String(trab), '#eef2f9'],
    ['MAIOR STREAK', `${mx} ${mx === 1 ? 'dia' : 'dias'}`, '#fbbf24'],
    ['TICKET MÉDIO', `R$ ${fmtNum(ticket)}`, '#eef2f9'],
    ['INSÍGNIAS', String(nIns), '#34d399']
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
  ctx.fillText('feito com', CW - 152, ay + 22);
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
  $('btnCopiarCard').textContent = midia && midia.tipo === 'gif' ? 'Salvar GIF' : 'Copiar imagem';
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

// ---------- Calendário de lucro (estilo PnL da GMGN) ----------
let calMes = hoje().slice(0, 7);
let calModo = 'valores'; // 'calor' (mapa de calor) | 'valores'

function ganhoEquivDoDia(dia) {
  const c = S.config;
  return S.jobs
    .filter(j => j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 10) === dia)
    .reduce((a, j) => {
      if (j.valor.m === 'BRL') return a + Number(j.valor.q);
      if (j.valor.m === 'USD') return a + Number(j.valor.q) * c.cotacaoUSD;
      return a + (Number(j.valor.q) / 1000) * c.cotacaoRBX1k;
    }, 0);
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
    .filter(j => j.pagamento === 'pago' && j.pagoEm && j.pagoEm.slice(0, 4) === String(ano))
    .reduce((a, j) => {
      if (j.valor.m === 'BRL') return a + Number(j.valor.q);
      if (j.valor.m === 'USD') return a + Number(j.valor.q) * S.config.cotacaoUSD;
      return a + (Number(j.valor.q) / 1000) * S.config.cotacaoRBX1k;
    }, 0);

  const hj = hoje();
  const dows = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let grid = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');

  let celulas = [];
  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  for (const d of celulas) {
    if (d === null) { grid += `<div class="cal-cell vazia"></div>`; continue; }
    const g = ganhos[d - 1];
    const ehHoje = `${calMes}-${String(d).padStart(2, '0')}` === hj;
    const ehMelhor = d === melhorIdx && g > 0;
    const int = maxDia > 0 ? g / maxDia : 0;
    const bg = ehMelhor
      ? 'background:rgba(245,183,78,0.22)'
      : (g > 0 ? `background:rgba(47,211,156,${(0.07 + 0.30 * int).toFixed(2)})` : '');
    grid += `<div class="cal-cell ${ehHoje ? 'hoje' : ''} ${ehMelhor ? 'melhor' : ''}" style="${bg}" title="${d}/${mes}: R$ ${fmtNum(Math.round(g))}">
      <div class="cal-dia">${d}</div>
      <div class="cal-val ${ehMelhor ? 'c-amber' : (g > 0 ? 'c-green' : 'sem-lucro')}">${g > 0 ? '+R$ ' + fmtCompacto(g) : ''}</div>
    </div>`;
  }

  $('calPanel').innerHTML = `
    <div class="cal-head">
      <div class="cal-titulo-app">Calendário de Lucro</div>
      <div style="flex-grow:1"></div>
      <div class="mini-btn" data-cal="prev">‹</div>
      <div class="cal-titulo">${nomeMes.replace('.', '')}</div>
      <div class="mini-btn" data-cal="next">›</div>
      <div class="tema-picker" style="margin-left:10px">
        <div class="tema-opt ${calModo === 'valores' ? 'sel' : ''}" data-cal="valores">Valores</div>
        <div class="tema-opt ${calModo === 'calor' ? 'sel' : ''}" data-cal="calor">Calor</div>
      </div>
    </div>
    <div class="cal-total-grande">R$ ${fmtNum(Math.round(totalMes))}</div>
    <div class="cal-linha"></div>
    <div class="cal-sub">
      <span class="c-green"><b>${diasComLucro}</b> / R$ ${fmtNum(Math.round(totalMes))}</span>
      <span class="cal-sub-dir">no ano: <b class="c-green">R$ ${fmtNum(Math.round(totalAno))}</b></span>
    </div>
    <div class="cal-grid ${calModo === 'calor' ? 'modo-calor' : ''}">${grid}</div>
    <div class="cal-rodape">Melhor sequência no mês: <b>${melhorSeq}d</b>${maxDia > 0 ? ` · melhor dia: <b class="c-amber">+R$ ${fmtCompacto(maxDia)}</b>` : ''}</div>`;
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
    if ($('view-share').classList.contains('open')) {
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
  $('btnCalFundoRemover').style.display = '';
  $('calOpacidadeWrap').style.display = '';
  if (document.activeElement !== $('calOpacidade')) $('calOpacidade').value = S.config.calMidiaOp ?? 35;
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
  await salvar();
  pintarFundoCal();
};
$('calOpacidade').oninput = () => { S.config.calMidiaOp = +$('calOpacidade').value; pintarFundoCal(); };
$('calOpacidade').onchange = async () => { await salvar(); };

// compartilhar: imagem do calendário (PNG no clipboard; GIF animado salvo em arquivo)
async function compartilharCalendario() {
  const btn = $('btnCompartilharCal');
  const midia = S.config.calMidia;
  const painel = $('calPanel');
  const r = painel.getBoundingClientRect();
  const W = Math.round(r.width * 2), H = Math.round(r.height * 2);
  const op = (S.config.calMidiaOp ?? 35) / 100;
  const txtOriginal = btn.textContent;
  btn.textContent = 'Gerando…';
  try {
    // conteúdo do painel (sem o fundo) em SVG->imagem, via foreignObject
    const clone = painel.cloneNode(true);
    const bg = clone.querySelector('.cal-bg'); if (bg) bg.remove();
    clone.style.backgroundImage = '';
    clone.style.margin = '0';
    const estilos = [...document.styleSheets]
      .map(ss => { try { return [...ss.cssRules].map(x => x.cssText).join('\n'); } catch { return ''; } })
      .join('\n');
    const html =
      '<div xmlns="http://www.w3.org/1999/xhtml" data-theme="' + (S.config.tema || 'escuro') +
      '" data-cor="' + (S.config.cor || 'azul') + '"><style>' + estilos + '</style>' + clone.outerHTML + '</div>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
      '<foreignObject width="100%" height="100%" transform="scale(2)">' + html + '</foreignObject></svg>';
    const conteudo = new Image();
    await new Promise((ok, err) => {
      conteudo.onload = ok; conteudo.onerror = err;
      conteudo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const pintaBase = (fonte) => {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#12161d';
      ctx.fillRect(0, 0, W, H);
      if (fonte) {
        const fw = fonte.naturalWidth || fonte.width, fh = fonte.naturalHeight || fonte.height;
        const esc = Math.max(W / fw, H / fh);
        ctx.globalAlpha = op;
        ctx.drawImage(fonte, (W - fw * esc) / 2, (H - fh * esc) / 2, fw * esc, fh * esc);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(8,12,24,0.35)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.drawImage(conteudo, 0, 0, W, H);
    };

    if (midia && midia.tipo === 'gif' && calGifFrames && calGifFrames.length) {
      const { GIFEncoder, quantize, applyPalette } = await import('./lib/gifenc.esm.js');
      const outW = Math.round(r.width), outH = Math.round(r.height);
      const mini = document.createElement('canvas');
      mini.width = outW; mini.height = outH;
      const mctx = mini.getContext('2d');
      const enc = GIFEncoder();
      const passo = Math.ceil(calGifFrames.length / 60);
      for (let i = 0; i < calGifFrames.length; i += passo) {
        pintaBase(calGifFrames[i]);
        mctx.drawImage(cv, 0, 0, outW, outH);
        const dados = mctx.getImageData(0, 0, outW, outH).data;
        const paleta = quantize(dados, 256);
        enc.writeFrame(applyPalette(dados, paleta), outW, outH, { palette: paleta, delay: Math.max(20, calGifDelays[i] * passo) });
      }
      enc.finish();
      await window.api.saveGif(enc.bytes());
    } else {
      pintaBase(midia && CAL_MEDIA_IMG.complete && CAL_MEDIA_IMG.naturalWidth ? CAL_MEDIA_IMG : null);
      window.api.copyImage(cv.toDataURL('image/png'));
    }
  } catch (err) {
    alert('Não consegui gerar a imagem: ' + err.message);
  }
  btn.textContent = txtOriginal;
}
$('btnCompartilharCal').onclick = compartilharCalendario;

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
Object.assign(window, { tornarAtivo, pausarRetomar, voltarFila, avancar, ciclarPagamento, excluir, cobrei, separeiCofre, escolherFavorita });

// ---------- Boot ----------
(async () => {
  S = await window.api.getState();
  if (verificarInsignias()) await window.api.saveState(S);
  render();
  window.api.onState((s) => { S = s; render(); });
  setInterval(render, 60 * 1000); // atualiza prazos/saudação
})();
