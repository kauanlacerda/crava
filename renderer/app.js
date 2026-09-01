// Cravado — lógica da janela principal
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
async function salvar() { await window.api.saveState(S); render(); }

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

  // saudação e data
  const h = new Date().getHours();
  const sauda = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('saudacao').textContent = `${sauda}, ${S.config.nome || 'você'}`;
  $('dataHoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // chips
  const st = streakVigente();
  $('chipStreak').textContent = `${st} ${st === 1 ? 'dia' : 'dias'}`;
  const gb = ganhoMes('BRL'), gu = ganhoMes('USD'), gr = ganhoMes('RBX');
  $('chipGanho').textContent = MOEDA.BRL.fmt(gb);
  const subs = [];
  if (gu) subs.push(MOEDA.USD.fmt(gu));
  if (gr) subs.push(MOEDA.RBX.fmt(gr));
  $('chipGanhoSub').textContent = subs.length ? '+ ' + subs.join(' · ') : '';

  // slots
  const occ = ocupados(), tot = S.config.slots;
  $('slotsCount').textContent = `${occ} de ${tot}`;
  $('slotsBar').innerHTML = Array.from({ length: tot }, (_, i) =>
    `<div class="slot ${i < occ ? 'on' : ''}"></div>`).join('');

  // progresso do dia
  const feitos = concluidosHoje().length, meta = S.config.metaDiaria;
  $('progTexto').textContent = `${feitos} de ${meta} concluídos hoje`;
  $('progFaltam').textContent = feitos >= meta ? 'meta batida! 🎮' : `faltam ${meta - feitos} pro jogo liberar`;
  $('progBar').innerHTML = Array.from({ length: meta }, (_, i) =>
    `<div class="seg ${i < feitos ? 'done' : i === feitos ? 'active' : ''}"></div>`).join('');

  renderAtivo();
  renderFila();
  renderCobrador();
  renderTodos();
  renderInsignias();
  renderConfig();
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
      ${num ? `<div class="job-num">${num}</div>` :
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`}
      <div class="job-main">
        <div class="job-title">${esc(j.titulo)}</div>
        <div class="job-client">${esc(j.cliente || '')} · ${PIPE_LABEL[j.status].toLowerCase()}</div>
      </div>
      <div class="badge-chip ${pcls} click" onclick="ciclarPagamento('${j.id}')">${ptxt}</div>
      <div class="job-value">${fmtValor(j.valor)}</div>
      <div class="job-due ${prazoClasse(j.prazo)}">${prazoTexto(j.prazo)}</div>
      <div class="job-actions">${acts.join('')}</div>
    </div>`;
}

function renderFila() {
  const fila = S.jobs.filter(j => j.status === 'aceito');
  const feitos = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 10) === hoje());
  let html = '';
  if (fila.length) {
    html += `<div class="section-label">NA FILA · ${fila.length}</div>`;
    html += fila.map((j, i) => jobRowHTML(j, i + 2, false)).join('');
  }
  if (feitos.length) {
    html += `<div class="section-label">CONCLUÍDOS HOJE · ${feitos.length}</div>`;
    html += feitos.map(j => jobRowHTML(j, null, true)).join('');
  }
  if (!html) html = `<div class="empty-state"><div class="big">Dia limpo</div><div>Ctrl+Shift+N captura um pedido novo em 5 segundos.</div></div>`;
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

function renderTodos() {
  const todos = [...S.jobs].sort((a, b) => (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1);
  $('listaTodos').innerHTML = todos.length
    ? todos.map(j => jobRowHTML(j, null, j.status === 'aprovado' && j.pagamento === 'pago')).join('')
    : `<div class="empty-state"><div class="big">Nenhum trabalho ainda</div><div>Aceita um pedido e ele aparece aqui.</div></div>`;
}

// ---------- Insígnias ----------
const INSIGNIAS = [
  { id: 'semana', nome: 'Semana Cravada', desc: '7 dias de meta seguidos', cor: 'var(--flame)', check: () => S.stats.maxStreak >= 7,
    icon: '<path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.5-1.4-4.6-3-6.5-.5 1.2-1.3 2-2.5 2.5C13.8 9 14 5.5 11 2c-.3 3-1.5 4.7-3 6.2C6.4 9.8 5 11.9 5 15.5 5 19.2 7.6 22 12 22z"/>' },
  { id: 'dez-k', nome: 'Primeiros 10k', desc: 'R$ 10.000 faturados (equiv.)', cor: 'var(--green)', check: () => totalPagoBRLequiv() >= 10000,
    icon: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.7-1.4-1.2-2.5-1.2-1.7 0-3 1-3 2.2s1.1 1.8 3 2c2 .2 3 .9 3 2.1 0 1.2-1.3 2.2-3 2.2-1.1 0-2-.5-2.5-1.2"/><path d="M12 6.5V8"/><path d="M12 16.5V18"/>' },
  { id: 'maquina', nome: 'Máquina', desc: '5 trabalhos num dia', cor: 'var(--blue)', check: () => Object.values(S.stats.historico).some(n => n >= 5),
    icon: '<path d="M13 2L4.1 12.5a1 1 0 0 0 .8 1.5H11l-1 8 8.9-10.5a1 1 0 0 0-.8-1.5H13z"/>' },
  { id: 'poupador', nome: 'Poupador', desc: '10 cofres confirmados', cor: '#ff8fa3', check: () => S.stats.cofres.filter(c => c.confirmado).length >= 10,
    icon: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="16" cy="13" r="1"/><path d="M7 20v1.5"/><path d="M17 20v1.5"/>' },
  { id: 'ferro', nome: 'Mês de Ferro', desc: '30 dias de meta seguidos', cor: 'var(--flame)', check: () => S.stats.maxStreak >= 30 },
  { id: 'cem-k', nome: 'Clube dos 100k', desc: 'R$ 100.000 no total (equiv.)', cor: 'var(--green)', check: () => totalPagoBRLequiv() >= 100000 },
  { id: 'pontual', nome: 'Pontualidade', desc: '5+ entregas no mês, zero atraso', cor: 'var(--blue)', check: checaPontualidade },
  { id: 'cobrado', nome: 'Sempre Cobrado', desc: '10 cobranças feitas no aviso', cor: 'var(--amber)', check: () => S.jobs.filter(j => j.cobradoEm).length >= 10 }
];
function checaPontualidade() {
  const mes = hoje().slice(0, 7);
  const doMes = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 7) === mes);
  return doMes.length >= 5 && doMes.every(j => !j.prazo || j.entregueEm.slice(0, 10) <= j.prazo);
}
const CADEADO = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';

function renderInsignias() {
  let n = 0;
  $('insigniasGrid').innerHTML = INSIGNIAS.map(b => {
    const ok = b.check();
    if (ok) n++;
    return `
      <div class="insignia ${ok ? '' : 'locked'}" ${ok ? `style="border-color:${b.cor}66"` : ''}>
        <div class="insignia-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ok ? b.cor : 'var(--faint)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ok && b.icon ? b.icon : CADEADO}</svg>
        </div>
        <div class="insignia-name">${b.nome}</div>
        <div class="insignia-desc">${b.desc}</div>
      </div>`;
  }).join('');
  $('insigniasCount').textContent = `· ${n} de ${INSIGNIAS.length}`;
}

// ---------- Config ----------
function renderConfig() {
  $('cfgNome').value = S.config.nome || '';
  $('cfgMeta').value = S.config.metaDiaria;
  $('cfgSlots').value = S.config.slots;
  $('cfgCofre').value = S.config.cofrePct;
  $('cfgUSD').value = S.config.cotacaoUSD;
  $('cfgRBX').value = S.config.cotacaoRBX1k;
  document.querySelectorAll('.tema-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.tema === (S.config.tema || 'escuro')));
}
$('temaPicker').onclick = async (e) => {
  const t = e.target.dataset.tema;
  if (t) { S.config.tema = t; await salvar(); }
};
$('btnSalvarConfig').onclick = async () => {
  S.config.nome = $('cfgNome').value.trim() || 'você';
  S.config.metaDiaria = Math.max(1, +$('cfgMeta').value || 5);
  S.config.slots = Math.max(1, +$('cfgSlots').value || 3);
  S.config.cofrePct = Math.min(90, Math.max(0, +$('cfgCofre').value || 30));
  S.config.cotacaoUSD = +$('cfgUSD').value || 5.4;
  S.config.cotacaoRBX1k = +$('cfgRBX').value || 28;
  await salvar();
};

// ---------- Navegação ----------
document.querySelectorAll('.nav-item').forEach(el => {
  el.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('open'));
    $('view-' + el.dataset.view).classList.add('open');
  };
});
$('btnWidget').onclick = () => window.api.toggleWidget();

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
});

function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

// expõe ações pros onclick inline
Object.assign(window, { tornarAtivo, pausar, avancar, ciclarPagamento, excluir, cobrei });

// ---------- Boot ----------
(async () => {
  S = await window.api.getState();
  render();
  window.api.onState((s) => { S = s; render(); });
  setInterval(render, 60 * 1000); // atualiza prazos/saudação
})();
