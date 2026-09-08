// Casca do app novo: barra lateral, tema, painel de personalização e os
// gráficos de exemplo do dashboard. Sem framework. Preferências em
// localStorage por enquanto; no app de verdade vão pra S.config.
(() => {
  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;

  // ---------- matizes do Tailwind (500 no escuro, 600 no claro) ----------
  const MATIZES = {
    padrao: null,
    red: ['#ef4444', '#dc2626'], orange: ['#f97316', '#ea580c'], amber: ['#f59e0b', '#d97706'], yellow: ['#eab308', '#ca8a04'],
    lime: ['#84cc16', '#65a30d'], green: ['#22c55e', '#16a34a'], emerald: ['#10b981', '#059669'], teal: ['#14b8a6', '#0d9488'],
    cyan: ['#06b6d4', '#0891b2'], sky: ['#0ea5e9', '#0284c7'], blue: ['#3b82f6', '#2563eb'], indigo: ['#6366f1', '#4f46e5'],
    violet: ['#8b5cf6', '#7c3aed'], purple: ['#a855f7', '#9333ea'], fuchsia: ['#d946ef', '#c026d3'], pink: ['#ec4899', '#db2777'],
    rose: ['#f43f5e', '#e11d48']
  };
  const NOMES = {
    padrao: 'Padrão', red: 'Vermelho', orange: 'Laranja', amber: 'Âmbar', yellow: 'Amarelo', lime: 'Lima', green: 'Verde',
    emerald: 'Esmeralda', teal: 'Petróleo', cyan: 'Ciano', sky: 'Céu', blue: 'Azul', indigo: 'Índigo', violet: 'Violeta',
    purple: 'Roxo', fuchsia: 'Fúcsia', pink: 'Rosa', rose: 'Rosé'
  };
  // 5 tons de um matiz pros gráficos: clareia/escurece o hex
  const mistura = (hex, alvo, p) => {
    const a = hex.match(/\w\w/g).map(h => parseInt(h, 16)), b = alvo.match(/\w\w/g).map(h => parseInt(h, 16));
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * p).toString(16).padStart(2, '0')).join('');
  };

  const PADRAO = { cor: 'padrao', corGrafico: 'padrao', fonte: 'DM Sans', fonteDisplay: '', escala: '1', raio: '10', tema: 'dark', layout: 'full', sidebar: 'expanded', variant: 'inset', zoom: {} };
  let pref = { ...PADRAO };
  try { pref = { ...PADRAO, ...JSON.parse(localStorage.getItem('pref-casca') || '{}') }; } catch { }

  function aplicar() {
    raiz.dataset.theme = pref.tema;
    raiz.dataset.layout = pref.layout;
    raiz.dataset.sidebar = pref.sidebar;
    raiz.dataset.variant = pref.variant;
    raiz.style.setProperty('--escala', pref.escala);
    raiz.style.setProperty('--raio', pref.raio + 'px');
    raiz.style.setProperty('--fonte', `'${pref.fonte}', 'Segoe UI', system-ui, sans-serif`);
    raiz.style.setProperty('--fonte-display', pref.fonteDisplay ? `'${pref.fonteDisplay}', sans-serif` : 'var(--fonte)');
    const escuro = pref.tema === 'dark';
    // cor do tema: o botão primário e o anel de foco
    const m = MATIZES[pref.cor];
    if (m) {
      raiz.style.setProperty('--primario', m[escuro ? 0 : 1]);
      raiz.style.setProperty('--primario-texto', '#ffffff');
      raiz.style.setProperty('--anel', m[0]);
    } else { ['--primario', '--primario-texto', '--anel'].forEach(p => raiz.style.removeProperty(p)); }
    // cor dos gráficos: 5 tons do matiz
    const g = MATIZES[pref.corGrafico];
    if (g) {
      const base = g[0];
      const tons = escuro
        ? [mistura(base, '#ffffff', .25), base, mistura(base, '#000000', .25), mistura(base, '#000000', .45), mistura(base, '#000000', .62)]
        : [mistura(base, '#000000', .25), base, mistura(base, '#ffffff', .3), mistura(base, '#ffffff', .55), mistura(base, '#ffffff', .75)];
      tons.forEach((t, i) => raiz.style.setProperty('--chart-' + (i + 1), t));
    } else { for (let i = 1; i <= 5; i++) raiz.style.removeProperty('--chart-' + i); }
    // estado dos controles
    $('optCor').value = pref.cor; $('optCorGrafico').value = pref.corGrafico;
    $('optFonte').value = pref.fonte; $('optFonteDisplay').value = pref.fonteDisplay;
    document.querySelectorAll('.seg').forEach(seg => {
      const k = seg.dataset.opt;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === String(pref[k])));
    });
    $('btnSidebar').setAttribute('aria-expanded', String(pref.sidebar === 'expanded'));
    try { localStorage.setItem('pref-casca', JSON.stringify(pref)); } catch { }
  }

  // ---------- controles ----------
  for (const id of ['optCor', 'optCorGrafico']) {
    const sel = $(id);
    for (const k of Object.keys(MATIZES)) { const o = document.createElement('option'); o.value = k; o.textContent = NOMES[k]; sel.appendChild(o); }
  }
  $('optCor').onchange = e => { pref.cor = e.target.value; aplicar(); };
  $('optCorGrafico').onchange = e => { pref.corGrafico = e.target.value; aplicar(); desenharGraficos(); };
  $('optFonte').onchange = e => { pref.fonte = e.target.value; aplicar(); };
  $('optFonteDisplay').onchange = e => { pref.fonteDisplay = e.target.value; aplicar(); };
  document.querySelectorAll('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      pref[seg.dataset.opt] = b.dataset.v; aplicar(); desenharGraficos();
    });
  });
  $('btnRestaurar').onclick = () => { pref = { ...PADRAO }; aplicar(); desenharGraficos(); };
  $('btnTema').onclick = () => { pref.tema = pref.tema === 'dark' ? 'light' : 'dark'; aplicar(); desenharGraficos(); };
  $('btnSidebar').onclick = () => { pref.sidebar = pref.sidebar === 'expanded' ? 'icon' : 'expanded'; aplicar(); };

  // painel de personalização
  const abrirFolha = (aberto) => {
    $('folhaPersonalizar').hidden = !aberto; $('veuPersonalizar').hidden = !aberto;
    if (aberto) $('btnFecharFolha').focus(); else $('btnPersonalizar').focus();
  };
  $('btnPersonalizar').onclick = () => abrirFolha(true);
  $('btnFecharFolha').onclick = () => abrirFolha(false);
  $('veuPersonalizar').onclick = () => abrirFolha(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('folhaPersonalizar').hidden) abrirFolha(false); });

  // ---------- barra lateral ----------
  document.querySelectorAll('[data-toggle]').forEach(b => {
    b.onclick = () => {
      const li = $(b.dataset.toggle); const aberto = li.classList.toggle('aberto');
      b.setAttribute('aria-expanded', String(aberto));
    };
  });
  const TITULOS = { dashboard: 'Dashboard', trabalhos: 'Trabalhos', saldos: 'Planilha · Saldos', totais: 'Planilha · Totais', tags: 'Planilha · Tags', cartoes: 'Planilha · Cartões', previsao: 'Planilha · Previsão de diário', horizonte: 'Planilha · Horizonte', economia: 'Economia', config: 'Configurações' };
  document.querySelectorAll('[data-view]').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('[data-view]').forEach(x => { x.classList.remove('ativo'); x.removeAttribute('aria-current'); });
      b.classList.add('ativo'); b.setAttribute('aria-current', 'page');
      $('topoTitulo').textContent = TITULOS[b.dataset.view] || b.textContent.trim();
      document.title = TITULOS[b.dataset.view] || 'App';
      mostrarView(b.dataset.view);
    };
  });

  // ---------- zoom por aba ----------
  // Cada tela guarda o próprio tamanho: a planilha costuma ser usada menor,
  // pra caber mais meses e dias na vista; o dashboard, no tamanho normal.
  let viewAtual = 'dashboard';
  const ZOOM_MIN = 0.6, ZOOM_MAX = 1.4;
  function aplicarZoom() {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(pref.zoom || {})[viewAtual] || 1));
    document.querySelectorAll('.view').forEach(v => { v.style.zoom = v.id === 'view-' + viewAtual ? String(z) : ''; });
    $('zoomValor').value = Math.round(z * 100) + '%';
  }
  function mudarZoom(delta) {
    const z = +(pref.zoom || {})[viewAtual] || 1;
    pref.zoom = { ...(pref.zoom || {}), [viewAtual]: delta === 0 ? 1 : Math.round((z + delta) * 100) / 100 };
    aplicarZoom(); aplicar();
  }
  $('zoomMenos').onclick = () => mudarZoom(-0.1); $('zoomMais').onclick = () => mudarZoom(0.1); $('zoomValor').onclick = () => mudarZoom(0);
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); mudarZoom(0.1); }
    else if (e.key === '-') { e.preventDefault(); mudarZoom(-0.1); }
    else if (e.key === '0') { e.preventDefault(); mudarZoom(0); }
  });

  // ---------- views ----------
  function mostrarView(nome) {
    viewAtual = nome;
    const alvo = document.getElementById('view-' + nome) ? nome : 'outra';
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + alvo; });
    if (alvo === 'outra') { $('outraTitulo').textContent = (TITULOS[nome] || nome).split(' · ').pop(); $('outraTexto').textContent = 'A tela ' + (TITULOS[nome] || nome) + ' ainda não foi construída.'; }
    document.getElementById('main').scrollTop = 0;
    aplicarZoom();
    if (window.PlanilhaTelas) window.PlanilhaTelas.mostrar(alvo);
    if (window.PlanilhaCartoes) window.PlanilhaCartoes.mostrar(alvo);
    if (alvo === 'dashboard' && window.Dashboard) window.Dashboard.render();
    if (window.Economia) window.Economia.mostrar(alvo);
  }
  // ações da barra lateral: abrem a tela Saldos e agem nela
  document.querySelectorAll('[data-acao]').forEach(b => {
    b.onclick = () => {
      const sal = document.querySelector('[data-view="saldos"]'); if (sal && !sal.classList.contains('ativo')) sal.click();
      if (b.dataset.acao === 'adicionar') window.Saldos.abrirNovo();
      if (b.dataset.acao === 'hoje') setTimeout(() => window.Saldos.irParaHoje(), 60);
    };
  });
  const dia = new Date().getDate(); document.querySelectorAll('.sb-dia').forEach(el => el.textContent = dia);
  $('btnNovaMov').onclick = () => window.Saldos.abrirNovo();

  // o dashboard desenha os próprios gráficos a partir da planilha
  function desenharGraficos() { if (window.Dashboard && !$('view-dashboard').hidden) window.Dashboard.render(); }

  // estado inicial pela URL, pra captura e teste: ?tema=light&sidebar=icon&folha=1
  const q = new URLSearchParams(location.search);
  for (const k of ['tema', 'sidebar', 'variant', 'layout', 'cor', 'corGrafico', 'fonte', 'escala', 'raio']) if (q.has(k)) pref[k] = q.get(k);
  // zoom de uma aba pela URL, pra captura: ?zoomSaldos=0.8
  for (const [k, v] of q.entries()) if (k.startsWith('zoom') && k.length > 4) pref.zoom = { ...(pref.zoom || {}), [k.slice(4).toLowerCase()]: +v };

  aplicar();
  window.Saldos.montar();
  window.PlanilhaTelas.montar();
  window.PlanilhaCartoes.montar();
  window.Dashboard.montar();
  window.Economia.montar();
  window.Dashboard.render(); // o dashboard é a primeira tela: desenha antes de qualquer clique
  aplicarZoom();
  if (q.get('folha') === '1') abrirFolha(true);
  if (q.get('view')) { const b = document.querySelector('[data-view="' + q.get('view') + '"]'); if (b) b.click(); }
})();
