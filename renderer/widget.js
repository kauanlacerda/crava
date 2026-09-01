let S = null;
const hoje = () => new Date().toISOString().slice(0, 10);

const SLOTS_W = { vazio: 'macaco-05.png', meta: 'macaco-06.png', ativo: 'macaco-02.png' };
const CORES_W = ['azul', 'vermelho', 'verde', 'roxo', 'laranja', 'branco'];
function sprW(slot) {
  const c = S && CORES_W.includes(S.config.cor) ? S.config.cor : 'azul';
  return `../assets/macaco/${c}/${SLOTS_W[slot]}`;
}

function fmtTimer(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function fmtValor(v) {
  if (v.m === 'USD') return `US$ ${v.q}`;
  if (v.m === 'RBX') return v.q >= 1000 ? `${v.q / 1000}k Robux` : `${v.q} Robux`;
  return `R$ ${v.q}`;
}
function prazoTexto(prazo) {
  if (!prazo) return '';
  const d = Math.ceil((new Date(prazo + 'T23:59:59') - Date.now()) / 864e5);
  if (d < 0) return `· ${-d}d atrasado`;
  if (d === 0) return '· prazo HOJE';
  if (d === 1) return '· prazo amanhã';
  return `· prazo em ${d} dias`;
}

function render() {
  if (!S) return;
  const card = document.getElementById('card');
  const ativo = S.jobs.find(j => j.status === 'fazendo');
  const feitos = S.jobs.filter(j => j.entregueEm && j.entregueEm.slice(0, 10) === hoje()).length;
  const meta = S.config.metaDiaria;
  const segs = Array.from({ length: meta }, (_, i) =>
    `<div class="seg ${i < feitos ? 'done' : i === feitos ? 'now' : ''}"></div>`).join('');

  if (!ativo) {
    card.innerHTML = `
      <div class="top"><div class="dot" style="background:#5a6676"></div><div class="tag" style="color:#8b98a9">SEM TRABALHO ATIVO</div>
        <div class="prog-txt">hoje ${feitos}/${meta}</div><div class="segs">${segs}</div></div>
      <div class="vazio">
        <img src="${sprW(feitos >= meta ? 'meta' : 'vazio')}" alt="" style="width:52px;height:auto;image-rendering:pixelated">
        <div>${feitos >= meta ? 'Meta batida — jogo liberado! 🎮' : 'Abre o Crava e escolhe o próximo.'}</div>
      </div>
      <div class="btns no-drag">
        <div class="btn-main" onclick="window.api.showMain()">Abrir o Crava</div>
        <div class="btn-sq" onclick="window.api.hideWidget()">✕</div>
      </div>`;
    return;
  }
  const pausado = !!ativo.pausado;
  const t = (ativo.tempoAcumulado || 0) + (!pausado && ativo.fazendoDesde ? Date.now() - ativo.fazendoDesde : 0);
  card.innerHTML = `
    <div class="top"><div class="dot" ${pausado ? 'style="background:#f5b74e"' : ''}></div>
      <div class="tag" ${pausado ? 'style="color:#f5b74e"' : ''}>${pausado ? 'PAUSADO' : 'TRABALHO ATIVO'}</div>
      <div class="prog-txt">hoje ${feitos}/${meta}</div><div class="segs">${segs}</div></div>
    <div><div class="title">${esc(ativo.titulo)}</div>
      <div class="sub">${esc(ativo.cliente || '')} · ${fmtValor(ativo.valor)} ${prazoTexto(ativo.prazo)}</div></div>
    <div class="mid"><div class="timer" ${pausado ? 'style="opacity:0.5"' : ''}>${fmtTimer(t)}</div>
      <div class="hint">${pausado ? 'pausado —<br>respira aí' : 'focado nesse<br>trabalho'}</div>
      <img src="${sprW(pausado ? 'vazio' : 'ativo')}" alt="" style="width:46px;height:auto;image-rendering:pixelated;margin-left:auto"></div>
    <div class="btns no-drag">
      <div class="btn-main" id="btnConcluir">✓ Concluir etapa</div>
      <div class="btn-sq" id="btnPausa" title="${pausado ? 'Retomar' : 'Pausar'}">${pausado ? '▶' : '| |'}</div>
      <div class="btn-sq" onclick="window.api.showMain()" title="Abrir janela cheia">⤢</div>
      <div class="btn-sq" onclick="window.api.hideWidget()" title="Fechar widget">✕</div>
    </div>`;
  document.getElementById('btnConcluir').onclick = async () => {
    if (ativo.fazendoDesde) {
      ativo.tempoAcumulado = (ativo.tempoAcumulado || 0) + (Date.now() - ativo.fazendoDesde);
      delete ativo.fazendoDesde;
    }
    ativo.tempoTotalMs = ativo.tempoAcumulado || 0;
    delete ativo.tempoAcumulado;
    ativo.pausado = false;
    ativo.status = 'entregue';
    ativo.entregueEm = new Date().toISOString();
    const dia = hoje();
    S.stats.historico[dia] = (S.stats.historico[dia] || 0) + 1;
    await window.api.saveState(S);
  };
  document.getElementById('btnPausa').onclick = async () => {
    if (ativo.pausado) {
      ativo.pausado = false;
      ativo.fazendoDesde = Date.now();
    } else {
      if (ativo.fazendoDesde) {
        ativo.tempoAcumulado = (ativo.tempoAcumulado || 0) + (Date.now() - ativo.fazendoDesde);
        delete ativo.fazendoDesde;
      }
      ativo.pausado = true;
    }
    await window.api.saveState(S);
  };
}

function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

(async () => {
  S = await window.api.getState();
  render();
  window.api.onState((s) => { S = s; render(); });
  setInterval(render, 1000); // cronômetro
})();
