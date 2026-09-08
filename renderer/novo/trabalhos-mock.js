// Adaptador de trabalhos pro dashboard. No app de verdade, `lista()` devolve
// S.jobs (o modelo do Crava, com valor {q, m}, recebido, liquidacoes…).
// No mock, devolve exemplos quando a página abre com ?semente=1.
(() => {
  const P = window.Planilha;
  const hj = P.hoje();
  let jobs = [];
  function semear() {
    const d = (n) => P.addDias(hj, n);
    jobs = [
      { id: 't1', titulo: 'Zed · Pack Halloween', cliente: 'zed', valor: { q: 100, m: 'USD' }, status: 'fazendo', pagamento: 'aguardando', recebido: 50, liquidadoQ: 50, liquidacoes: [{ em: d(-3) + 'T15:50:00.000Z', brl: 260, q: 50 }] },
      { id: 't2', titulo: 'Furiqus · Thumb Nova flow', cliente: 'furiqus', valor: { q: 15000, m: 'RBX' }, status: 'entregue', pagamento: 'pago', recebido: 15000, liquidadoQ: 0, pagoEm: d(-1) + 'T12:00:00.000Z', entregueEm: d(-2) + 'T12:00:00.000Z' },
      { id: 't3', titulo: 'Theo · Thumb Get GFX', cliente: 'theo', valor: { q: 95, m: 'USD' }, status: 'entregue', pagamento: 'nao_pago', recebido: 0, entregueEm: d(-6) + 'T12:00:00.000Z' },
      { id: 't4', titulo: 'Kenzo · Icon Speed', cliente: 'kenzo', valor: { q: 450, m: 'BRL' }, status: 'entregue', pagamento: 'nao_pago', recebido: 0, entregueEm: d(-4) + 'T12:00:00.000Z' },
      { id: 't5', titulo: 'Giov · Banner', cliente: 'giov', valor: { q: 1200, m: 'BRL' }, status: 'aceito', pagamento: 'nao_pago', recebido: 0 },
      { id: 't6', titulo: 'Soulzin · Icon + Thumb', cliente: 'soulzin', valor: { q: 260, m: 'USD' }, status: 'entregue', pagamento: 'pago', recebido: 260, liquidadoQ: 260, liquidacoes: [{ em: d(-12) + 'T12:00:00.000Z', brl: 1340, q: 260 }] }
    ];
  }
  // as mesmas regras do Crava, no mínimo que o dashboard precisa
  const recebidoDe = (j) => typeof j.recebido === 'number' ? j.recebido : (j.pagamento === 'pago' ? Number(j.valor.q) : 0);
  const liquidadoQDe = (j) => j.valor.m === 'BRL' ? recebidoDe(j) : (typeof j.liquidadoQ === 'number' ? Math.min(j.liquidadoQ, recebidoDe(j)) : (j.liquidado ? recebidoDe(j) : 0));
  const pendenteDe = (j) => Math.max(0, recebidoDe(j) - liquidadoQDe(j));
  const faltaDe = (j) => Math.max(0, Number(j.valor.q) - recebidoDe(j));
  const DIAS_COBRAR = 3;
  const diasDesde = (iso) => iso ? Math.floor((Date.parse(hj + 'T00:00:00') - Date.parse(String(iso).slice(0, 10) + 'T00:00:00')) / 864e5) : 0;
  function aReceber(cotacoes) {
    const eq = (q, m) => m === 'BRL' ? q : m === 'USD' ? q * (cotacoes.USD || 5) : (q / 1000) * (cotacoes.RBX1k || 35);
    const lista = jobs.filter(j => ['entregue', 'aprovado'].includes(j.status) && faltaDe(j) > 0);
    const atrasados = lista.filter(j => diasDesde(j.entregueEm) >= DIAS_COBRAR);
    return { total: lista.reduce((s, j) => s + eq(faltaDe(j), j.valor.m), 0), itens: lista, atrasados: atrasados.length };
  }
  function aConverter() {
    const out = { USD: 0, RBX: 0 };
    for (const j of jobs) if (j.valor.m !== 'BRL' && pendenteDe(j) > 0) out[j.valor.m] += pendenteDe(j);
    return out;
  }
  window.Trabalhos = { lista: () => jobs, semear, aReceber, aConverter, pendenteDe, faltaDe };
})();
