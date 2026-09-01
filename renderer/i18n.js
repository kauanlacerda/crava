// Crava — textos em português e inglês
const I18N = {
  pt: {
    // nav / sidebar
    colFila: 'Na fila', colFazendo: 'Fazendo', colEntregue: 'Entregue', colAprovado: 'Aprovado · a receber', colPago: 'Pago', colVazia: 'vazio', verTodos: 'ver todos', verRecentes: 'ver só recentes',
    navHoje: 'Hoje', navTrabalhos: 'Trabalhos', navInsignias: 'Insígnias',
    navCard: 'Card do mês', navConfig: 'Configurações',
    slotsTitulo: 'Disponível', slots: 'slots', slotsDe: 'de',
    slotsHint: 'Slot livre só quando um trabalho for pago.',
    btnWidget: 'Mostrar widget', buscar: 'Buscar trabalho ou cliente…',

    // hoje
    bomDia: 'Bom dia', boaTarde: 'Boa tarde', boaNoite: 'Boa noite',
    streakLabel: 'STREAK DE META', dia: 'dia', dias: 'dias',
    statMeta: 'META DO DIA', statReceber: 'PRA RECEBER',
    statPrazo: 'PRAZO MAIS PRÓXIMO', statGanho: 'GANHO NO MÊS',
    metaBatidaSub: 'meta batida — jogo liberado!', faltam: 'faltam', proJogo: 'pro jogo liberar',
    aguardandoPgtoSub: 'aguardando pgto', trabalho: 'trabalho', trabalhos: 'trabalhos',
    nenhumPrazo: 'nenhum prazo aberto', soReais: 'só R$ até agora',
    trabalhoAtivo: 'TRABALHO ATIVO', nenhumAtivo: 'Nenhum trabalho ativo',
    escolheFila: 'Escolhe um da fila e crava nele.',
    filaVazia: 'Fila vazia — captura um pedido novo com Ctrl+Shift+N.',
    comecar: 'Começar', semCliente: 'sem cliente',
    valor: 'Valor', prazo: 'Prazo', pagamento: 'Pagamento',
    naFila: 'NA FILA', concluidosEsperando: 'CONCLUÍDOS HOJE — ESPERANDO PAGAMENTO',
    concluidosPagos: 'CONCLUÍDOS HOJE — PAGOS ✓',
    diaLimpo: 'Dia limpo', capturaDica: 'Ctrl+Shift+N captura um pedido novo em 5 segundos.',
    semPrazo: 'sem prazo', deConcluidos: 'de', concluidosHoje: 'concluídos hoje',

    // status
    aceito: 'ACEITO', fazendo: 'FAZENDO', entregue: 'ENTREGUE', aprovado: 'APROVADO',
    naoPago: 'Não pago', aguardandoPgto: 'Aguardando pgto', pago: 'Pago',

    // botões
    btnCravar: 'Cravar', btnAprovado: 'Aprovado ✓', btnVendi: '💱 Vendi', btnCaiu: '💱 Caiu na conta',
    btnFila: 'Fila', btnDevolverFila: 'Devolver pra fila',
    btnMarcarEntregue: 'Marcar entregue', btnMarcarAprovado: 'Marcar aprovado',
    btnRecebiPgto: 'Recebi o pgto', btnPausar: '⏸ Pausar', btnRetomar: '▶ Retomar',
    btnNovoPedido: '+ Novo pedido', btnSalvar: 'Salvar', btnCancelar: 'Cancelar',
    btnFechar: 'Fechar', btnConfirmar: 'Confirmar',

    // avisos
    cobradorTexto: 'está entregue há', diasSemPgto: 'dias sem pagamento. Cobra',
    oCliente: 'o cliente', btnCobrei: 'Cobrei',
    cofrePendente: 'Cofre pendente', cofreSepara2: 'separa', desde: 'desde',
    btnSeparei: 'Separei ✓', maisCofres: 'cofres pendentes',

    // modais
    novoPedido: 'Novo pedido', oQueE: 'O que é?', cliente: 'Cliente', moeda: 'Moeda',
    salvarNaFila: 'Salvar na fila', pgtoAdiantado: 'Pago adiantado',
    pgtoRecebido: 'Pagamento recebido!', cofreEntrou: 'entrou', cofreSepara: 'Separa',
    btnDepois: 'Depois', metaBatida: 'Meta batida!', jogoLiberado: 'Jogo liberado, sem culpa',
    streakDe: 'Streak:', diasSeguidos: 'dias seguidos',
    liqVendi: 'Vendeu os Robux!', liqCaiu: 'Caiu na conta!',
    liqPergunta: 'Quanto caiu em reais?',
    excluirConfirma: 'Excluir esse trabalho?',
    slotsCheios: 'slots estão cheios (trabalhos ainda não pagos). Aceitar mesmo assim?',

    // insígnias
    insigniasTitulo: 'Insígnias', conquistadaEm: 'conquistada em', de: 'de',
    catRotina: 'ROTINA', catMes: 'MÊS', catBrl: 'GANHOS EM R$',
    catUsd: 'GANHOS EM US$', catRbx: 'GANHOS EM ROBUX', catGeral: 'GERAL — TODAS AS MOEDAS',
    historicoMes: 'HISTÓRICO POR MÊS', entregas: 'entregas', entrega: 'entrega',
    atrasos: 'atrasos', atraso: 'atraso', nadaRecebido: 'nada recebido',
    insigniaDesbloqueada: 'Insígnia desbloqueada! 🏅',

    // perfil
    meuPerfil: 'Meu perfil', trocarFoto: 'Trocar foto', nomeExibicao: 'Nome de exibição',
    usuario: 'Usuário', insigniaDestaque: 'Insígnia de destaque',
    insigniaDestaqueSub: 'Aparece ao lado do seu nome e no card do mês. Só dá pra escolher as que você já desbloqueou — clica de novo pra tirar.',
    semInsignias: 'Nenhuma insígnia desbloqueada ainda — crava uns trabalhos primeiro!',
    contaLogin: 'Conta e login',
    contaLoginSub: 'Sincronização entre PCs e login com senha chegam na próxima fase, junto com o servidor.',
    emBreve: 'EM BREVE', salvarPerfil: 'Salvar perfil', designer: 'GFX designer',

    // card do mês / calendário / lucro
    cardMes: 'Card do mês', mascote: 'Mascote', fundo: 'Fundo', opacidade: 'Opacidade',
    celulas: 'Células', copiarImagem: 'Copiar imagem', salvarGif: 'Salvar GIF',
    gerando: 'Gerando…', calendario: 'Calendário', calendarioLucro: 'Calendário de Lucro',
    salvarImagem: 'Salvar imagem', melhorSeq: 'Melhor sequência no mês:',
    melhorDia: 'melhor dia:', noAno: 'no ano:', noMes: 'no mês:',
    lucro: 'Lucro', semana: 'Semana', mes: 'Mês', ano: 'Ano',
    vsSemana: 'vs. semana passada', vsMes: 'vs. mês passado',
    faturei: 'FATUREI', trabalhosCard: 'TRABALHOS', maiorStreak: 'MAIOR STREAK',
    ticketMedio: 'TICKET MÉDIO', insigniasCard: 'INSÍGNIAS', feitoCom: 'feito com',

    // carteira / moedas / conversor
    carteira: 'Carteira', trocarCartao: 'Trocar cartão',
    cartGuardado: 'GUARDADO NO COFRE', cartLivre: 'LIVRE / NA CONTA',
    cartALiquidar: 'A LIQUIDAR', cartDoQueEntrou: 'do que entrou na conta',
    cartDe: 'de', cartNaConta: 'que caíram', cartTrabalhos: 'trabalhos',
    cartTudoLiquidado: 'tudo já virou reais',
    cartRecebidoConta: 'Recebido na conta', cartGuardadoLinha: 'Guardado',
    cartMetaCofre: 'Meta do cofre', cartEsperandoConversao: 'Esperando conversão',
    cartCofresPendentes: 'Cofres pendentes',
    moedas: 'Moedas', semEntradas: 'sem entradas', em: 'em',
    real: 'Real', dolar: 'Dólar', robux: 'Robux',
    conversor: 'Conversor', vcTem: 'Você tem', equivale: 'Equivale a',
    inverter: 'Inverter', cotacaoOnline: 'cotação online de',
    cotacaoConfig: 'usando as cotações das configurações',
    semInternet: 'sem internet — usando as cotações das configurações',
    robuxPelaConfig: 'Robux pela config',

    // configurações
    config: 'Configurações', tema: 'Tema', temaSub: 'Como o app aparece pra você',
    escuro: 'Escuro', claro: 'Claro', corMascote: 'Cor do mascote',
    corMascoteSub: 'Muda o macaco, os ícones e o esquema de cores do app',
    glow: 'Glow da tela inicial',
    glowSub: 'Cards coloridos e vibrantes; desligado volta ao estilo discreto do design antigo',
    ligado: 'Ligado', desligado: 'Desligado',
    idioma: 'Idioma', idiomaSub: 'Language of the app',
    metaDiaria: 'Meta diária (trabalhos)', slotsSimultaneos: 'Slots simultâneos',
    cofrePct: 'Cofre (% de cada pagamento)', cotacaoUSD: 'Cotação US$ → R$',
    cotacaoRBX: '1.000 Robux → R$', salvarConfig: 'Salvar configurações',

    // widget / notificações
    semTrabalhoAtivo: 'SEM TRABALHO ATIVO', pausado: 'PAUSADO',
    abreEscolhe: 'Abre o Crava e escolhe o próximo.',
    metaBatidaJogo: 'Meta batida — jogo liberado! 🎮',
    concluirEtapa: '✓ Concluir etapa', focadoNesse: 'focado nesse<br>trabalho',
    pausadoRespira: 'pausado —<br>respira aí', abrirCrava: 'Abrir o Crava',
    hoje: 'hoje', cardCopiado: 'Card copiado!'
  },

  en: {
    colFila: 'Queue', colFazendo: 'Doing', colEntregue: 'Delivered', colAprovado: 'Approved · unpaid', colPago: 'Paid', colVazia: 'empty', verTodos: 'see all', verRecentes: 'recent only',
    navHoje: 'Today', navTrabalhos: 'Jobs', navInsignias: 'Badges',
    navCard: 'Monthly card', navConfig: 'Settings',
    slotsTitulo: 'Available', slots: 'slots', slotsDe: 'of',
    slotsHint: 'A slot frees up only when a job gets paid.',
    btnWidget: 'Show widget', buscar: 'Search job or client…',

    bomDia: 'Good morning', boaTarde: 'Good afternoon', boaNoite: 'Good evening',
    streakLabel: 'GOAL STREAK', dia: 'day', dias: 'days',
    statMeta: 'DAILY GOAL', statReceber: 'TO RECEIVE',
    statPrazo: 'CLOSEST DEADLINE', statGanho: 'EARNED THIS MONTH',
    metaBatidaSub: 'goal hit — go play!', faltam: 'missing', proJogo: 'to unlock gaming',
    aguardandoPgtoSub: 'awaiting payment', trabalho: 'job', trabalhos: 'jobs',
    nenhumPrazo: 'no open deadline', soReais: 'only R$ so far',
    trabalhoAtivo: 'ACTIVE JOB', nenhumAtivo: 'No active job',
    escolheFila: 'Pick one from the queue and lock in.',
    filaVazia: 'Queue empty — capture a new order with Ctrl+Shift+N.',
    comecar: 'Start', semCliente: 'no client',
    valor: 'Value', prazo: 'Deadline', pagamento: 'Payment',
    naFila: 'IN QUEUE', concluidosEsperando: 'DONE TODAY — AWAITING PAYMENT',
    concluidosPagos: 'DONE TODAY — PAID ✓',
    diaLimpo: 'Clear day', capturaDica: 'Ctrl+Shift+N captures a new order in 5 seconds.',
    semPrazo: 'no deadline', deConcluidos: 'of', concluidosHoje: 'done today',

    aceito: 'ACCEPTED', fazendo: 'DOING', entregue: 'DELIVERED', aprovado: 'APPROVED',
    naoPago: 'Not paid', aguardandoPgto: 'Awaiting payment', pago: 'Paid',

    btnCravar: 'Lock in', btnAprovado: 'Approved ✓', btnVendi: '💱 Sold', btnCaiu: '💱 Landed',
    btnFila: 'Queue', btnDevolverFila: 'Send back to queue',
    btnMarcarEntregue: 'Mark delivered', btnMarcarAprovado: 'Mark approved',
    btnRecebiPgto: 'Got paid', btnPausar: '⏸ Pause', btnRetomar: '▶ Resume',
    btnNovoPedido: '+ New order', btnSalvar: 'Save', btnCancelar: 'Cancel',
    btnFechar: 'Close', btnConfirmar: 'Confirm',

    cobradorTexto: 'was delivered', diasSemPgto: 'days ago and is unpaid. Ping',
    oCliente: 'the client', btnCobrei: 'Pinged',
    cofrePendente: 'Savings pending', cofreSepara2: 'set aside', desde: 'since',
    btnSeparei: 'Set aside ✓', maisCofres: 'pending savings',

    novoPedido: 'New order', oQueE: 'What is it?', cliente: 'Client', moeda: 'Currency',
    salvarNaFila: 'Save to queue', pgtoAdiantado: 'Paid upfront',
    pgtoRecebido: 'Payment received!', cofreEntrou: 'came in', cofreSepara: 'Set aside',
    btnDepois: 'Later', metaBatida: 'Goal hit!', jogoLiberado: 'Gaming unlocked, guilt free',
    streakDe: 'Streak:', diasSeguidos: 'days in a row',
    liqVendi: 'Robux sold!', liqCaiu: 'Money landed!',
    liqPergunta: 'How much landed in R$?',
    excluirConfirma: 'Delete this job?',
    slotsCheios: 'slots are full (jobs not paid yet). Accept anyway?',

    insigniasTitulo: 'Badges', conquistadaEm: 'unlocked on', de: 'of',
    catRotina: 'ROUTINE', catMes: 'MONTH', catBrl: 'EARNINGS IN R$',
    catUsd: 'EARNINGS IN US$', catRbx: 'EARNINGS IN ROBUX', catGeral: 'OVERALL — ALL CURRENCIES',
    historicoMes: 'MONTHLY HISTORY', entregas: 'deliveries', entrega: 'delivery',
    atrasos: 'late', atraso: 'late', nadaRecebido: 'nothing received',
    insigniaDesbloqueada: 'Badge unlocked! 🏅',

    meuPerfil: 'My profile', trocarFoto: 'Change photo', nomeExibicao: 'Display name',
    usuario: 'Username', insigniaDestaque: 'Featured badge',
    insigniaDestaqueSub: 'Shows next to your name and on the monthly card. Only unlocked ones — click again to remove.',
    semInsignias: 'No badges unlocked yet — go lock in some jobs first!',
    contaLogin: 'Account and login',
    contaLoginSub: 'Cross-device sync and password login arrive in the next phase, with the server.',
    emBreve: 'SOON', salvarPerfil: 'Save profile', designer: 'GFX designer',

    cardMes: 'Monthly card', mascote: 'Mascot', fundo: 'Background', opacidade: 'Opacity',
    celulas: 'Cells', copiarImagem: 'Copy image', salvarGif: 'Save GIF',
    gerando: 'Generating…', calendario: 'Calendar', calendarioLucro: 'Profit Calendar',
    salvarImagem: 'Save image', melhorSeq: 'Best streak this month:',
    melhorDia: 'best day:', noAno: 'this year:', noMes: 'this month:',
    lucro: 'Profit', semana: 'Week', mes: 'Month', ano: 'Year',
    vsSemana: 'vs. last week', vsMes: 'vs. last month',
    faturei: 'I MADE', trabalhosCard: 'JOBS', maiorStreak: 'BEST STREAK',
    ticketMedio: 'AVG TICKET', insigniasCard: 'BADGES', feitoCom: 'made with',

    carteira: 'Wallet', trocarCartao: 'Switch card',
    cartGuardado: 'SAVED', cartLivre: 'FREE / IN ACCOUNT',
    cartALiquidar: 'TO SETTLE', cartDoQueEntrou: 'of what landed',
    cartDe: 'of', cartNaConta: 'received', cartTrabalhos: 'jobs',
    cartTudoLiquidado: 'everything already converted',
    cartRecebidoConta: 'Received in account', cartGuardadoLinha: 'Saved',
    cartMetaCofre: 'Savings target', cartEsperandoConversao: 'Awaiting conversion',
    cartCofresPendentes: 'Pending savings',
    moedas: 'Currencies', semEntradas: 'no income', em: 'in',
    real: 'Real', dolar: 'Dollar', robux: 'Robux',
    conversor: 'Converter', vcTem: 'You have', equivale: 'Equals',
    inverter: 'Swap', cotacaoOnline: 'live rate from',
    cotacaoConfig: 'using the rates from settings',
    semInternet: 'offline — using the rates from settings',
    robuxPelaConfig: 'Robux from settings',

    config: 'Settings', tema: 'Theme', temaSub: 'How the app looks to you',
    escuro: 'Dark', claro: 'Light', corMascote: 'Mascot color',
    corMascoteSub: 'Changes the monkey, the icons and the app color scheme',
    glow: 'Home screen glow',
    glowSub: 'Vivid colored cards; off goes back to the subtle style',
    ligado: 'On', desligado: 'Off',
    idioma: 'Language', idiomaSub: 'Idioma do aplicativo',
    metaDiaria: 'Daily goal (jobs)', slotsSimultaneos: 'Concurrent slots',
    cofrePct: 'Savings (% of each payment)', cotacaoUSD: 'Rate US$ → R$',
    cotacaoRBX: '1,000 Robux → R$', salvarConfig: 'Save settings',

    semTrabalhoAtivo: 'NO ACTIVE JOB', pausado: 'PAUSED',
    abreEscolhe: 'Open Crava and pick the next one.',
    metaBatidaJogo: 'Goal hit — gaming unlocked! 🎮',
    concluirEtapa: '✓ Complete step', focadoNesse: 'focused on<br>this job',
    pausadoRespira: 'paused —<br>take a breath', abrirCrava: 'Open Crava',
    hoje: 'today', cardCopiado: 'Card copied!'
  }
};

// nomes/descrições das insígnias em inglês (por id)
const INSIGNIAS_EN = {
  'primeiro-crava': ['First Lock-in', 'Your first delivery'],
  maquina: ['Machine', '5 deliveries in a single day'],
  fabrica: ['Factory', '10 deliveries in a single day'],
  esquenta: ['Warm-up', '3 days hitting the goal'],
  semana: ['Locked-in Week', '7 days hitting the goal'],
  quinzena: ['Brutal Fortnight', '14 days hitting the goal'],
  ferro: ['Iron Month', '30 days hitting the goal'],
  'streak-60': ['Steel Bimester', '60 days hitting the goal'],
  'streak-100': ['Centurion', '100 days hitting the goal'],
  'mes-10': ['Consistent Month', '10 deliveries in a month'],
  monstro: ['Monster Month', '20 deliveries in a month'],
  'mes-40': ['Legendary Month', '40 deliveries in a month'],
  'mes-ouro': ['Golden Month', 'R$ 20,000 received in a month (equiv.)'],
  'mes-diamante': ['Diamond Month', 'R$ 50,000 received in a month (equiv.)'],
  pontual: ['Punctuality', 'A month with 5+ deliveries and zero delays'],
  'pontual-3': ['Swiss Watch', '3 months with 5+ deliveries and zero delays'],
  'brl-250': ['First Cash', 'R$ 250 received in R$'],
  'brl-1k': ['First Grand', 'R$ 1,000 received in R$'],
  'brl-5k': ['Full Piggy Bank', 'R$ 5,000 received in R$'],
  'brl-10k': ['Ten Baron', 'R$ 10,000 received in R$'],
  'brl-50k': ['Fifty Club', 'R$ 50,000 received in R$'],
  'brl-100k': ['100k Club', 'R$ 100,000 received in R$'],
  'brl-500k': ['Pix Baron', 'R$ 500,000 received in R$'],
  'brl-1m': ['Million in Cash', 'R$ 1,000,000 received in R$'],
  'usd-100': ['First Dollar', 'US$ 100 received'],
  'usd-500': ['Half Grand', 'US$ 500 received'],
  gringo: ['Gringo', 'US$ 1,000 received'],
  'usd-2500': ['Quarter Grand', 'US$ 2,500 received'],
  'usd-5k': ['Exporter', 'US$ 5,000 received'],
  'usd-10k': ['Dollarized', 'US$ 10,000 received'],
  'usd-25k': ['Rich Gringo', 'US$ 25,000 received'],
  'usd-50k': ['Uncle Sam', 'US$ 50,000 received'],
  'rbx-1k': ['Pocket Robux', '1,000 Robux received'],
  'rbx-10k': ['First Robux', '10,000 Robux received'],
  'rbx-50k': ['Robux Pocket', '50,000 Robux received'],
  robuxeiro: ['Robux Runner', '100,000 Robux received'],
  'rbx-250k': ['Robux Vault', '250,000 Robux received'],
  'rbx-500k': ['Robux Magnate', '500,000 Robux received'],
  'rei-robux': ['Robux King', '1,000,000 Robux received'],
  'rbx-2m': ['Robux Emperor', '2,500,000 Robux received'],
  'rbx-5m': ['Robux God', '5,000,000 Robux received'],
  triplo: ['Triple Exchange', 'Received in R$, US$ and Robux'],
  'geral-5k': ['First Paycheck', 'R$ 5,000 overall (equiv.)'],
  'dez-k': ['Earner', 'R$ 10,000 overall (equiv.)'],
  'geral-50k': ['One-Person Company', 'R$ 50,000 overall (equiv.)'],
  'cem-k': ['Six Figures', 'R$ 100,000 overall (equiv.)'],
  'geral-250k': ['Quarter Million', 'R$ 250,000 overall (equiv.)'],
  'geral-500k': ['Half a Million', 'R$ 500,000 overall (equiv.)'],
  'geral-1m': ['Pixel Millionaire', 'R$ 1,000,000 overall (equiv.)'],
  'geral-2m': ['Two Million', 'R$ 2,000,000 overall (equiv.)'],
  'geral-5m': ['GFX Legend', 'R$ 5,000,000 overall (equiv.)']
};

let IDIOMA = 'pt';
function t(chave) {
  const d = I18N[IDIOMA] || I18N.pt;
  return d[chave] !== undefined ? d[chave] : (I18N.pt[chave] !== undefined ? I18N.pt[chave] : chave);
}
function nomeInsignia(b) {
  if (IDIOMA === 'en' && INSIGNIAS_EN[b.id]) return INSIGNIAS_EN[b.id][0];
  return b.nome;
}
function descInsignia(b) {
  if (IDIOMA === 'en' && INSIGNIAS_EN[b.id]) return INSIGNIAS_EN[b.id][1];
  return b.desc;
}
// aplica os textos estáticos marcados com data-i18n
function aplicarIdiomaHTML() {
  document.documentElement.lang = IDIOMA === 'en' ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}
