// adiciona/remove trabalhos de TESTE (marcados com teste:true)
// uso: node seed-teste.js         -> adiciona
//      node seed-teste.js limpar  -> remove todos os de teste
const fs = require('fs');
const path = require('path');
const arq = path.join(process.env.APPDATA, 'Crava', 'cravado-data.json');
const S = JSON.parse(fs.readFileSync(arq, 'utf8'));

S.jobs = S.jobs.filter(j => !j.teste);

if (process.argv[2] === 'limpar') {
  fs.writeFileSync(arq, JSON.stringify(S, null, 2), 'utf8');
  console.log('trabalhos de teste removidos. total agora:', S.jobs.length);
  process.exit(0);
}

const hoje = new Date();
function diaDoMes(mesesAtras, dia) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras, dia, 15, 0, 0);
  return d.toISOString();
}

// mês -3, -2, -1 com volumes diferentes pro stream ganhar forma
const plano = [
  { m: 3, itens: [['Thumb - Pack Verão', 'lucasgfx', 900, 'BRL', 4], ['Icon - Speed Run', 'nova', 60, 'USD', 12], ['Banner - Clan War', 'rblxpro', 15000, 'RBX', 21]] },
  { m: 2, itens: [['Thumb - Anime Fighters', 'kenzo', 1800, 'BRL', 3], ['Pack 3 thumbs - Tycoon', 'mrarmin', 2200, 'BRL', 11], ['Icon - Obby Master', 'zaqu', 120, 'USD', 19], ['Thumb - Pet Sim', 'giov', 40000, 'RBX', 26]] },
  { m: 1, itens: [['Thumb - Grow a Garden', 'furiqus', 3200, 'BRL', 5], ['GFX Grupo - Aura Studios', 'trispil', 2600, 'BRL', 14], ['Icon + Thumb - Blade', 'soulzin', 260, 'USD', 22], ['Thumb - Brainrot', 'denis', 25000, 'RBX', 28]] }
];

let n = 0;
for (const { m, itens } of plano) {
  for (const [titulo, cliente, q, moeda, dia] of itens) {
    const quando = diaDoMes(m, dia);
    S.jobs.push({
      id: 'teste' + (++n) + Date.now(),
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
    const dia10 = quando.slice(0, 10);
    S.stats.historico[dia10] = (S.stats.historico[dia10] || 0) + 1;
  }
}

fs.writeFileSync(arq, JSON.stringify(S, null, 2), 'utf8');
console.log('adicionados', n, 'trabalhos de teste. total:', S.jobs.length);
