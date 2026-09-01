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
  if (vazioNuvem && !vazioLocal) return 'local';
  if (!vazioNuvem && vazioLocal) return 'nuvem';
  return tNuvem > tLocal ? 'nuvem' : 'local';
}

async function aoEntrar() {
  mostrarLogin(false);
  modoOffline = false;
  localStorage.removeItem(CHAVE_OFFLINE);
  await sincronizar(true);
  atualizarCardConta();
}

async function sincronizar(primeiraVez) {
  if (!usuario || sincronizando) { pendente = true; return; }
  if (!window.S) { setTimeout(() => sincronizar(primeiraVez), 500); return; } // estado ainda carregando
  sincronizando = true;
  statusSync(t('syncEnviando'));
  try {
    const naNuvem = await baixarDados();
    if (primeiraVez) {
      const lado = maisRecente(S, naNuvem);
      if (lado === 'nuvem') {
        const p = naNuvem.payload;
        S = {
          config: { ...S.config, ...(p.config || {}) },
          jobs: p.jobs || [],
          stats: { ...S.stats, ...(p.stats || {}) }
        };
        await window.api.saveState(S);
        render();
      }
    }
    if (!S.stats.atualizadoEm) S.stats.atualizadoEm = new Date().toISOString();
    await enviarDados(S, navigator.platform || 'PC');
    await salvarPerfilNuvem(S.config.nome, S.config.usuario, null);
    jaSincronizou = true;
    statusSync(t('syncOk'));
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
$$('btnSair').onclick = async () => {
  if (!confirm(t('confirmaSair'))) return;
  await sair();
  jaSincronizou = false;
  atualizarCardConta();
  mostrarLogin(true);
};

// envia pra nuvem sempre que salvar (com respiro de 3s)
let timerEnvio = null;
function agendarEnvio() {
  if (!usuario || modoOffline) return;
  clearTimeout(timerEnvio);
  timerEnvio = setTimeout(() => sincronizar(false), 3000);
}

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
