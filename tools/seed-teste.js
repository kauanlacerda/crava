// adiciona/remove trabalhos de TESTE (marcados com teste:true)
// uso: node seed-teste.js         -> adiciona
//      node seed-teste.js limpar  -> remove todos os de teste
const fs = require('fs');
const path = require('path');
const arq = path.join(process.env.APPDATA, 'Crava', 'cravado-data.json');
const S = JSON.parse(fs.readFileSync(arq, 'utf8'));

// tira os antigos de teste (e o histórico deles)
for (const j of S.jobs) {
  if (j.teste && j.entregueEm) {
    const d = j.entregueEm.slice(0, 10);
    if (S.stats.historico[d]) {
      S.stats.historico[d] -= 1;
      if (S.stats.historico[d] <= 0) delete S.stats.historico[d];
    }
  }
}
S.jobs = S.jobs.filter(j => !j.teste);

if (process.argv[2] === 'limpar') {
  fs.writeFileSync(arq, JSON.stringify(S, null, 2), 'utf8');
  console.log('trabalhos de teste removidos. total agora:', S.jobs.length);
  process.exit(0);
}

const hoje = new Date();
function diaDoMes(mesesAtras, dia) {
  return new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, dia, 15, 0, 0).toISOString();
}

// fev -> ago com altos e baixos (quedas bruscas em mar e jun)
const plano = [
  { m: 7, itens: [ // fev - mes forte
    ['Thumb - Winter Update', 'lucasgfx', 3200, 'BRL', 4],
    ['Pack 4 thumbs - Tycoon', 'mrarmin', 2800, 'BRL', 12],
    ['Icon - Speed Run', 'nova', 180, 'USD', 19],
    ['Banner - Clan War', 'rblxpro', 45000, 'RBX', 25]
  ] },
  { m: 6, itens: [ // mar - queda brusca
    ['Thumb - Small Fix', 'zaqu', 380, 'BRL', 9],
    ['Icon simples', 'denis', 25, 'USD', 21]
  ] },
  { m: 5, itens: [ // abr - recuperacao
    ['GFX Grupo - Aura', 'trispil', 4100, 'BRL', 6],
    ['Thumb - Anime Fighters', 'kenzo', 2400, 'BRL', 15],
    ['Pack 2 icons', 'giov', 140, 'USD', 23],
    ['Thumb - Pet Sim', 'furiqus', 32000, 'RBX', 28]
  ] },
  { m: 4, itens: [ // mai - pico do ano
    ['Rebrand completo - Big Games', 'artie', 6800, 'BRL', 3],
    ['Pack 6 thumbs - Obby', 'soulzin', 4200, 'BRL', 10],
    ['Thumb - Grow a Garden', 'furiqus', 2900, 'BRL', 17],
    ['Icon + Banner - Blade', 'nova', 320, 'USD', 22],
    ['Thumb - Brainrot', 'rblxpro', 60000, 'RBX', 27]
  ] },
  { m: 3, itens: [ // jun - queda brusca (ferias)
    ['Thumb - Update rapido', 'kenzo', 700, 'BRL', 11],
    ['Icon - Lucky Block', 'zaqu', 55, 'USD', 24]
  ] },
  { m: 2, itens: [ // jul - voltando
    ['Thumb - Escape Tsunami', 'mrarmin', 2600, 'BRL', 7],
    ['Pack 3 thumbs - Race', 'lucasgfx', 2100, 'BRL', 16],
    ['Icon - Prospecting', 'denis', 190, 'USD', 20],
    ['Banner - Aura Ascension', 'trispil', 28000, 'RBX', 29]
  ] },
  { m: 1, itens: [ // ago
    ['Thumb - Knockout Pack', 'juanartxzz', 2900, 'BRL', 5],
    ['GFX Grupo - Blade Legends', 'soulzin', 1500, 'BRL', 14],
    ['Icon pack - Tower Rush', 'pontin', 210, 'USD', 21],
    ['Thumb - Pet Empire', 'lude', 22000, 'RBX', 26]
  ] }
];

let n = 0;
for (const { m, itens } of plano) {
  for (const [titulo, cliente, q, moeda, dia] of itens) {
    const quando = diaDoMes(m, dia);
    S.jobs.push({
      id: 'teste' + (++n) + '_' + Date.now(),
      titulo, cliente,
      valor: { q, m: moeda },
      prazo: quando.slice(0, 10),
      status: 'aprovado',
      pagamento: 'pago',
      criadoEm: quando,
      entregueEm: quando,
      pagoEm: quando,
      teste: true
    });
    const d10 = quando.slice(0, 10);
    S.stats.historico[d10] = (S.stats.historico[d10] || 0) + 1;
  }
}

fs.writeFileSync(arq, JSON.stringify(S, null, 2), 'utf8');
console.log('adicionados', n, 'trabalhos de teste (fev a ago). total:', S.jobs.length);
