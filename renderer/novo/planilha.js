// Modelo da planilha financeira: movimentações com repetição por regra,
// materialização por período, resumo por dia e mês, saldo acumulado.
// Sem DOM: roda no navegador (window.Planilha) e no Node (module.exports),
// pra ser testado sozinho.
(function (raiz) {
  const TIPOS = ['entrada', 'saida', 'diario', 'economia', 'cartao'];
  // só entrada soma; todo o resto tira do saldo (economia é dinheiro que saiu da conta corrente)
  const SINAL = { entrada: 1, saida: -1, diario: -1, economia: -1, cartao: -1 };
  const NOMES = { entrada: 'entrada', saida: 'saída', diario: 'diário', economia: 'economia', cartao: 'cartão' };
  const PLURAL = { entrada: 'entradas', saida: 'saídas', diario: 'diários', economia: 'economias', cartao: 'cartão' };

  // ---------- datas (sempre 'AAAA-MM-DD', sem fuso) ----------
  const pad = n => String(n).padStart(2, '0');
  const chave = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;
  const partes = k => { const [a, m, d] = k.split('-').map(Number); return { a, m, d }; };
  const diasNoMes = (a, m) => new Date(a, m, 0).getDate(); // m 1-12
  const hoje = () => { const d = new Date(); return chave(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
  function addDias(k, n) { const { a, m, d } = partes(k); const x = new Date(a, m - 1, d + n); return chave(x.getFullYear(), x.getMonth() + 1, x.getDate()); }
  // mesmo dia do mês n meses depois; dia 31 num mês de 30 vira 30
  function addMeses(k, n, diaBase) {
    const { a, m, d } = partes(k); const dia = diaBase || d;
    const total = (a * 12 + (m - 1)) + n; const a2 = Math.floor(total / 12), m2 = total % 12 + 1;
    return chave(a2, m2, Math.min(dia, diasNoMes(a2, m2)));
  }
  const diaSemana = k => { const { a, m, d } = partes(k); return new Date(a, m - 1, d).getDay(); };

  // ---------- dinheiro ----------
  const centavos = v => Math.round((Number(v) || 0) * 100);
  const deCentavos = c => c / 100;
  function fmtBRL(v, opts = {}) {
    const neg = v < 0; const abs = Math.abs(v);
    const s = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (opts.sinal) return (neg ? '−' : '+') + 'R$ ' + s;
    return (neg ? 'R$ -' : 'R$ ') + s;
  }
  function fmtCompacto(v) {
    const abs = Math.abs(v); const neg = v < 0 ? '-' : '';
    if (abs >= 1000000) return neg + (abs / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M';
    if (abs >= 1000) return neg + (abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K';
    return neg + abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- estado ----------
  function estadoVazio() {
    return { movimentacoes: [], tags: [], cartoes: [], checkins: [], previsaoDiario: 0, previsaoDias: 30, gastosMensais: [] };
  }

  // ---------- ocorrências de uma movimentação num período ----------
  // m = { id, tipo, valor, nome, data, repete: null | {tipo:'mensal'|'semanal'|'diaria'|'parcelado', parcelas?, ate?}, excecoes?: [], tags?: [], cartaoId?, origem? }
  function ocorrencias(m, de, ate) {
    const out = [];
    const exc = new Set(m.excecoes || []);
    const fim = m.repete && m.repete.ate && m.repete.ate < ate ? m.repete.ate : ate;
    const empurra = (data, valor, extra) => { if (data >= de && data <= fim && !exc.has(data)) out.push({ data, valor, mov: m, ...extra }); };
    if (!m.repete || m.repete.tipo === 'nao') { empurra(m.data, Number(m.valor) || 0, {}); return out; }
    const r = m.repete;
    if (r.tipo === 'parcelado') {
      const n = Math.max(1, Math.round(r.parcelas || 1));
      const total = centavos(m.valor); const base = Math.floor(total / n); const resto = total - base * n;
      const diaBase = partes(m.data).d;
      for (let i = 0; i < n; i++) {
        const data = addMeses(m.data, i, diaBase);
        if (data > fim) break;
        empurra(data, deCentavos(base + (i === n - 1 ? resto : 0)), { parcela: i + 1, parcelas: n });
      }
      return out;
    }
    if (r.tipo === 'mensal') {
      const diaBase = partes(m.data).d;
      for (let i = 0; ; i++) { const data = addMeses(m.data, i, diaBase); if (data > fim) break; empurra(data, Number(m.valor) || 0, {}); if (i > 1200) break; }
      return out;
    }
    const passo = r.tipo === 'semanal' ? 7 : 1;
    // começa direto no primeiro dia dentro do período, sem andar dia a dia desde a origem
    let data = m.data;
    if (data < de) { const { a, m: mm, d } = partes(data); const ini = new Date(a, mm - 1, d); const { a: a2, m: m2, d: d2 } = partes(de); const alvo = new Date(a2, m2 - 1, d2); const dif = Math.round((alvo - ini) / 864e5); data = addDias(m.data, Math.ceil(dif / passo) * passo); }
    for (let i = 0; data <= fim && i < 20000; i++) { empurra(data, Number(m.valor) || 0, {}); data = addDias(data, passo); }
    return out;
  }

  function materializar(movs, de, ate) {
    const out = [];
    for (const m of movs) for (const o of ocorrencias(m, de, ate)) out.push(o);
    out.sort((x, y) => x.data < y.data ? -1 : x.data > y.data ? 1 : 0);
    return out;
  }

  // ---------- resumos ----------
  const zeros = () => ({ entrada: 0, saida: 0, diario: 0, economia: 0, cartao: 0 });

  // saldo acumulado até o dia anterior a `data`
  function saldoAntes(movs, data) {
    let minimo = null;
    for (const m of movs) if (!minimo || m.data < minimo) minimo = m.data;
    if (!minimo || minimo >= data) return 0;
    let s = 0;
    for (const o of materializar(movs, minimo, addDias(data, -1))) s += SINAL[o.mov.tipo] * centavos(o.valor);
    return deCentavos(s);
  }

  // um mês inteiro: por dia, os totais por tipo, os itens e o saldo acumulado
  function resumoMes(estado, ano, mes) {
    const movs = estado.movimentacoes || [];
    const n = diasNoMes(ano, mes);
    const de = chave(ano, mes, 1), ate = chave(ano, mes, n);
    let saldo = centavos(saldoAntes(movs, de));
    const porDia = new Map();
    for (const o of materializar(movs, de, ate)) { if (!porDia.has(o.data)) porDia.set(o.data, []); porDia.get(o.data).push(o); }
    const dias = []; const totais = zeros();
    const checkins = new Set(estado.checkins || []);
    for (let d = 1; d <= n; d++) {
      const k = chave(ano, mes, d); const itens = porDia.get(k) || []; const t = zeros();
      for (const o of itens) { const c = centavos(o.valor); t[o.mov.tipo] += c; totais[o.mov.tipo] += c; saldo += SINAL[o.mov.tipo] * c; }
      for (const tp of TIPOS) t[tp] = deCentavos(t[tp]);
      dias.push({ data: k, dia: d, fimDeSemana: [0, 6].includes(diaSemana(k)), checkin: checkins.has(k), itens, ...t, saldo: deCentavos(saldo) });
    }
    for (const tp of TIPOS) totais[tp] = deCentavos(totais[tp]);
    return { ano, mes, dias, totais, saldoFinal: deCentavos(saldo) };
  }

  // ---------- edição ----------
  function adicionar(estado, dados) {
    const m = { id: novoId(), tipo: TIPOS.includes(dados.tipo) ? dados.tipo : 'saida', valor: Math.abs(Number(dados.valor) || 0), nome: (dados.nome || '').trim() || NOMES[dados.tipo] || 'saída', data: dados.data || hoje(), repete: normalizaRepete(dados.repete), tags: [...new Set(dados.tags || [])], criadoEm: new Date().toISOString() };
    if (dados.cartaoId) m.cartaoId = dados.cartaoId;
    if (dados.origem) m.origem = dados.origem;
    estado.movimentacoes.push(m);
    return m;
  }
  function normalizaRepete(r) {
    if (!r || !r.tipo || r.tipo === 'nao') return null;
    const out = { tipo: r.tipo };
    if (r.tipo === 'parcelado') out.parcelas = Math.max(2, Math.round(r.parcelas || 2));
    if (r.ate) out.ate = r.ate;
    return out;
  }
  function editar(estado, id, dados) {
    const m = estado.movimentacoes.find(x => x.id === id); if (!m) return null;
    if (dados.tipo && TIPOS.includes(dados.tipo)) m.tipo = dados.tipo;
    if (dados.valor !== undefined) m.valor = Math.abs(Number(dados.valor) || 0);
    if (dados.nome !== undefined) m.nome = (dados.nome || '').trim() || NOMES[m.tipo];
    if (dados.data) m.data = dados.data;
    if (dados.repete !== undefined) m.repete = normalizaRepete(dados.repete);
    if (dados.tags) m.tags = [...new Set(dados.tags)];
    if (dados.cartaoId !== undefined) { if (dados.cartaoId) m.cartaoId = dados.cartaoId; else delete m.cartaoId; }
    m.atualizadoEm = new Date().toISOString();
    return m;
  }
  // apaga a regra inteira, ou só um dia dela (vira exceção)
  function excluir(estado, id, soDia) {
    const i = estado.movimentacoes.findIndex(x => x.id === id); if (i < 0) return false;
    const m = estado.movimentacoes[i];
    if (soDia && m.repete) { m.excecoes = [...new Set([...(m.excecoes || []), soDia])]; return true; }
    estado.movimentacoes.splice(i, 1); return true;
  }
  // encerra a repetição a partir de um dia (o dia em si já não acontece)
  function encerrarEm(estado, id, data) {
    const m = estado.movimentacoes.find(x => x.id === id); if (!m || !m.repete) return false;
    m.repete.ate = addDias(data, -1); return true;
  }
  function alternarCheckin(estado, data) {
    const s = new Set(estado.checkins || []); if (s.has(data)) s.delete(data); else s.add(data);
    estado.checkins = [...s].sort(); return s.has(data);
  }
  const CORES_TAG = ['#93c5fd', '#86efac', '#f9a8d4', '#fde68a', '#c4b5fd', '#fdba74', '#5eead4', '#fca5a5'];
  function novaTag(estado, nome) {
    const n = (nome || '').trim(); if (!n) return null;
    const jaTem = estado.tags.find(t => t.nome.toLowerCase() === n.toLowerCase()); if (jaTem) return jaTem;
    const t = { id: novoId(), nome: n, cor: CORES_TAG[estado.tags.length % CORES_TAG.length] };
    estado.tags.push(t); return t;
  }

  // ---------- cartão de crédito ----------
  // A fatura que vence no mês (ano, mes) fecha no dia `fechamento` do mês
  // anterior ao vencimento quando o fechamento é depois do vencimento no
  // calendário (fecha 25, vence 5) e no mesmo mês quando é antes (fecha 1, vence 10).
  // Cobre do dia seguinte ao fechamento anterior até o fechamento.
  function periodoFatura(cartao, ano, mes) {
    const fech = Math.max(1, Math.min(31, cartao.fechamento || 1)), venc = Math.max(1, Math.min(31, cartao.vencimento || 10));
    const mesFech = fech > venc ? addMeses(chave(ano, mes, 1), -1, 1) : chave(ano, mes, 1);
    const { a, m } = partes(mesFech);
    const ate = chave(a, m, Math.min(fech, diasNoMes(a, m)));
    const antes = addMeses(chave(a, m, 1), -1, 1); const { a: a0, m: m0 } = partes(antes);
    const de = addDias(chave(a0, m0, Math.min(fech, diasNoMes(a0, m0))), 1);
    return { de, ate, vencimento: chave(ano, mes, Math.min(venc, diasNoMes(ano, mes))) };
  }
  function faturaCartao(estado, cartao, ano, mes) {
    const p = periodoFatura(cartao, ano, mes);
    const itens = materializar(estado.movimentacoes, p.de, p.ate).filter(o => o.mov.tipo === 'cartao' && o.mov.cartaoId === cartao.id);
    return { ...p, itens, total: deCentavos(itens.reduce((s, o) => s + centavos(o.valor), 0)) };
  }

  // entradas automáticas a partir dos trabalhos pagos do app (as liquidações)
  function entradasDeTrabalhos(jobs, tagId) {
    const out = [];
    for (const j of jobs || []) {
      const lista = Array.isArray(j.liquidacoes) && j.liquidacoes.length ? j.liquidacoes
        : (j.liquidado && j.liquidadoBRL > 0 ? [{ em: j.liquidadoEm || j.pagoEm, brl: j.liquidadoBRL }] : []);
      lista.forEach((e, i) => {
        if (!e.em || !(e.brl > 0)) return;
        out.push({ id: 'job:' + j.id + ':' + i, tipo: 'entrada', valor: Number(e.brl), nome: j.titulo + (j.cliente ? ' · ' + j.cliente : ''), data: String(e.em).slice(0, 10), repete: null, tags: tagId ? [tagId] : [], origem: { jobId: j.id, entradaIdx: i } });
      });
    }
    return out;
  }

  const api = { TIPOS, SINAL, NOMES, PLURAL, chave, partes, diasNoMes, hoje, addDias, addMeses, diaSemana, fmtBRL, fmtCompacto, novoId, estadoVazio, ocorrencias, materializar, saldoAntes, resumoMes, adicionar, editar, excluir, encerrarEm, alternarCheckin, novaTag, entradasDeTrabalhos, CORES_TAG, periodoFatura, faturaCartao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.Planilha = api;
})(typeof window !== 'undefined' ? window : globalThis);
