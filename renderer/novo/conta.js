// Conta, sessão e sincronização com a nuvem (Supabase), mais o aviso de
// atualização e as novidades da versão. Mesmas regras do Crava: o app sempre
// funciona sem internet; a nuvem é um espelho, e quem alterou por último
// ganha (stats.atualizadoEm). Só liga dentro do Electron — no navegador de
// pré-visualização nunca se fala com a conta de ninguém.
(() => {
  const D = window.Dados; const S = D.S; const P = window.Planilha;
  const $ = (id) => document.getElementById(id);
  const CHAVE_OFFLINE = 'crava_modo_offline';
  let modoAba = 'entrar', modoOffline = false, jaSincronizou = false;
  const temNuvem = D.noElectron && typeof iniciarNuvem === 'function' && !!window.supabase;
  const vazio = (e) => !(e?.jobs || []).length && !(e?.fin?.movimentacoes || []).length;

  // ---------- tela de entrar ----------
  function mostrarLogin(mostrar) {
    $('telaLogin').hidden = !mostrar;
    if (mostrar) setTimeout(() => { try { $('loginEmail').focus(); } catch { } }, 60);
  }
  function avisoLogin(texto, tipo) { const el = $('loginAviso'); el.textContent = texto || ''; el.className = 'login-aviso' + (tipo ? ' ' + tipo : ''); }
  function trocarAba(aba) {
    modoAba = aba;
    document.querySelectorAll('.login-aba').forEach(x => { x.classList.toggle('sel', x.dataset.aba === aba); x.setAttribute('aria-selected', String(x.dataset.aba === aba)); });
    document.querySelectorAll('.so-criar').forEach(x => { x.hidden = aba !== 'criar'; });
    document.querySelectorAll('.so-entrar').forEach(x => { x.hidden = aba === 'criar'; });
    $('btnEntrar').textContent = aba === 'criar' ? t('abaCriar') : t('abaEntrar');
    $('loginSenha').autocomplete = aba === 'criar' ? 'new-password' : 'current-password';
    avisoLogin('');
  }
  async function tentarLogin() {
    const btn = $('btnEntrar');
    const email = $('loginEmail').value.trim(), senha = $('loginSenha').value;
    if (!email || !senha) { avisoLogin(t('errCampos'), 'erro'); return; }
    btn.classList.add('carregando'); btn.textContent = t('aguarde');
    try {
      if (modoAba === 'criar') {
        const nome = $('loginNome').value.trim() || email.split('@')[0];
        const user = $('loginUsuario').value.trim().replace('@', '') || email.split('@')[0];
        const r = await cadastrar(email, senha, nome, user);
        if (r.precisaConfirmar) { avisoLogin(t('confirmeEmail'), 'ok'); btn.classList.remove('carregando'); btn.textContent = t('abaCriar'); return; }
        S.config.nome = nome; S.config.usuario = '@' + user;
        await D.gravar();
      } else {
        await entrar(email, senha);
      }
      await aoEntrar();
    } catch (e) {
      avisoLogin(erroAmigavel(e), 'erro');
      btn.classList.remove('carregando'); btn.textContent = modoAba === 'criar' ? t('abaCriar') : t('abaEntrar');
    }
  }

  // ---------- sincronização ----------
  // Compara QUANDO OS DADOS FORAM ALTERADOS (stats.atualizadoEm), não quando
  // a linha foi escrita no servidor. Vazio de instalação nova é diferente de
  // vazio de propósito: o carimbo separa os dois.
  function maisRecente(local, nuvem) {
    const tLocal = local?.stats?.atualizadoEm ? Date.parse(local.stats.atualizadoEm) : 0;
    const tNuvem = nuvem?.payload?.stats?.atualizadoEm ? Date.parse(nuvem.payload.stats.atualizadoEm) : (nuvem?.atualizado_em ? Date.parse(nuvem.atualizado_em) : 0);
    const vazioNuvem = !nuvem?.payload || !Object.keys(nuvem.payload).length || vazio(nuvem.payload);
    const vazioLocal = vazio(local);
    const instalacaoNova = !local?.stats?.atualizadoEm;
    if (vazioNuvem && !vazioLocal) return 'local';
    if (!vazioNuvem && vazioLocal && instalacaoNova) return 'nuvem';
    return tNuvem > tLocal ? 'nuvem' : 'local';
  }
  async function aoEntrar() {
    mostrarLogin(false); modoOffline = false; localStorage.removeItem(CHAVE_OFFLINE);
    await sincronizar(true);
    atualizarCardConta();
  }
  // Estado zerado pra uma conta nova neste PC: aparência fica (é do
  // computador); tudo que identifica alguém ou é trabalho dela, sai.
  function estadoParaContaNova() {
    return {
      config: { ...S.config, nome: 'você', usuario: '', foto: '' },
      jobs: [],
      stats: { historico: {}, notificados: {}, versaoVista: S.stats.versaoVista || '' },
      fin: P.estadoVazio()
    };
  }
  // Traz o estado da nuvem pra cá. Um app antigo (sem planilha) na nuvem não
  // apaga a planilha daqui: o que ele não conhece, ele não pode sobrescrever.
  async function aplicarNuvem(naNuvem) {
    const p = naNuvem.payload || {};
    D.substituir({ config: { ...S.config, ...(p.config || {}) }, jobs: p.jobs || [], stats: { ...S.stats, ...(p.stats || {}) }, fin: p.fin ? p.fin : S.fin });
    S.stats.donoId = usuario.id;
    await D.gravar();
  }
  function nuvemMaisNova(naNuvem) {
    const tNuvem = Date.parse(naNuvem?.payload?.stats?.atualizadoEm || '') || 0;
    const tLocal = Date.parse(S?.stats?.atualizadoEm || '') || 0;
    return tNuvem > tLocal;
  }
  function temTrabalhoNaoEnviado() {
    const alterado = Date.parse(S?.stats?.atualizadoEm || '') || 0;
    const enviado = Date.parse(S?.stats?.enviadoEm || '') || 0;
    return alterado > enviado && !vazio(S);
  }
  async function sincronizar(primeiraVez) {
    if (!usuario || sincronizando) { pendente = true; return; }
    await D.pronto;
    sincronizando = true;
    statusSync(t('syncEnviando'));
    try {
      const naNuvem = await baixarDados();
      let puxou = false;
      const resumo = (e) => `jobs=${(e?.jobs || []).length} mov=${(e?.fin?.movimentacoes || []).length} alterado=${e?.stats?.atualizadoEm || '-'}`;
      const log = (txt) => { try { window.api.syncLog(txt); } catch { } };
      log(`sync(${primeiraVez ? 'login' : 'periodico'}) local[${resumo(S)} enviado=${S?.stats?.enviadoEm || '-'}] nuvem[${naNuvem ? resumo(naNuvem.payload) : 'vazia'}] naoEnviado=${temTrabalhoNaoEnviado()}`);

      // dados de outra conta neste PC não sobem pra conta desta pessoa
      const dono = S?.stats?.donoId;
      if (primeiraVez && dono && dono !== usuario.id) {
        if (naNuvem && naNuvem.payload && Object.keys(naNuvem.payload).length) await aplicarNuvem(naNuvem);
        else { D.substituir(estadoParaContaNova()); S.stats.donoId = usuario.id; await D.gravar(); }
        jaSincronizou = true; statusSync(t('syncOk')); sincronizando = false;
        if (pendente) { pendente = false; setTimeout(() => sincronizar(false), 1200); }
        return;
      }
      if (primeiraVez) {
        if (!temTrabalhoNaoEnviado() && maisRecente(S, naNuvem) === 'nuvem') { await aplicarNuvem(naNuvem); puxou = true; }
      } else if (naNuvem && !temTrabalhoNaoEnviado() && nuvemMaisNova(naNuvem)) {
        await aplicarNuvem(naNuvem); puxou = true; // outro PC gravou depois de nós
      }
      if (puxou) { log('  -> PUXOU da nuvem'); statusSync(t('syncPuxou')); }
      else {
        if (!S.stats.atualizadoEm) S.stats.atualizadoEm = new Date().toISOString();
        if (!S.stats.donoId) S.stats.donoId = usuario.id;
        const carimbo = S.stats.atualizadoEm;
        await enviarDados(S, navigator.platform || 'PC');
        await salvarPerfilNuvem(S.config.nome, S.config.usuario, null);
        S.stats.enviadoEm = carimbo;
        try { await window.api.marcarEnviado(carimbo); } catch { }
        log('  -> enviou o local pra nuvem'); statusSync(t('syncOk'));
      }
      jaSincronizou = true;
    } catch (e) { console.warn('sync falhou:', e); statusSync(t('syncErro')); }
    sincronizando = false;
    if (pendente) { pendente = false; setTimeout(() => sincronizar(false), 1200); }
  }
  function statusSync(texto) {
    const el = $('contaStatus'); if (!el) return;
    if (!usuario) { el.textContent = temNuvem ? t('modoOffline') : 'só neste PC'; return; }
    el.textContent = texto ? `${usuario.email} · ${texto}` : usuario.email;
  }
  function atualizarCardConta() {
    const logado = !!usuario;
    $('contaNome').textContent = logado ? (S.config.nome && S.config.nome !== 'você' ? S.config.nome : usuario.email.split('@')[0]) : 'sem conta';
    $('btnSair').hidden = !logado; $('btnSincronizar').hidden = !logado; $('btnEntrarConfig').hidden = logado || !temNuvem;
    statusSync(logado ? (jaSincronizou ? t('syncOk') : '') : '');
  }
  let timerEnvio = null;
  function agendarEnvio() { if (!usuario || modoOffline) return; clearTimeout(timerEnvio); timerEnvio = setTimeout(() => sincronizar(false), 3000); }
  window.agendarEnvio = agendarEnvio;
  window.addEventListener('estado:trocou', () => { try { atualizarCardConta(); } catch { } });

  // ---------- ligações ----------
  document.querySelectorAll('.login-aba').forEach(el => { el.onclick = () => trocarAba(el.dataset.aba); });
  $('loginForm').onsubmit = (e) => { e.preventDefault(); tentarLogin(); };
  $('btnEsqueci').onclick = async () => {
    const email = $('loginEmail').value.trim();
    if (!email) { avisoLogin(t('errDigiteEmail'), 'erro'); return; }
    try { await recuperarSenha(email); avisoLogin(t('emailEnviado'), 'ok'); } catch (e) { avisoLogin(erroAmigavel(e), 'erro'); }
  };
  $('btnOffline').onclick = () => { modoOffline = true; localStorage.setItem(CHAVE_OFFLINE, '1'); mostrarLogin(false); atualizarCardConta(); };
  $('btnSincronizar').onclick = () => sincronizar(false);
  $('btnEntrarConfig').onclick = () => { mostrarLogin(true); trocarAba('entrar'); };
  let sairArmado = 0;
  $('btnSair').onclick = async () => {
    const btn = $('btnSair');
    if (Date.now() > sairArmado) { // confirma no próprio botão
      sairArmado = Date.now() + 5000; btn.textContent = t('confirmaSair');
      setTimeout(() => { if (Date.now() > sairArmado) btn.textContent = t('btnSair'); }, 5200);
      return;
    }
    sairArmado = 0; btn.textContent = t('btnSair');
    try { await sincronizar(false); } catch { } // sobe o que falta antes de largar a conta
    await sair();
    D.substituir(estadoParaContaNova()); await D.gravar(); // não deixa os dados de quem saiu pra quem entrar depois
    jaSincronizou = false; atualizarCardConta(); mostrarLogin(true); trocarAba('entrar');
    try { window.api.focarJanela(); } catch { }
  };

  // ---------- boot ----------
  (async () => {
    if (!temNuvem || !iniciarNuvem()) { mostrarLogin(false); await D.pronto; atualizarCardConta(); return; }
    // marca a hora de cada alteração e agenda o envio (base da comparação)
    const salvarOriginal = window.api.saveState;
    window.api.saveState = async (estado) => {
      if (estado && estado.stats) estado.stats.atualizadoEm = new Date().toISOString();
      const r = await salvarOriginal(estado);
      agendarEnvio();
      return r;
    };
    await D.pronto;
    await sessaoAtual();
    if (usuario) { mostrarLogin(false); setTimeout(() => sincronizar(true), 600); }
    else if (localStorage.getItem(CHAVE_OFFLINE)) { modoOffline = true; mostrarLogin(false); }
    else { mostrarLogin(true); trocarAba('entrar'); }
    setTimeout(atualizarCardConta, 800);
    window.addEventListener('online', () => sincronizar(false));
    setInterval(() => { if (usuario && !modoOffline) sincronizar(false); }, 5 * 60 * 1000);
  })();

  // ---------- novidades da versão ----------
  // A lista mora no repositório (docs/novidades.json). A cópia de dentro do app
  // descreve a versão instalada; a de fora só traz correções de texto.
  const URL_NOVIDADES = 'https://raw.githubusercontent.com/kauanlacerda/crava/main/docs/novidades.json';
  let novidadesCache = null;
  async function carregarNovidades() {
    if (novidadesCache) return novidadesCache;
    let local = {}, remoto = {};
    try { local = await (await fetch('../../docs/novidades.json')).json(); } catch { }
    try { remoto = await (await fetch(URL_NOVIDADES, { cache: 'no-store' })).json(); } catch { }
    novidadesCache = { ...local, ...remoto };
    return novidadesCache;
  }
  function ordemVersao(a, b) {
    const n = (v) => String(v).replace(/^v/, '').split('.').map(Number);
    const x = n(a), y = n(b);
    for (let i = 0; i < 3; i++) if ((y[i] || 0) !== (x[i] || 0)) return (y[i] || 0) - (x[i] || 0);
    return 0;
  }
  const escHtml = (s) => String(s).replace(/</g, '&lt;');
  const listaHTML = (linhas) => `<ul class="novidades-lista">${linhas.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>`;
  async function mostrarNovidades(versao, historico) {
    const idioma = S.config.idioma === 'en' ? 'en' : 'pt';
    const todas = await carregarNovidades();
    const chave = todas[versao] ? versao : (todas['v' + versao] ? 'v' + versao : null);
    const linhas = chave ? (todas[chave][idioma] || todas[chave].pt || []) : [];
    $('novidadesTitulo').textContent = historico ? t('patchTitulo') : t('novidadesTitulo');
    $('novidadesVersao').textContent = `v${versao} · ${t('novidadesNesta')}`;
    const nota = chave && todas[chave].nota ? (todas[chave].nota[idioma] || todas[chave].nota.pt) : null;
    let html = nota ? `<div class="novidades-nota">${escHtml(nota).replace(/\n/g, '<br>')}</div>` : '';
    html += linhas.length ? listaHTML(linhas) : listaHTML([t('novidadesVazio')]);
    if (historico) {
      for (const v of Object.keys(todas).filter(k => k !== chave).sort(ordemVersao)) {
        const nt = todas[v].nota ? (todas[v].nota[idioma] || todas[v].nota.pt) : null;
        html += `<div class="patch-versao">v${String(v).replace(/^v/, '')}</div>` + (nt ? `<div class="novidades-nota">${escHtml(nt).replace(/\n/g, '<br>')}</div>` : '') + listaHTML(todas[v][idioma] || todas[v].pt || []);
      }
    }
    $('novidadesLista').innerHTML = html;
    $('ovNovidades').hidden = false;
  }
  const fecharNovidades = () => { $('ovNovidades').hidden = true; };
  $('btnNovidadesOk').onclick = fecharNovidades; $('btnNovidadesFechar').onclick = fecharNovidades;
  $('ovNovidades').onclick = (e) => { if (e.target === $('ovNovidades')) fecharNovidades(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ovNovidades').hidden) fecharNovidades(); });
  window.mostrarNovidades = mostrarNovidades;

  // ---------- aviso de atualização ----------
  (() => {
    const faixa = $('faixaUpdate');
    const titulo = $('updateTitulo'), sub = $('updateSub'), btn = $('btnUpdateAgir'), barra = $('updateBarra'), fill = $('updateBarraFill');
    let estado = 'disponivel', versaoNova = '';
    $('btnUpdateNotas').onclick = () => mostrarNovidades(versaoNova);
    $('btnUpdateFechar').onclick = () => { faixa.hidden = true; };
    if (!D.noElectron || !window.api.onUpdate) return;
    window.api.onUpdate((tipo, d) => {
      if (tipo === 'disponivel') { estado = 'disponivel'; versaoNova = d.versao; titulo.textContent = t('updateTitulo'); sub.textContent = `${t('updateVersao')} ${d.versao}`; btn.textContent = t('updateBaixar'); barra.hidden = true; faixa.hidden = false; }
      else if (tipo === 'progresso') { barra.hidden = false; fill.style.width = d.pct + '%'; sub.textContent = `${t('updateBaixando')} ${d.pct}%`; }
      else if (tipo === 'pronto') { estado = 'pronto'; titulo.textContent = t('updatePronto'); sub.textContent = t('updateReinicia'); btn.textContent = t('updateInstalar'); barra.hidden = true; faixa.hidden = false; }
      else if (tipo === 'erro') { sub.textContent = t('updateErro'); }
    });
    btn.onclick = async () => {
      if (estado === 'pronto') { window.api.instalarUpdate(); return; }
      btn.textContent = t('aguarde'); barra.hidden = false; fill.style.width = '0%';
      const ok = await window.api.baixarUpdate();
      if (!ok) { sub.textContent = t('updateErro'); btn.textContent = t('updateBaixar'); }
    };
  })();

  // pra captura no navegador: ?login=1 (&aba=criar) mostra a tela de entrar,
  // ?novidades=1 abre o histórico, ?update=1 mostra a faixa de atualização
  if (!D.noElectron) {
    const q = new URLSearchParams(location.search);
    if (q.get('login') === '1') { mostrarLogin(true); trocarAba(q.get('aba') || 'entrar'); }
    if (q.get('novidades') === '1') mostrarNovidades('1.3.7', true);
    if (q.get('update') === '1') { $('faixaUpdate').hidden = false; $('updateSub').textContent = 'versão 2.0.0'; }
  }

  // versão nas configurações; novidades na primeira abertura de cada versão
  (async () => {
    const el = $('versaoApp'), btnPatch = $('btnVerPatch'), btnChecar = $('btnVerificarUpdate');
    if (!D.noElectron) { el.textContent = 'navegador'; btnPatch.hidden = true; btnChecar.hidden = true; return; }
    let v = '';
    try { v = await window.api.versaoApp(); } catch { return; }
    el.textContent = 'v' + v;
    btnPatch.onclick = () => mostrarNovidades(v, true);
    btnChecar.onclick = async () => {
      const original = btnChecar.textContent; btnChecar.textContent = t('aguarde');
      const achou = await window.api.checarUpdate();
      btnChecar.textContent = original;
      if (!achou) { el.textContent = t('semUpdate'); setTimeout(() => { el.textContent = 'v' + v; }, 4000); }
    };
    await D.pronto;
    // espera a primeira sincronização decidir de onde vêm os dados, pra não
    // carimbar o estado local antes disso
    for (let i = 0; i < 40 && usuario && !jaSincronizou && !modoOffline; i++) await new Promise(r => setTimeout(r, 250));
    if (S.stats.versaoVista === v) return;
    const appZerado = vazio(S);
    S.stats.versaoVista = v;
    try { await D.gravar(); } catch { }
    if (!appZerado) mostrarNovidades(v);
  })();
})();
