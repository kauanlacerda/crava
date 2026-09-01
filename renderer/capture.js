let moeda = 'BRL';
const $ = (id) => document.getElementById(id);

$('cMoedas').onclick = (e) => {
  const m = e.target.dataset.m;
  if (!m) return;
  moeda = m;
  document.querySelectorAll('.m').forEach(x => x.classList.toggle('sel', x.dataset.m === m));
};

function salvar(cravar) {
  const titulo = $('cTitulo').value.trim();
  if (!titulo) { $('cTitulo').focus(); return; }
  window.api.saveCapture({
    cravar: !!cravar,
    id: 'j' + Date.now(),
    titulo,
    cliente: $('cCliente').value.trim(),
    valor: { q: +$('cValor').value || 0, m: moeda },
    prazo: $('cPrazo').value || '',
    status: 'aceito',
    pagamento: $('cPgto').value,
    pagoEm: $('cPgto').value === 'pago' ? new Date().toISOString() : undefined,
    criadoEm: new Date().toISOString()
  });
  limpar();
}
function limpar() {
  ['cTitulo', 'cCliente', 'cValor', 'cPrazo'].forEach(i => $(i).value = '');
  $('cPgto').value = 'nao_pago';
  const cx = $('cPalpites');
  if (cx) { cx.innerHTML = ''; cx.classList.remove('tem'); }
}

$('cSalvar').onclick = () => salvar(false);
$('cCravar').onclick = () => salvar(true);
document.addEventListener('keydown', (e) => {
  // Enter salva na fila; Ctrl+Enter salva e já começa
  if (e.key === 'Enter') salvar(e.ctrlKey);
  if (e.key === 'Escape') { limpar(); window.api.closeCapture(); }
});
window.addEventListener('focus', () => {
  // sugestão da captura anterior não pode sobrar na tela; a nova chega ~600ms
  // depois, pelo IPC
  const cx = $('cPalpites');
  if (cx) { cx.innerHTML = ''; cx.classList.remove('tem'); }
  $('cTitulo').focus();
});

// ============================================================
//  PALPITE — de onde veio o pedido
// ============================================================
// Regra que manda em tudo: nada é preenchido sozinho. O palpite vira uma
// sugestão clicável acima do formulário. Um palpite errado que ninguém nota
// custa semanas (você cobra a pessoa errada); um palpite ignorado custa zero.

// ---------- título da janela ----------
// Devolve o miolo do título do Discord, ou null se a janela em foco não for
// o Discord. Nunca se chuta a partir de um título não reconhecido.
function nucleoDiscord(processo, titulo) {
  let t = String(titulo || '').trim();
  if (!t) return null;
  const proc = String(processo || '').toLowerCase();
  const app = /^discord(ptb|canary|development)?$/.test(proc);
  const nav = /^(chrome|msedge|firefox|brave|opera|vivaldi|thorium|zen)$/.test(proc);
  if (!app && !nav) return null;

  t = t.replace(/^\(\d+\)\s*/, ''); // "(3) " de não lidas

  if (nav) {
    // "@fulano - Discord — Google Chrome"
    const m = t.match(/^(.+?)\s*[-—–]\s*Discord\s*[-—–]\s*[^-—–]+$/i);
    return m ? m[1].trim() : null;
  }
  const m = t.match(/^(.+?)\s*[-—–]\s*Discord$/i);
  return m ? m[1].trim() : null;
}

function palpiteDoTitulo(processo, titulo) {
  const nucleo = nucleoDiscord(processo, titulo);
  if (!nucleo) return {};

  // DM: "@fulano" — é uma pessoa, então vira cliente
  if (nucleo.startsWith('@')) {
    const nome = nucleo.slice(1).trim();
    return nome ? { cliente: nome } : {};
  }

  // Canal de servidor: "#pedidos | Nova Flow". Nem o canal nem o servidor são
  // o cliente — quem pediu é uma pessoa que o título não diz. Vira dica de
  // TÍTULO, que é rótulo (erro barato), e nunca de cliente (erro caro).
  const c = nucleo.match(/^#\s*[^|]+\|\s*(.+)$/);
  if (c) return { servidor: c[1].trim() };

  return {};
}

// ---------- área de transferência ----------
const TIPOS = [
  [/\b(thumb(nail)?s?)\b/i, 'Thumbnail'],
  [/\b(banners?)\b/i, 'Banner'],
  [/\b(logos?|logotipos?)\b/i, 'Logo'],
  [/\b([ií]cones?|icons?|pfps?)\b/i, 'Icon'],
  [/\b(gfx)\b/i, 'GFX'],
  [/\b(renders?|renderiza[çc][ãa]o)\b/i, 'Render'],
  [/\b(avatares?|avatars?)\b/i, 'Avatar'],
  [/\b(vetor(es)?|vectors?)\b/i, 'Vetor'],
  [/\b(overlays?)\b/i, 'Overlay']
];

function numeroBR(s) {
  let x = String(s).toLowerCase().replace(/\s/g, '');
  let mult = 1;
  if (x.endsWith('k')) { mult = 1000; x = x.slice(0, -1); }
  x = x.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = parseFloat(x);
  return isNaN(v) ? null : Math.round(v * mult * 100) / 100;
}

// A ordem importa: robux antes de tudo, e R$ antes de $, senão "R$ 50" casaria
// como dólar por causa do cifrão.
const MOEDAS = [
  ['RBX', /(\d[\d.,]*\s*k?)\s*(?:robux|rbx)\b/i],
  ['RBX', /\b(?:robux|rbx)\s*:?\s*(\d[\d.,]*\s*k?)/i],
  ['BRL', /r\$\s*(\d[\d.,]*\s*k?)/i],
  ['BRL', /(\d[\d.,]*\s*k?)\s*(?:reais|real|brl|conto?s?)\b/i],
  ['USD', /(?:us\$|(?<![a-z])\$)\s*(\d[\d.,]*\s*k?)/i],
  ['USD', /(\d[\d.,]*\s*k?)\s*(?:d[oó]lar(?:es)?|dollars?|usd|bucks)\b/i]
];

const DIAS = { domingo: 0, segunda: 1, terca: 2, 'terça': 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, 'sábado': 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function dataISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function somaDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return dataISO(d); }

function palpiteDePrazo(txt) {
  const t = txt.toLowerCase();
  if (/\b(hoje|today)\b/.test(t)) return somaDias(0);
  if (/(?:^|[^a-zà-ÿ])depois de amanh[ãa](?![a-zà-ÿ])/i.test(t)) return somaDias(2);
  if (/(?:^|[^a-zà-ÿ])(?:amanh[ãa]|tomorrow)(?![a-zà-ÿ])/i.test(t)) return somaDias(1);
  if (/\b(semana que vem|pr[óo]xima semana|next week)\b/.test(t)) return somaDias(7);

  // "até sexta", "sexta-feira", "by friday"
  const md = t.match(/\b(?:at[ée]|by|para|pra|no|na)?\s*(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:-?feira)?\b/);
  if (md) {
    const alvo = DIAS[md[1]];
    if (alvo !== undefined) {
      const hoje = new Date();
      let dif = (alvo - hoje.getDay() + 7) % 7;
      if (dif === 0) dif = 7; // "sexta" numa sexta = a próxima
      return somaDias(dif);
    }
  }
  // "essa semana" → sexta desta semana
  if (/\b(essa semana|esta semana|this week)\b/.test(t)) {
    const hoje = new Date();
    const dif = (5 - hoje.getDay() + 7) % 7;
    return somaDias(dif || 0);
  }
  // "dia 15"
  const mdia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (mdia) {
    const n = +mdia[1];
    if (n >= 1 && n <= 31) {
      const hoje = new Date();
      let d = new Date(hoje.getFullYear(), hoje.getMonth(), n);
      if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, n);
      return dataISO(d);
    }
  }
  return null;
}

function palpiteDoTexto(texto) {
  const t = String(texto || '');
  // texto grande demais não é mensagem de pedido; ignora calado
  if (!t.trim() || t.length > 2000) return {};
  const out = {};

  for (const [moeda, re] of MOEDAS) {
    const m = t.match(re);
    if (m) {
      const v = numeroBR(m[1]);
      if (v && v > 0) { out.valor = v; out.moeda = moeda; break; }
    }
  }
  const prazo = palpiteDePrazo(t);
  if (prazo) out.prazo = prazo;
  for (const [re, nome] of TIPOS) { if (re.test(t)) { out.tipo = nome; break; } }
  return out;
}


// ---------- as sugestões na tela ----------
// Nada entra num campo sem um clique. Um palpite errado ignorado custa zero;
// um palpite errado preenchido em silêncio custa semanas (cobrança errada).
const MOEDA_ROTULO = { BRL: 'R$', USD: 'US$', RBX: 'Robux' };

function fmtPrazoCurto(iso) {
  const [a, m, d] = iso.split('-');
  return d + '/' + m;
}

function aplicarPalpite(campo, valor, moeda) {
  if (campo === 'cliente') $('cCliente').value = valor;
  if (campo === 'titulo') $('cTitulo').value = valor;
  if (campo === 'prazo') $('cPrazo').value = valor;
  if (campo === 'valor') {
    $('cValor').value = valor;
    // clicar no botão da moeda é o caminho certo: o handler de #cMoedas é
    // quem mantém a variável interna e o destaque visual em dia
    if (moeda) $('cMoedas').querySelector('[data-m="' + moeda + '"]')?.click();
  }
}

function mostrarPalpites(ctx) {
  const caixa = $('cPalpites');
  caixa.innerHTML = '';
  caixa.classList.remove('tem');
  if (!ctx) return;

  const doTitulo = palpiteDoTitulo(ctx.processo, ctx.titulo);
  const doTexto = palpiteDoTexto(ctx.clipboard);
  const itens = [];

  if (doTitulo.cliente) itens.push({ campo: 'cliente', valor: doTitulo.cliente, fonte: 'Discord', rotulo: '@' + doTitulo.cliente });

  // título: tipo do trabalho e/ou o servidor de onde veio
  const partes = [];
  if (doTexto.tipo) partes.push(doTexto.tipo);
  if (doTitulo.servidor) partes.push(doTitulo.servidor);
  if (partes.length) {
    const txt = partes.join(' — ');
    itens.push({ campo: 'titulo', valor: txt, fonte: doTitulo.servidor ? 'Discord' : 'msg', rotulo: txt });
  }

  if (doTexto.valor) {
    const r = doTexto.moeda === 'RBX' ? doTexto.valor + ' Robux' : MOEDA_ROTULO[doTexto.moeda] + ' ' + doTexto.valor;
    itens.push({ campo: 'valor', valor: doTexto.valor, moeda: doTexto.moeda, fonte: 'msg', rotulo: r });
  }
  if (doTexto.prazo) itens.push({ campo: 'prazo', valor: doTexto.prazo, fonte: 'msg', rotulo: fmtPrazoCurto(doTexto.prazo) });

  if (!itens.length) return;

  for (const it of itens) {
    const el = document.createElement('div');
    el.className = 'palpite';
    el.innerHTML = '<span class="fonte">' + it.fonte + '</span>' + it.rotulo.replace(/</g, '&lt;');
    el.title = 'clique pra usar';
    el.onclick = () => { aplicarPalpite(it.campo, it.valor, it.moeda); el.remove(); if (!caixa.children.length) caixa.classList.remove('tem'); };
    caixa.appendChild(el);
  }
  if (itens.length > 1) {
    const tudo = document.createElement('div');
    tudo.className = 'palpite tudo';
    tudo.innerHTML = '<span class="fonte">usar</span>tudo';
    tudo.onclick = () => { for (const it of itens) aplicarPalpite(it.campo, it.valor, it.moeda); caixa.innerHTML = ''; caixa.classList.remove('tem'); };
    caixa.appendChild(tudo);
  }
  caixa.classList.add('tem');
}

if (window.api.onContextoCaptura) window.api.onContextoCaptura(mostrarPalpites);
