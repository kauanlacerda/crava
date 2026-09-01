// Crava — tela de login, sessão e sincronização com a nuvem
let modoAba = 'entrar';
let modoOffline = false;
let jaSincronizou = false;

const $$ = (id) => document.getElementById(id);
const CHAVE_OFFLINE = 'crava_modo_offline';

// ---------- tela ----------
function mostrarLogin(mostrar) {
  $$('telaLogin').style.display = mostrar ? 'flex' : 'none';
  document.querySelector('.app').style.visibility = mostrar ? 'hidden' : 'visible';
}
function avisoLogin(texto, tipo) {
  const el = $$('loginAviso');
  el.textContent = texto || '';
  el.className = 'login-aviso' + (tipo ? ' ' + tipo : '');
}
function trocarAba(aba) {
  modoAba = aba;
  document.querySelectorAll('.login-aba').forEach(x => x.classList.toggle('sel', x.dataset.aba === aba));
  document.querySelectorAll('.so-criar').forEach(x => x.style.display = aba === 'criar' ? '' : 'none');
  document.querySelectorAll('.so-entrar').forEach(x => x.style.display = aba === 'criar' ? 'none' : '');
  $$('btnEntrar').textContent = aba === 'criar' ? t('abaCriar') : t('abaEntrar');
  $$('loginSenha').autocomplete = aba === 'criar' ? 'new-password' : 'current-password';
  avisoLogin('');
}
document.querySelectorAll('.login-aba').forEach(el => { el.onclick = () => trocarAba(el.dataset.aba); });

// ---------- entrar / cadastrar ----------
async function tentarLogin() {
  const btn = $$('btnEntrar');
  const email = $$('loginEmail').value.trim();
  const senha = $$('loginSenha').value;
  if (!email || !senha) { avisoLogin(t('errCampos'), 'erro'); return; }

  btn.classList.add('carregando');
  btn.textContent = t('aguarde');
  try {
    if (modoAba === 'criar') {
      const nome = $$('loginNome').value.trim() || email.split('@')[0];
      const user = $$('loginUsuario').value.trim().replace('@', '') || email.split('@')[0];
      const r = await cadastrar(email, senha, nome, user);
      if (r.precisaConfirmar) {
        avisoLogin(t('confirmeEmail'), 'ok');
        btn.classList.remove('carregando');
        btn.textContent = t('abaCriar');
        return;
      }
      S.config.nome = nome;
      S.config.usuario = '@' + user;
      await window.api.saveState(S);
    } else {
      await entrar(email, senha);
    }
    await aoEntrar();
  } catch (e) {
    avisoLogin(erroAmigavel(e), 'erro');
    btn.classList.remove('carregando');
    btn.textContent = modoAba === 'criar' ? t('abaCriar') : t('abaEntrar');
  }
}
$$('btnEntrar').onclick = tentarLogin;
$$('loginSenha').onkeydown = (e) => { if (e.key === 'Enter') tentarLogin(); };
$$('loginEmail').onkeydown = (e) => { if (e.key === 'Enter') tentarLogin(); };

$$('btnEsqueci').onclick = async () => {
  const email = $$('loginEmail').value.trim();
  if (!email) { avisoLogin(t('errDigiteEmail'), 'erro'); return; }
  try { await recuperarSenha(email); avisoLogin(t('emailEnviado'), 'ok'); }
  catch (e) { avisoLogin(erroAmigavel(e), 'erro'); }
};

$$('btnOffline').onclick = () => {
  modoOffline = true;
  localStorage.setItem(CHAVE_OFFLINE, '1');
  mostrarLogin(false);
  atualizarCardConta();
};

// ---------- sincronização ----------
function maisRecente(local, nuvem) {
  // decide qual estado vale: compara a última alteração conhecida
  const tLocal = local?.stats?.atualizadoEm ? Date.parse(local.stats.atualizadoEm) : 0;
  const tNuvem = nuvem?.atualizado_em ? Date.parse(nuvem.atualizado_em) : 0;
  const vazioNuvem = !nuvem?.payload || !Object.keys(nuvem.payload).length || !(nuvem.payload.jobs || []).length;
  const vazioLocal = !(local?.jobs || []).length;
  // vazio porque nunca foi usado (instalação nova) é diferente de vazio de
  // propósito (o usuário zerou). O carimbo de hora separa os dois casos.
  const instalacaoNova = !local?.stats?.atualizadoEm;
  if (vazioNuvem && !vazioLocal) return 'local';
  if (!vazioNuvem && vazioLocal && instalacaoNova) return 'nuvem';
  return tNuvem > tLocal ? 'nuvem' : 'local';
}

async function aoEntrar() {
  mostrarLogin(false);
  modoOffline = false;
  localStorage.removeItem(CHAVE_OFFLINE);
  await sincronizar(true);
  atualizarCardConta();
}

// Estado zerado pra uma conta nova neste PC. Preferências de aparência ficam
// (são do computador); tudo que identifica alguém ou é trabalho dela, sai.
function estadoParaContaNova() {
  return {
    config: {
      ...S.config,
      nome: 'você', usuario: '', foto: '', insigniaFavorita: '',
      shareMidia: '', calMidia: ''
    },
    jobs: [],
    stats: {
      streak: 0, maxStreak: 0, ultimoDiaMeta: '', recompensaMostrada: '',
      historico: {}, cofres: [], cofreRetiradas: [], notificados: {},
      insigniasGanhas: {}, versaoVista: S.stats.versaoVista || ''
    }
  };
}

// Traz o estado da nuvem pra cá.
async function aplicarNuvem(naNuvem) {
  const p = naNuvem.payload;
  S = {
    config: { ...S.config, ...(p.config || {}) },
    jobs: p.jobs || [],
    stats: { ...S.stats, ...(p.stats || {}) }
  };
  S.stats.donoId = usuario.id;
  await window.api.saveState(S);
  render();
}

// Quem escreveu na nuvem carimbou stats.atualizadoEm junto. Comparar com o
// NOSSO carimbo diz se outro PC mexeu depois da última vez que gravamos aqui.
// De propósito não uso a coluna atualizado_em do servidor: ela vem do relógio
// do banco, e se o relógio deste PC estiver atrasado a nuvem pareceria sempre
// mais nova — o app ficaria puxando por cima do que você acabou de fazer.
function nuvemMaisNova(naNuvem) {
  const tNuvem = Date.parse(naNuvem?.payload?.stats?.atualizadoEm || '') || 0;
  const tLocal = Date.parse(S?.stats?.atualizadoEm || '') || 0;
  return tNuvem > tLocal;
}

// Tem coisa feita neste PC que a nuvem ainda não viu? Comparar datas já cobre
// o caso normal, mas isto é a rede de segurança: se algo foi salvo depois do
// último envio bem-sucedido, esse trabalho não pode ser descartado por nada.
function temTrabalhoNaoEnviado() {
  const alterado = Date.parse(S?.stats?.atualizadoEm || '') || 0;
  const enviado = Date.parse(S?.stats?.enviadoEm || '') || 0;
  return alterado > enviado && (S?.jobs || []).length > 0;
}

async function sincronizar(primeiraVez) {
  if (!usuario || sincronizando) { pendente = true; return; }
  if (!window.S) { setTimeout(() => sincronizar(primeiraVez), 500); return; } // estado ainda carregando
  sincronizando = true;
  statusSync(t('syncEnviando'));
  try {
    const naNuvem = await baixarDados();
    let puxou = false;

    // Os dados guardados neste PC são de outra conta? Então não são desta
    // pessoa e não podem subir pra nuvem dela. Sem isso, criar uma conta nova
    // num PC emprestado copiava os trabalhos do dono anterior pra dentro dela.
    const dono = S?.stats?.donoId;
    if (primeiraVez && dono && dono !== usuario.id) {
      if (naNuvem && naNuvem.payload && Object.keys(naNuvem.payload).length) {
        await aplicarNuvem(naNuvem);
      } else {
        S = estadoParaContaNova();
        S.stats.donoId = usuario.id;
        await window.api.saveState(S);
        render();
      }
      jaSincronizou = true;
      statusSync(t('syncOk'));
      sincronizando = false;
      if (pendente) { pendente = false; setTimeout(() => sincronizar(false), 1200); }
      return;
    }

    if (primeiraVez && !window.ZERANDO) {
      if (!temTrabalhoNaoEnviado() && maisRecente(S, naNuvem) === 'nuvem') {
        await aplicarNuvem(naNuvem);
        puxou = true;
      }
    } else if (naNuvem && !window.ZERANDO && !temTrabalhoNaoEnviado() && nuvemMaisNova(naNuvem)) {
      // outro PC gravou depois de nós: puxa em vez de sobrescrever o trabalho dele
      await aplicarNuvem(naNuvem);
      puxou = true;
    }

    if (puxou) {
      statusSync(t('syncPuxou'));
    } else {
      if (!S.stats.atualizadoEm) S.stats.atualizadoEm = new Date().toISOString();
      if (!S.stats.donoId) S.stats.donoId = usuario.id;
      const carimbo = S.stats.atualizadoEm;
      await enviarDados(S, navigator.platform || 'PC');
      await salvarPerfilNuvem(S.config.nome, S.config.usuario, null);
      // só depois de subir de verdade: daqui pra trás está a salvo na nuvem
      S.stats.enviadoEm = carimbo;
      try { await window.api.marcarEnviado(carimbo); } catch { }
      statusSync(t('syncOk'));
    }
    jaSincronizou = true;
  } catch (e) {
    console.warn('sync falhou:', e);
    statusSync(t('syncErro'));
  }
  sincronizando = false;
  if (pendente) { pendente = false; setTimeout(() => sincronizar(false), 1200); }
}

function statusSync(texto) {
  const el = $$('contaStatus');
  if (!el) return;
  const base = usuario ? usuario.email : t('semConta');
  el.textContent = texto ? `${base} · ${texto}` : base;
}

function atualizarCardConta() {
  const logado = !!usuario;
  $$('btnSair').style.display = logado ? '' : 'none';
  $$('btnSincronizar').style.display = logado ? '' : 'none';
  $$('btnEntrarConfig').style.display = logado ? 'none' : '';
  statusSync(logado ? (jaSincronizou ? t('syncOk') : '') : '');
  if (!logado) $$('contaStatus').textContent = t('modoOffline');
}

$$('btnSincronizar').onclick = () => sincronizar(false);
$$('btnEntrarConfig').onclick = () => { mostrarLogin(true); trocarAba('entrar'); };
let sairArmado = 0;
$$('btnSair').onclick = async () => {
  const btn = $$('btnSair');
  if (Date.now() > sairArmado) {          // confirma no próprio botão, sem diálogo do sistema
    sairArmado = Date.now() + 5000;
    btn.textContent = t('confirmaSair');
    setTimeout(() => { if (Date.now() > sairArmado) btn.textContent = t('btnSair'); }, 5200);
    return;
  }
  sairArmado = 0;
  btn.textContent = t('btnSair');
  // sobe o que ainda não subiu antes de largar a conta
  try { await sincronizar(false); } catch { }
  await sair();
  // e não deixa os dados de quem saiu para quem entrar depois
  S = estadoParaContaNova();
  await window.api.saveState(S);
  render();
  jaSincronizou = false;
  atualizarCardConta();
  mostrarLogin(true);
  // devolve o teclado pra tela de login
  try { window.api.focarJanela(); } catch { }
  setTimeout(() => { try { $$('loginEmail').focus(); } catch { } }, 60);
};

// envia pra nuvem sempre que salvar (com respiro de 3s)
let timerEnvio = null;
function agendarEnvio() {
  if (!usuario || modoOffline) return;
  clearTimeout(timerEnvio);
  timerEnvio = setTimeout(() => sincronizar(false), 3000);
}
window.agendarEnvio = agendarEnvio;

// ---------- boot ----------
(async () => {
  const ok = iniciarNuvem();
  if (!ok) { mostrarLogin(false); return; }

  // marca a hora de cada alteração local (base da comparação)
  const salvarOriginal = window.api.saveState;
  window.api.saveState = async (estado) => {
    if (estado && estado.stats) estado.stats.atualizadoEm = new Date().toISOString();
    const r = await salvarOriginal(estado);
    agendarEnvio();
    return r;
  };

  await sessaoAtual();
  if (usuario) {
    mostrarLogin(false);
    setTimeout(() => sincronizar(true), 600);
  } else if (localStorage.getItem(CHAVE_OFFLINE)) {
    modoOffline = true;
    mostrarLogin(false);
  } else {
    mostrarLogin(true);
    trocarAba('entrar');
  }
  setTimeout(atualizarCardConta, 800);

  // sincroniza ao voltar a internet e a cada 5 min
  window.addEventListener('online', () => sincronizar(false));
  setInterval(() => { if (usuario && !modoOffline) sincronizar(false); }, 5 * 60 * 1000);
})();

// ---------- novidades da versão ----------
// A lista de mudanças mora no repositório (docs/novidades.json), então dá pra
// escrever as notas de cada versão sem mexer no código do app.
const URL_NOVIDADES = 'https://raw.githubusercontent.com/kauanlacerda/crava/main/docs/novidades.json';
let novidadesCache = null;

async function carregarNovidades() {
  if (novidadesCache) return novidadesCache;
  try {
    const r = await fetch(URL_NOVIDADES, { cache: 'no-store' });
    novidadesCache = await r.json();
  } catch { novidadesCache = {}; }
  return novidadesCache;
}

async function mostrarNovidades(versao) {
  const ov = document.getElementById('ovNovidades');
  if (!ov) return;
  const idioma = (window.S && window.S.config && window.S.config.idioma) === 'en' ? 'en' : 'pt';
  const todas = await carregarNovidades();
  const item = todas[versao] || todas['v' + versao] || null;
  const linhas = item ? (item[idioma] || item.pt || []) : [];

  document.getElementById('novidadesTitulo').textContent = t('novidadesTitulo');
  document.getElementById('novidadesVersao').textContent = `v${versao} · ${t('novidadesNesta')}`;
  document.getElementById('novidadesLista').innerHTML = linhas.length
    ? linhas.map(l => `<li>${String(l).replace(/</g, '&lt;')}</li>`).join('')
    : `<li>${t('novidadesVazio')}</li>`;
  try { document.getElementById('novidadesMascote').src = spr('metaModal'); } catch { }
  ov.classList.add('open');
}

(() => {
  const ov = document.getElementById('ovNovidades');
  if (!ov) return;
  document.getElementById('btnNovidadesOk').onclick = () => ov.classList.remove('open');
  ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('open'); };
})();

// ---------- aviso de atualização ----------
(() => {
  const faixa = document.getElementById('faixaUpdate');
  if (!faixa || !window.api.onUpdate) return;
  const titulo = document.getElementById('updateTitulo');
  const sub = document.getElementById('updateSub');
  const btn = document.getElementById('btnUpdateAgir');
  const barra = document.getElementById('updateBarra');
  const fill = document.getElementById('updateBarraFill');
  let estado = 'disponivel';

  let versaoNova = '';
  const btnNotas = document.getElementById('btnUpdateNotas');
  if (btnNotas) btnNotas.onclick = () => mostrarNovidades(versaoNova);
  const mostrar = () => faixa.classList.add('aberta');
  document.getElementById('btnUpdateFechar').onclick = () => faixa.classList.remove('aberta');

  window.api.onUpdate((tipo, d) => {
    if (tipo === 'disponivel') {
      estado = 'disponivel';
      versaoNova = d.versao;
      titulo.textContent = t('updateTitulo');
      sub.textContent = `${t('updateVersao')} ${d.versao}`;
      btn.textContent = t('updateBaixar');
      barra.style.display = 'none';
      mostrar();
    } else if (tipo === 'progresso') {
      barra.style.display = '';
      fill.style.width = d.pct + '%';
      sub.textContent = `${t('updateBaixando')} ${d.pct}%`;
    } else if (tipo === 'pronto') {
      estado = 'pronto';
      titulo.textContent = t('updatePronto');
      sub.textContent = t('updateReinicia');
      btn.textContent = t('updateInstalar');
      barra.style.display = 'none';
      mostrar();
    } else if (tipo === 'erro') {
      sub.textContent = t('updateErro');
    }
  });

  btn.onclick = async () => {
    if (estado === 'pronto') { window.api.instalarUpdate(); return; }
    btn.textContent = t('aguarde');
    barra.style.display = '';
    fill.style.width = '0%';
    const ok = await window.api.baixarUpdate();
    if (!ok) { sub.textContent = t('updateErro'); btn.textContent = t('updateBaixar'); }
  };

  // mascote da faixa acompanha a cor escolhida
  const tentarMascote = () => {
    try {
      const img = document.getElementById('updateMascote');
      if (window.S && img) img.src = spr('metaModal');
    } catch { }
  };
  setTimeout(tentarMascote, 1500);

  // mostra a versão nas configurações e abre as novidades na primeira vez
  window.api.versaoApp().then(async (v) => {
    const el = document.getElementById('versaoApp');
    if (el) el.textContent = 'v' + v;
    if (el) el.onclick = () => mostrarNovidades(v);
    await new Promise(r => setTimeout(r, 2500)); // deixa o app carregar o estado
    if (!window.S || !window.S.stats) return;
    if (window.S.stats.versaoVista === v) return;
    // instalação zerada não precisa do aviso; quem já usava, sim
    const appZerado = !(window.S.jobs || []).length
      && !Object.keys(window.S.stats.historico || {}).length;
    window.S.stats.versaoVista = v;
    try { await window.api.saveState(window.S); } catch { }
    if (!appZerado) mostrarNovidades(v);
  }).catch(() => { });
})();

// botão de verificar atualizações nas configurações
(() => {
  const b = document.getElementById('btnVerificarUpdate');
  if (!b || !window.api.checarUpdate) return;
  b.onclick = async () => {
    const original = b.textContent;
    b.textContent = t('aguarde');
    const achou = await window.api.checarUpdate();
    b.textContent = original;
    if (!achou) {
      const el = document.getElementById('versaoApp');
      if (el) {
        const v = el.textContent;
        el.textContent = t('semUpdate');
        setTimeout(() => { el.textContent = v; }, 4000);
      }
    }
  };
})();
