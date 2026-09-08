# A "planilha": modelo do app do Breno e o que vira nosso

Fonte: https://app.escoladobreno.com (conta do usuário, lida em 2026-09-08 pelo Chrome logado).
É um app de controle financeiro pessoal, não uma planilha de fato. O usuário quer a mesma
mecânica dentro do app novo, alimentando o Finance Dashboard.

## Telas

| Tela | O que é |
|---|---|
| **saldos** | Grade por mês: uma linha por dia, colunas `entradas · saídas · diários · economias · cartão · saldos`. Saldo é acumulado dia a dia e atravessa os meses. Célula vermelha quando o saldo é negativo, mais escura quanto mais negativo; positivo é um termômetro em relação ao maior saldo do período visto: amarelo (menos de 25%), verde claro (até 60%) e verde forte (acima). Dia de hoje destacado; fins de semana sombreados. Cada célula tem "adicionar movimentação" e "ver movimentações". Cada dia tem um "check-in" (marcar o dia como conferido). Colunas podem ser encolhidas. Rodapé com o total do mês por coluna. Seletor de período (mês a mês ou ano a ano). |
| **totais** | Cálculos do mês: **performance** (entradas − saídas − diários − economias − cartão − previsão de diário), **economizado** (economias ÷ entradas, em %), **custo de vida** (saídas + diários + cartão + previsão), **diário médio** (diários ÷ dias corridos do mês). Depois, "movimentações do mês" por tipo e "previsão de diários do mês" (previsão × dias restantes). |
| **tags** | Lista de tags com cor e total do mês. Filtro por nome. |
| **horizonte** | Visão compacta: 12 meses lado a lado, só a coluna de saldo por dia, pra enxergar até onde o dinheiro chega. |
| **menu** | perfil, previsão de diário (gastos mensais fixos ÷ 30 = orçamento diário), cartões de crédito (cadastro de cartões; lançamentos "gasto com cartão" vão pra fatura), configurações (claro/escuro/sistema; zerar conta; apagar conta). |
| **adicionar** | Formulário único, em modal. |

## O lançamento (movimentação)

Campos do formulário: **valor** (R$), **tipo**, **nome** (texto livre, o padrão é o nome do tipo),
**data**, **repetição**, **tags** (múltiplas, com cor).

Tipos: `entrada` (verde) · `saída` (vermelho) · `diário` (rosa: gasto do dia a dia) ·
`economia` (verde-limão: dinheiro guardado) · `gasto com cartão` (roxo: vai pra fatura).

Repetição: `não repete` · `mensalmente` · `semanalmente` · `diariamente` ·
`parcelado` (divide o valor pelo número de parcelas). Um lançamento repetido aparece em todos
os meses do horizonte com um ícone ↻ (é o que o usuário tem hoje: "Fixo" R$ 3.000 todo dia 10
e "Cartão do guga" R$ 916,08 todo dia 9, mais um empréstimo de R$ 2.200).

Painel do dia: lista as movimentações com nome, data, valor, tipo, tags e o ícone de
repetição; filtro por tipo; setas pra andar de dia em dia; "+" pra adicionar naquele dia.

## O que muda no nosso modelo de dados

Hoje o app só tem `jobs` (trabalhos com pagamento e liquidação). Entra uma segunda coleção:

```
movimentacoes: [{
  id, tipo: 'entrada'|'saida'|'diario'|'economia'|'cartao',
  valor: number (R$),
  nome: string,
  data: 'AAAA-MM-DD',
  repete: null | { tipo: 'mensal'|'semanal'|'diaria'|'parcelado', parcelas?: number, ate?: 'AAAA-MM' },
  tags: [tagId],
  cartaoId?: string,            // só em 'cartao'
  origem?: { jobId, entradaIdx } // quando veio de um pagamento de trabalho
}]
tags: [{ id, nome, cor }]
cartoes: [{ id, nome, fechamento, vencimento, limite? }]
checkins: ['AAAA-MM-DD', …]
config.previsaoDiario: number   // orçamento diário
```

Repetição é **regra, não cópia**: o lançamento guarda a regra e a grade materializa as
ocorrências ao desenhar (igual ao horizonte do Breno). Editar "só este" ou "todos" vira
exceção por data, como em calendário.

**Trabalho pago vira entrada sozinho.** Cada liquidação de trabalho (a lista `liquidacoes`
que já existe, com data e valor em R$) aparece na grade como `entrada` com
`origem: { jobId }`, nome do trabalho e tag automática "Comissão". Não é duplicado: é a mesma
informação lida de outro lugar. Se o usuário apagar a entrada, o app pergunta se quer desfazer
o recebimento no trabalho.

**Cofre vira `economia`.** Guardar no cofre é um lançamento `economia`; retirada é uma
`economia` negativa. A porcentagem automática ao receber (a regra do cofre) continua como
sugestão na hora da entrada. Isso resolve o card "Saving Goal" do dashboard: é a coluna
`economias`, sem gamificação.

## De onde sai cada card do Finance Dashboard (agora com fonte real)

| Card | Cálculo |
|---|---|
| Saldo | saldo acumulado até hoje (entradas − saídas − diários − economias − cartão), como a coluna `saldos` |
| Lucro do período | performance do período: entradas − tudo que saiu − previsão de diário restante |
| Gastos | saídas + diários + cartão no período; variação vs. período anterior |
| A receber | trabalhos entregues não pagos (Crava) + contagem de atrasados (cobrador) + mini-barras por dia do que caiu |
| Fontes de renda | entradas por tag (Comissão, e o que o usuário criar) ou por forma (Pix, PayPal, Robux) |
| Gastos por mês | saídas + diários + cartão, 6 meses, barras |
| Resumo por categoria | gastos por tag, rosquinha |
| Lançamentos | as últimas movimentações, todos os tipos, com tipo em chip e valor com sinal |
| Reserva (Saving Goal) | soma de `economias` × meta opcional |
| Carteira | R$ na conta, US$ a converter, Robux a vender (do Crava) + cartões (fatura aberta) |

A tela **Planilha** do app novo é a grade `saldos` do Breno, com o painel de dia, o painel
de totais do mês e as tags. O horizonte vira um modo de visualização da mesma grade.

## O que do Crava sobrevive por baixo

Trabalhos inteiros (quadro, estados, prazos, lentes), pagamentos em 3 moedas, liquidação
parcial com `liquidacoes[]`, cotação do dólar ao vivo, cobrador, captura rápida e widget
(a confirmar), conta + sincronização, backup diário, i18n, `salvarPreferencia`, os botões
acessíveis e o sistema de tokens (que troca de valores, não de mecanismo).

## O que morre

Macaco, insígnias, celebração, streak, meta diária, glow, share card e exportação de imagem,
calendário de lucro com GIF, card de "ganho no mês" como troféu. O calendário de lucro vira
a própria grade da planilha, que já é um calendário.

## Navegação decidida (2026-09-08, depois da leitura)

Barra lateral no estilo do Shadcn UI Kit, com grupos recolhíveis (o padrão "Real Estate ▾
→ Dashboard, Listings, Detail Page, Filter"):

```
Dashboard
Trabalhos
Planilha ▾
   Saldos            (a grade por dia)
   Totais            (cálculos do mês)
   Tags
   Cartões           (vinha do "menu" do Breno)
   Previsão de diário (vinha do "menu" do Breno)
   Horizonte         (12 meses de saldo lado a lado)
   + Adicionar        (ação: abre o formulário)
   Ir pra hoje        (ação: rola a grade até o dia de hoje, com o número do dia no ícone)
Economia             (aba própria, no topo)
Configurações        (perfil, aparência, conta — o resto do "menu" do Breno)
```

"Adicionar" e "Ir pra hoje" são ações, não telas: ficam dentro do grupo Planilha como no
Breno (abaixo das abas, com ícone), e o "Adicionar" também vale como atalho global.
O calendário de lucro do Crava está confirmado como removido.

- **Economia** é aba de primeiro nível, não sub-aba: mostra o guardado, o histórico de
  guardar/retirar e a meta opcional. A coluna `economias` da grade continua existindo;
  a aba é a visão dedicada.
- **Entrada automática de trabalho pago** é o padrão, com **chave nas configurações pra
  desligar**. Desligada, o usuário lança as entradas na mão como qualquer outra movimentação.
  Ligada, cada valor que cai vira entrada com `origem: { jobId }`; a entrada é editável e
  pode ser apagada (o app avisa que o trabalho continua marcado como pago).
- Copiar as duas referências: a **estrutura e o visual** do Shadcn UI Kit (barra, cabeçalho,
  cards, painel de personalização) e a **mecânica e as telas** do app do Breno (grade,
  totais, tags, formulário, repetição, horizonte, check-in).
