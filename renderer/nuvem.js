// Crava — conta e sincronização (Supabase)
// Regras: o app SEMPRE funciona offline; a nuvem é um espelho.
const SUPA_URL = 'https://qyimvifnbuihmdvkcosd.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aW12aWZuYnVpaG1kdmtjb3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjY2OTMsImV4cCI6MjEwMzg0MjY5M30.BKw9iPrmfJhQviQsgBG8a4DzipWl1LfL2p5Q83Y-q5s';

let sb = null;          // cliente supabase
let usuario = null;     // usuário logado (ou null)
let sincronizando = false;
let pendente = false;   // mudou algo enquanto sincronizava
let ultimoEnvio = 0;

function iniciarNuvem() {
  try {
    sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
    });
    return true;
  } catch (e) {
    console.error('nuvem indisponível:', e);
    return false;
  }
}

// ---------- sessão ----------
async function sessaoAtual() {
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    usuario = data?.session?.user || null;
    return usuario;
  } catch { return null; }
}

async function entrar(email, senha) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw error;
  usuario = data.user;
  return usuario;
}

async function cadastrar(email, senha, nome, nomeUsuario) {
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome, usuario: nomeUsuario } }
  });
  if (error) throw error;
  usuario = data.user;
  return { usuario, precisaConfirmar: !data.session };
}

async function recuperarSenha(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

async function sair() {
  try { await sb.auth.signOut(); } catch { }
  usuario = null;
}

// ---------- dados ----------
async function baixarDados() {
  if (!sb || !usuario) return null;
  const { data, error } = await sb
    .from('dados')
    .select('payload, atualizado_em')
    .eq('user_id', usuario.id)
    .maybeSingle();
  if (error) { console.warn('erro ao baixar:', error.message); return null; }
  return data || null;
}

async function enviarDados(estado, dispositivo) {
  if (!sb || !usuario) return false;
  const { error } = await sb.from('dados').upsert({
    user_id: usuario.id,
    payload: estado,
    atualizado_em: new Date().toISOString(),
    dispositivo: dispositivo || 'desconhecido'
  }, { onConflict: 'user_id' });
  if (error) { console.warn('erro ao enviar:', error.message); return false; }
  ultimoEnvio = Date.now();
  return true;
}

async function salvarPerfilNuvem(nome, nomeUsuario, fotoUrl) {
  if (!sb || !usuario) return false;
  const linha = { id: usuario.id, nome, atualizado_em: new Date().toISOString() };
  if (nomeUsuario) linha.usuario = nomeUsuario.replace('@', '');
  if (fotoUrl) linha.foto_url = fotoUrl;
  const { error } = await sb.from('perfis').upsert(linha, { onConflict: 'id' });
  if (error) { console.warn('erro no perfil:', error.message); return false; }
  return true;
}

// mensagens de erro em português
function erroAmigavel(e) {
  const m = String(e?.message || e || '').toLowerCase();
  if (m.includes('invalid login')) return t('errSenha');
  if (m.includes('already registered') || m.includes('already been registered')) return t('errEmailUsado');
  if (m.includes('password should be')) return t('errSenhaCurta');
  if (m.includes('unable to validate email') || m.includes('invalid email')) return t('errEmailInvalido');
  if (m.includes('email not confirmed')) return t('errNaoConfirmado');
  if (m.includes('fetch') || m.includes('network')) return t('errRede');
  if (m.includes('rate limit') || m.includes('too many')) return t('errMuitasTentativas');
  return e?.message || t('errGenerico');
}
