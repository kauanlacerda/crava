// Testes do modelo da planilha. Roda com: node tools/teste-planilha.js
const P = require('../renderer/novo/planilha.js');
let falhas = 0;
const ok = (nome, cond, detalhe) => { console.log((cond ? '  ok   ' : '  FALHA') + ' ' + nome + (detalhe !== undefined ? '  [' + detalhe + ']' : '')); if (!cond) falhas++; };

// datas
ok('addMeses 31/jan +1 = 28/fev', P.addMeses('2026-01-31', 1) === '2026-02-28', P.addMeses('2026-01-31', 1));
ok('addMeses volta pro dia 31 em março', P.addMeses('2026-01-31', 2, 31) === '2026-03-31');
ok('addDias atravessa o ano', P.addDias('2026-12-30', 3) === '2027-01-02');
ok('fmtBRL negativo igual ao Breno', P.fmtBRL(-43.27) === 'R$ -43,27', P.fmtBRL(-43.27));
ok('fmtBRL com sinal', P.fmtBRL(1640.26, { sinal: true }) === '+R$ 1.640,26', P.fmtBRL(1640.26, { sinal: true }));

// cenário real do usuário no app do Breno, setembro/2026
const E = P.estadoVazio();
P.adicionar(E, { tipo: 'saida', valor: 59.14, nome: 'Assinatura', data: '2026-09-01', repete: { tipo: 'mensal' } });
P.adicionar(E, { tipo: 'saida', valor: 62.19, nome: 'Conta', data: '2026-09-04' });
P.adicionar(E, { tipo: 'saida', valor: 2200, nome: 'Emprestimo', data: '2026-09-09' });
const guga = P.adicionar(E, { tipo: 'saida', valor: 916.08, nome: 'Cartão do guga', data: '2026-09-09', repete: { tipo: 'mensal' } });
P.adicionar(E, { tipo: 'saida', valor: 3000, nome: 'Fixo', data: '2026-09-10', repete: { tipo: 'mensal' } });
// saldo inicial: o Breno tinha R$ 15,87 antes de setembro (59,14 - 43,27)
P.adicionar(E, { tipo: 'entrada', valor: 15.87, nome: 'Saldo inicial', data: '2026-08-31' });

const set = P.resumoMes(E, 2026, 9);
ok('dia 1: saldo -43,27', set.dias[0].saldo.toFixed(2) === '-43.27', set.dias[0].saldo);
ok('dia 4: saldo -105,46', set.dias[3].saldo.toFixed(2) === '-105.46', set.dias[3].saldo);
ok('dia 9: saídas 3.116,08', set.dias[8].saida.toFixed(2) === '3116.08', set.dias[8].saida);
ok('dia 9: saldo -3.221,54', set.dias[8].saldo.toFixed(2) === '-3221.54', set.dias[8].saldo);
ok('dia 10: saldo -6.221,54', set.dias[9].saldo.toFixed(2) === '-6221.54', set.dias[9].saldo);
ok('total de saídas do mês 6.237,41', set.totais.saida.toFixed(2) === '6237.41', set.totais.saida);
ok('dia 5 é fim de semana', set.dias[4].fimDeSemana === true);
ok('dia 8 não é', set.dias[7].fimDeSemana === false);

const out = P.resumoMes(E, 2026, 10);
ok('outubro dia 1: saldo -6.280,68 (assinatura repetiu)', out.dias[0].saldo.toFixed(2) === '-6280.68', out.dias[0].saldo);
ok('outubro dia 9: só o cartão (916,08), empréstimo não repete', out.dias[8].saida.toFixed(2) === '916.08', out.dias[8].saida);
ok('outubro dia 10: saldo -10.196,76', out.dias[9].saldo.toFixed(2) === '-10196.76', out.dias[9].saldo);
ok('total de outubro 3.975,22', out.totais.saida.toFixed(2) === '3975.22', out.totais.saida);
const ago27 = P.resumoMes(E, 2027, 8);
ok('agosto/2027 termina em -38.877,00 + regras (Breno tinha encerrado o cartão em jul)', ago27.saldoFinal < -38000, ago27.saldoFinal);

// exceção e encerramento
P.excluir(E, guga.id, '2026-11-09');
ok('exceção: novembro sem o cartão', P.resumoMes(E, 2026, 11).dias[8].saida.toFixed(2) === '0.00');
ok('exceção não afeta dezembro', P.resumoMes(E, 2026, 12).dias[8].saida.toFixed(2) === '916.08');
P.encerrarEm(E, guga.id, '2027-03-09');
ok('encerrado: fevereiro ainda tem', P.resumoMes(E, 2027, 2).dias[8].saida.toFixed(2) === '916.08');
ok('encerrado: março não tem mais', P.resumoMes(E, 2027, 3).dias[8].saida.toFixed(2) === '0.00');

// parcelado: 1000 em 3 = 333,33 + 333,33 + 333,34
const F = P.estadoVazio();
P.adicionar(F, { tipo: 'cartao', valor: 1000, nome: 'Monitor', data: '2026-01-31', repete: { tipo: 'parcelado', parcelas: 3 } });
const oc = P.materializar(F.movimentacoes, '2026-01-01', '2026-12-31');
ok('parcelado: 3 ocorrências', oc.length === 3, oc.length);
ok('parcelado: datas 31/jan, 28/fev, 31/mar', oc.map(o => o.data).join(',') === '2026-01-31,2026-02-28,2026-03-31', oc.map(o => o.data).join(','));
ok('parcelado: centavos fecham', oc.reduce((a, o) => a + o.valor, 0).toFixed(2) === '1000.00', oc.map(o => o.valor).join(','));
ok('parcelado: última leva o resto', oc[2].valor.toFixed(2) === '333.34');

// semanal e diária começando antes do período
const G = P.estadoVazio();
P.adicionar(G, { tipo: 'diario', valor: 20, nome: 'Almoço', data: '2026-01-01', repete: { tipo: 'diaria' } });
P.adicionar(G, { tipo: 'saida', valor: 50, nome: 'Feira', data: '2026-01-03', repete: { tipo: 'semanal' } }); // sábado
const mar = P.resumoMes(G, 2026, 3);
ok('diária: 31 ocorrências em março', mar.totais.diario === 620, mar.totais.diario);
ok('semanal: sábados de março (7,14,21,28)', mar.dias.filter(d => d.saida > 0).map(d => d.dia).join(',') === '7,14,21,28', mar.dias.filter(d => d.saida > 0).map(d => d.dia).join(','));

// check-in e tags
ok('checkin liga', P.alternarCheckin(G, '2026-03-05') === true);
ok('checkin desliga', P.alternarCheckin(G, '2026-03-05') === false);
const t1 = P.novaTag(G, 'Mercado'); const t2 = P.novaTag(G, 'mercado');
ok('tag não duplica por caixa', t1.id === t2.id);

// entradas automáticas de trabalhos
const jobs = [{ id: 'j1', titulo: 'Thumb', cliente: 'zed', liquidacoes: [{ em: '2026-09-03T12:00:00Z', brl: 260 }, { em: '2026-09-08T12:00:00Z', brl: 270 }] }, { id: 'j2', titulo: 'Antigo', liquidado: true, liquidadoBRL: 1000, liquidadoEm: '2026-08-12T00:00:00Z' }];
const ent = P.entradasDeTrabalhos(jobs, 'tagc');
ok('2 liquidações + 1 legado = 3 entradas', ent.length === 3, ent.length);
ok('entrada leva origem e tag', ent[0].origem.jobId === 'j1' && ent[0].tags[0] === 'tagc' && ent[0].data === '2026-09-03');

console.log(falhas ? `\n>> ${falhas} FALHA(S)` : '\n>> tudo passou');
process.exit(falhas ? 1 : 0);
