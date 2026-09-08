# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(App desktop Electron 33 para Windows 10/11. A interface é HTML/CSS/JS renderizada pelo Chromium do Electron. macOS e Linux não são alvo hoje.)

## Users

**Freelancers de GFX para Roblox** (thumbnails, ícones, banners por comissão) e, por extensão, quem vive de comissão online. Confirmado em 2026-09-03 que o alvo é a comunidade, não só o círculo de amigos; e em 2026-09-08 que o autor pretende usar o app **por anos**, como ferramenta de trabalho de verdade.

Situação típica: Photoshop ou Blender em tela cheia, pedidos por DM do Discord, várias comissões abertas, pagamento em Pix, Robux ou PayPal, às vezes adiantado, às vezes muito depois. Dinheiro que entra costuma evaporar; o autor já tentou controlar em app de terceiro (o "app do Breno") e quer isso dentro da própria ferramenta.

Quem usa hoje: o autor (sak / Kauan Lacerda) e amigos freelancers, que também testam.

## Product Purpose

Uma ferramenta de trabalho para quem vive de comissão: **o que estou fazendo, quem me deve, quanto entrou, quanto saiu, quanto sobra.**

- **Trabalhos:** um por vez, quadro por etapa, prazos, pagamento em três moedas com estados honestos (não pago, sinal, recebido, caiu na conta), cobrador de quem deve.
- **Finanças:** uma grade por dia com entradas, saídas, gastos diários, economias e cartão, saldo acumulado que atravessa meses, lançamentos com repetição e tags; e um dashboard que resume tudo isso pra decidir.

Sucesso para o usuário: entregar no prazo, cobrar quem deve, saber o saldo real, guardar uma parte. Sucesso para o produto: ser aberto todo dia junto com o Photoshop, por anos, sem parecer brinquedo.

## Positioning

**Ferramenta de trabalho, não jogo.** Decisão de 2026-09-08 que substitui o posicionamento anterior ("feito por quem tem TDAH pra quem tem TDAH", com recompensa como princípio): a versão gamificada foi copiada por terceiros e o autor concluiu que a cara de jogo desfigurava o trabalho, fazendo-o parecer fútil. O app novo trata comissão online como o negócio que é.

Segue distinto de um Notion ou Trello pela mecânica: trabalho e dinheiro no mesmo lugar, com pagamento em três moedas e estado real (Robux e dólar "a converter" até virarem real), pagamento recebido virando entrada na grade financeira sozinho.

**Princípio de filtro:** nada que alimente ego ou FOMO. O app mede dinheiro para decidir, não para exibir. Sem card de faturamento pra postar, sem troféu, sem streak.

## Operating Context

- **Entrada de pedidos:** Discord. Captura rápida (`Ctrl+Shift+N`) com sugestão a partir da janela do Discord e da área de transferência (opcional).
- **Ambiente:** Windows, Photoshop/Blender em tela cheia; widget flutuante por cima; app na bandeja.
- **Dinheiro:** Pix (R$), Robux, PayPal (US$); cotação do dólar online a cada 5 min; Robux com cotação definida pelo usuário. Grade financeira em R$.
- **Distribuição:** grátis, MIT, instalador NSIS sem assinatura digital (aviso do SmartScreen), auto-update por releases do GitHub. A versão atual em produção é o Crava v1.3.7; o app novo nasce na branch `reestruturacao` e será publicado com outro nome.
- **Dados:** offline-first, JSON local como verdade, Supabase como espelho (último-a-escrever-vence com carimbos), backup local diário. Funciona sem conta.
- **Idiomas:** PT-BR (primário) e EN, paridade total.

## Capabilities and Constraints

**Vem do Crava, intacto por baixo:** trabalhos (quadro, estados, prazos, lentes), pagamento em 3 moedas, liquidação parcial com entradas datadas, cotação ao vivo, cobrador, captura rápida, widget, conta e sincronização, backup, i18n, gravação silenciosa de preferências, botões acessíveis, sistema de tokens de CSS.

**Nasce agora:** coleção de movimentações (tipo, valor, nome, data, repetição, tags), tags, cartões, check-in por dia, previsão de diário; telas Planilha (Saldos, Totais, Tags, Cartões, Previsão de diário, Horizonte, ações Adicionar e Ir pra hoje), Economia e Finance Dashboard; painel de personalização (cor do tema, cor dos gráficos, fonte, fonte de destaque, escala, raio, claro/escuro, layout, barra lateral).

**Sai:** mascote, insígnias, celebração, streak, meta diária, glow, share card e exportação de imagem, calendário de lucro.

**Navegação:** Dashboard · Trabalhos · Planilha ▾ · Economia · Configurações. Primeira tela é o Dashboard.

**Restrições técnicas:** Electron + HTML/CSS/JS puro, sem framework, sem build step; infraestrutura de custo zero; sem telemetria; Windows apenas. Fontes e ativos viajam dentro do app (sem rede em tempo de execução além de cotação e sincronização).

**Vocabulário:** *Trabalho*, *Na fila*, *Fazendo*, *Entregue*, *Cobrar*, *Caiu na conta*, *A converter*, *Entrada*, *Saída*, *Diário*, *Economia*, *Cartão*, *Saldo*, *Horizonte*, *Check-in*, *Tag*, *Lançamento*.

**Em aberto:** nome do app (o brainstorm anterior está descartado com o nome Crava); trabalho pago vira entrada sozinho por padrão, com chave pra desligar (decidido); meta opcional de economia.

## Brand Commitments

Decididos em 2026-09-08:

- **Referência visual pinada:** o Finance Dashboard do Shadcn UI Kit (https://shadcnuikit.com/dashboard/finance), copiado "praticamente igual" em estrutura, tema escuro, tipografia (DM Sans), raios, espaçamento, barra lateral com grupos recolhíveis e painel de personalização. Tokens medidos em `docs/specs/2026-09-08-referencia-finance-dashboard.md`. Copiamos o desenho; o código é nosso.
- **Referência de mecânica pinada:** o app do Breno para a parte financeira (`docs/specs/2026-09-08-planilha-modelo.md`).
- **Voz:** direta, adulta, de ferramenta de trabalho. Sem comemoração, sem mascote, sem gíria de jogo. PT-BR informal ("você") continua.
- **Nome:** a definir. "Crava" e o macaco ficam com a versão antiga.
- **Compromissos antigos revogados:** Manrope, cantos 16–20px, slate azul do Cube Graphics, macaco em 6 cores, "recompensa nunca culpa".

## Evidence on Hand

- `docs/specs/2026-09-08-referencia-finance-dashboard.md` — tokens, tipografia, composição e painel da referência visual, medidos ao vivo.
- `docs/specs/2026-09-08-planilha-modelo.md` — modelo de dados e telas do app do Breno, lidos da conta do usuário; navegação decidida.
- `docs/specs/2026-09-01-cravado-v1-design.md`, `README.md`, `docs/novidades.json` — o Crava como está.
- Dados reais do usuário no app do Breno: saídas fixas (R$ 3.000 dia 10, cartão R$ 916,08 dia 9), horizonte set/2026–ago/2027.

**Não existe** (não inventar): depoimentos, número de usuários, benchmarks, preço (é grátis), imprensa.

## Product Principles

1. **Ferramenta, não jogo.** Cada tela parece um sistema de gestão que um profissional abre todo dia. Nada comemora.
2. **Medir pra decidir, não pra exibir.** Nenhum número existe pra ser mostrado a terceiros.
3. **Dinheiro só é dinheiro quando cai.** Estados honestos: a converter, sinal, na conta.
4. **Um dado, um lugar.** Pagamento recebido no trabalho é a entrada na grade; não se digita duas vezes.
5. **Calma visual é requisito funcional.** Nada re-renderiza sem motivo; toda mudança é local e previsível.

## Accessibility & Inclusion

Teclado em tudo, foco visível, contraste AA nos dois temas (herdado da v1.3.5), `prefers-reduced-motion` respeitado. O público segue com dificuldade de foco; o app responde com sobriedade e previsibilidade, não com recompensa.
