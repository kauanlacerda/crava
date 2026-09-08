# Referência visual do app novo: Finance Dashboard (Shadcn UI Kit)

Fonte: https://shadcnuikit.com/dashboard/finance (template pago, React + Tailwind + shadcn/ui).
Decisão do usuário em 2026-09-08: **copiar a base visual e o layout "praticamente igual"**,
tema escuro como padrão, barra lateral no mesmo estilo, com o painel de personalização.

O que a gente copia é o **desenho** (cores, tipografia, espaçamento, composição dos cards).
O código é nosso, em HTML/CSS/JS puro como o resto do app. Não se usa o código-fonte do
template, que é vendido sob licença própria.

Os valores abaixo foram lidos da página ao vivo (getComputedStyle), não do print.

## Tokens do tema escuro (paleta neutra, "Default")

| Papel | Valor | Onde aparece |
|---|---|---|
| `--background` | `#0a0a0a` | fundo da área principal |
| `--card` / `--popover` / `--sidebar` | `#171717` | cards, menus, barra lateral |
| `--foreground` | `#fafafa` | texto principal |
| `--muted-foreground` | `#a1a1a1` | texto secundário ("compared to last month", datas) |
| `--sidebar-foreground` | `#b0b0b0` | itens da barra lateral |
| `--primary` | `#e5e5e5` (texto `#171717`) | botão primário: quase branco com texto escuro |
| `--secondary` / `--muted` / `--accent` | `#262626` | botões secundários, fundo de chip neutro |
| `--sidebar-accent` | `#2c2c2c` | item ativo da barra lateral |
| `--border` | `rgba(255,255,255,0.10)` | bordas de card e da barra |
| `--input` | `rgba(255,255,255,0.15)` | borda de campo |
| `--ring` | `#737373` | anel de foco |
| `--destructive` | `#ff6466` | negativo, atraso, saída |
| positivo (badge verde) | texto `~#22a06b`, fundo verde a 10% | "↗ 12.5%" |
| `--chart-1…5` | `#d4d4d4`, `#737373`, `#525252`, `#404040`, `#262626` | gráficos em tons de cinza por padrão |
| `--radius` | `10px` (0.625rem) | botões e chips; cards usam `14px` (radius + 4) |

Observação: no template as cores dos gráficos e dos "Income Sources" ficam coloridas
(azul, verde, laranja, roxo) só quando o usuário escolhe uma paleta no painel. No padrão,
o dashboard é **quase monocromático**: a cor só entra em positivo (verde), negativo
(vermelho) e nos quatro segmentos da barra de fontes de renda.

## Tipografia

- Família: **DM Sans** (variável), corpo 16px / 24px de altura de linha.
- Título da página: 20px, 700, letter-spacing −0.5px.
- Título de card: 14px, 600.
- Número grande do card: 24px, 700.
- Texto secundário: 12px, 400, `--muted-foreground`.
- Cabeçalho de tabela: 14px, 500; linha de tabela: 57px de altura, borda inferior sutil.
- Chips/badges: 12px, raio pílula (26px).

Fontes oferecidas pelo painel (fonte de corpo): Default (DM Sans), Inter, Roboto, Poppins,
Montserrat, PT Sans, Overpass Mono. Fonte de destaque: Default, Geist, Montserrat, Poppins,
Plus Jakarta Sans, Outfit, Kumbh Sans, Hedvig Letters Serif.

## Espaçamento e estrutura

- Unidade base `--spacing: 4px`.
- Cabeçalho do app: 56px de altura, fundo `#171717` a 40%, com: botão de recolher a
  barra, seletor de espaço de trabalho ("Shadcn Outlet"), e à direita ações, sino,
  alternar tema, paleta (painel de personalização), avatar.
- Card: fundo `#171717` com leve transparência, sombra de 1px (`ring`) em vez de borda,
  raio 14px, cabeçalho `padding: 10px 16px`, conteúdo `padding: 16px`.
- Grade dos cards: `gap: 16px`. Linha 1 com 4 cards de KPI; linha 2 com 3 cards
  (largura 2/1/1 aproximadamente); linha 3 com tabela (2/3) + card lateral (1/3).
- Barra lateral: fundo `#171717`, itens com ícone 16px + rótulo 14px, item ativo com
  fundo `#2c2c2c`, grupos com rótulo pequeno em `--muted-foreground` ("Dashboards", "Apps").
  Campo de busca no topo com atalho ⌘K.
- Filtro de período no canto superior direito da página ("12 Aug 2026 – 08 Sep 2026") e
  botão de exportar.

## Painel de personalização ("Customize")

| Controle | Opções |
|---|---|
| Theme color | Default + 17 matizes Tailwind (Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose) |
| Chart colors | mesma lista |
| Font | 7 opções (acima) |
| Display font | 8 opções (acima) |
| Scale | XS … LG |
| Radius | SM, MD, LG, XL |
| Color schema | Light, Dark |
| Content layout | Full, Centered |
| Sidebar | Expanded, Icon, Offcanvas; variante Inset, Sidebar, Floating |
| | "Random" e "Reset to Default" |

## Composição do Finance Dashboard (o que cada card é)

1. **My Balance** — saldo, variação vs. mês anterior, dois botões (Transfer / Request).
2. **Net Profit** — lucro líquido, variação.
3. **Expenses** — gastos, variação (vermelha quando sobe).
4. **Pending Invoices** — a receber, contagem de atrasados em chip vermelho, mini-gráfico de barras.
5. **Income Sources** — total de renda, variação, barra segmentada e lista com 4 fontes.
6. **Monthly Expenses** — barras por mês (6 meses), rodapé "Trending up by X% this month".
7. **Summary** — rosquinha com total no centro e 4 categorias com porcentagem.
8. **Transactions** — tabela: avatar/ícone, nome, data e hora, tipo (Income/Expenses), valor com sinal e cor.
9. **Saving Goal** — valor de X de Y, barra de progresso.
10. **My Wallet** — cartões coloridos (crédito, digital…), botão "Add New".

## Mapa proposto para o nosso app (a confirmar com a planilha)

| Card do template | No nosso app | De onde vem o dado |
|---|---|---|
| My Balance | Saldo | planilha: entradas − saídas acumuladas (sem botões Transfer/Request) |
| Net Profit | Lucro do período | entradas − saídas − gastos no período do filtro |
| Expenses | Gastos | planilha: saídas + gastos diários |
| Pending Invoices | A receber | trabalhos entregues não pagos; "atrasados" = o cobrador de hoje |
| Income Sources | Fontes de renda | por forma de pagamento (Pix, PayPal, Robux) ou por cliente |
| Monthly Expenses | Gastos por mês | planilha |
| Summary | Gastos por categoria | planilha (precisa ter categoria) |
| Transactions | Lançamentos | planilha + liquidações de trabalhos |
| Saving Goal | Reserva | **em aberto**: o cofre sobrevive como "reserva"? |
| My Wallet | Carteira por moeda | R$ na conta, US$ a converter, Robux a vender |

O filtro de período no topo vale para todos os cards.

## O que fica de fora por princípio

Nada que exiba faturamento pra terceiros (share card, export de imagem) nem que
alimente ego ou FOMO. O dashboard mede pra decidir, não pra mostrar.
