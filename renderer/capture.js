let moeda = 'BRL';
const $ = (id) => document.getElementById(id);

$('cMoedas').onclick = (e) => {
  const m = e.target.dataset.m;
  if (!m) return;
  moeda = m;
  document.querySelectorAll('.m').forEach(x => x.classList.toggle('sel', x.dataset.m === m));
};

function salvar() {
  const titulo = $('cTitulo').value.trim();
  if (!titulo) { $('cTitulo').focus(); return; }
  window.api.saveCapture({
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
}

$('cSalvar').onclick = salvar;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') salvar();
  if (e.key === 'Escape') { limpar(); window.api.closeCapture(); }
});
window.addEventListener('focus', () => $('cTitulo').focus());
