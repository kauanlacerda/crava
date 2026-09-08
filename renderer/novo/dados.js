// Camada de dados do app novo. Um único estado S = { config, jobs, stats, fin }
// que vive no processo principal (store.js) e chega aqui por window.api. No
// navegador (pré-visualização e testes) cai pra localStorage com a mesma forma.
//
// Regra de ouro: os objetos S.fin, S.jobs, S.config e S.stats NUNCA são
// trocados — só alterados por dentro. As telas guardam referência a eles e
// continuam válidas quando outro PC, a captura rápida ou a nuvem mandam um
// estado novo.
(() => {
  const P = window.Planilha;
  const CHAVE_LOCAL = 'app-estado';
  const noElectron = !!(window.api && window.api.getState);

  const S = { config: {}, jobs: [], stats: {}, fin: P.estadoVazio() };
  window.S = S; // compatibilidade com quem espera o global do app antigo

  // ---------- assinatura: o que muda na tela (carimbos de sync ficam fora) ----------
  function assinatura(e) {
    if (!e) return '';
    const { atualizadoEm, enviadoEm, ...resto } = e.stats || {};
    try { return JSON.stringify([e.jobs, e.config, resto, e.fin]); } catch { return String(Math.random()); }
  }
  let ultimaAssinatura = '';
  // Assinaturas do que já mandamos gravar e cuja volta (state:changed) ainda
  // não chegou. O eco de um estado antigo não pode desfazer o que foi feito
  // depois dele — chegaria atrasado, reverteria a memória e a próxima gravação
  // silenciosa perpetuaria a reversão.
  const enviadas = [];
  // últimos acontecimentos, pra diagnosticar sincronização sem debugger
  const registro = [];
  const anotar = (o) => { registro.push({ t: new Date().toISOString().slice(11, 23), ...o }); if (registro.length > 40) registro.shift(); };

  // ---------- troca por dentro ----------
  function trocarObjeto(alvo, fonte) {
    for (const k of Object.keys(alvo)) if (!(k in fonte)) delete alvo[k];
    Object.assign(alvo, fonte);
  }
  function trocarLista(alvo, fonte) { alvo.length = 0; alvo.push(...(Array.isArray(fonte) ? fonte : [])); }
  function normalizar(s) {
    s = s || {};
    return {
      config: { ...(s.config || {}) },
      jobs: Array.isArray(s.jobs) ? s.jobs : [],
      stats: { ...(s.stats || {}) },
      fin: { ...P.estadoVazio(), ...(s.fin || {}) }
    };
  }
  // Aplica um estado vindo de fora (disco, outra janela, nuvem). Devolve true
  // se algo visível mudou. `silencioso` pula o aviso pras telas.
  function substituir(s, silencioso) {
    const n = normalizar(s);
    const nova = assinatura(n);
    const mudou = nova !== ultimaAssinatura;
    trocarObjeto(S.config, n.config); trocarObjeto(S.stats, n.stats); trocarObjeto(S.fin, n.fin); trocarLista(S.jobs, n.jobs);
    ultimaAssinatura = nova;
    if (mudou && !silencioso) window.dispatchEvent(new CustomEvent('estado:trocou'));
    return mudou;
  }

  // ---------- gravar ----------
  function gravarLocal() { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(S)); } catch { } }
  // Conteúdo mudou (lançamento, trabalho, tag…): grava, avisa as outras janelas
  // e — quando a conta está ligada — agenda o envio pra nuvem.
  async function gravar() {
    ultimaAssinatura = assinatura(S);
    enviadas.push(ultimaAssinatura); if (enviadas.length > 20) enviadas.shift();
    anotar({ o: 'gravar', jobs: S.jobs.length, movs: S.fin.movimentacoes.length });
    if (!noElectron) { if (S.stats) S.stats.atualizadoEm = new Date().toISOString(); gravarLocal(); return true; }
    try { return await window.api.saveState(S); } catch (e) { console.warn('saveState falhou', e); return false; }
  }
  // Preferência ou cotação: grava sem acordar as outras janelas nem redesenhar.
  let timerQuieto = null;
  function gravarQuieto() {
    ultimaAssinatura = assinatura(S);
    clearTimeout(timerQuieto);
    timerQuieto = setTimeout(async () => {
      anotar({ o: 'quieto', jobs: S.jobs.length, movs: S.fin.movimentacoes.length });
      if (!noElectron) { gravarLocal(); return; }
      try { await window.api.saveStateQuieto(S); } catch (e) { console.warn('saveStateQuieto falhou', e); }
      try { if (window.agendarEnvio) window.agendarEnvio(); } catch { }
    }, 250);
  }

  // ---------- cotação ----------
  // USD: a última que veio da internet; sem ela, a reserva digitada. Robux por
  // mil: sempre manual (não tem fonte confiável).
  function cotacao() {
    const c = S.config || {};
    return { USD: Number(c.cotacaoUSDauto) || Number(c.cotacaoUSD) || 5.4, RBX1k: Number(c.cotacaoRBX1k) || 28, aoVivo: !!cotacaoAoVivo, quando: c.cotacaoUSDautoEm || '' };
  }
  let cotacaoAoVivo = false, ultimaBusca = 0;
  async function buscarCotacao() {
    ultimaBusca = Date.now();
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
      const j = await r.json();
      const taxa = j && j.rates && Number(j.rates.BRL);
      if (!taxa) throw new Error('resposta inválida');
      cotacaoAoVivo = true;
      const mudou = Math.abs(taxa - (Number(S.config.cotacaoUSDauto) || 0)) >= 0.01;
      if (mudou) {
        S.config.cotacaoUSDauto = taxa;
        S.config.cotacaoUSDautoEm = new Date().toISOString();
        gravarQuieto();
        window.dispatchEvent(new CustomEvent('cotacao:mudou'));
      }
    } catch { cotacaoAoVivo = false; }
  }

  // ---------- carregar ----------
  async function carregar() {
    if (noElectron) return await window.api.getState();
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null');
      if (s && s.fin) return s;
      // primeira vez no navegador: aproveita os dados dos protótipos, se houver
      const fin = JSON.parse(localStorage.getItem('fin-mock') || 'null');
      const jobs = JSON.parse(localStorage.getItem('jobs-mock') || '[]');
      return { config: {}, jobs, stats: {}, fin: fin || P.estadoVazio() };
    } catch { return null; }
  }

  const pronto = carregar().then((s) => {
    substituir(s, true);
    if (noElectron) {
      window.api.onState(async (novo) => {
        const ass = assinatura(normalizar(novo));
        const eco = enviadas.indexOf(ass);
        anotar({ o: 'onState', jobs: (novo.jobs || []).length, movs: ((novo.fin || {}).movimentacoes || []).length, eco: eco >= 0 });
        if (eco >= 0) { // volta de uma gravação nossa: só os carimbos interessam
          enviadas.splice(0, eco + 1);
          if (novo.stats) { S.stats.atualizadoEm = novo.stats.atualizadoEm; if (novo.stats.enviadoEm) S.stats.enviadoEm = novo.stats.enviadoEm; }
          return;
        }
        const mudou = substituir(novo);
        // pedido salvo na captura rápida com "salvar e ativar": vale a regra de um ativo por vez
        const id = S.stats && S.stats.cravarPendente;
        if (id) {
          delete S.stats.cravarPendente;
          if (S.jobs.some(j => j.id === id) && window.Trabalhos) window.Trabalhos.ativar(id);
          else await gravar();
          return;
        }
        // mudanças do processo principal (captura, aviso de prazo) não passam
        // pelo saveState daqui, então o envio pra nuvem é agendado aqui
        if (mudou) { try { if (window.agendarEnvio) window.agendarEnvio(); } catch { } }
      });
    }
    buscarCotacao();
    setInterval(buscarCotacao, 5 * 60 * 1000);
    window.addEventListener('online', () => buscarCotacao());
    window.addEventListener('focus', () => { if (Date.now() - ultimaBusca > 5 * 60 * 1000) buscarCotacao(); });
    return S;
  });

  window.Dados = { S, pronto, gravar, gravarQuieto, substituir, normalizar, cotacao, buscarCotacao, noElectron, registro, get fin() { return S.fin; }, get jobs() { return S.jobs; } };
})();
