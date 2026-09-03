# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(App desktop Electron 33 para Windows 10/11. A interface é HTML/CSS/JS renderizada pelo Chromium do Electron — linguagem de design web, não nativa. macOS e Linux não são alvo hoje.)

## Users

**Primário: freelancers de GFX para Roblox** — thumbnails, ícones e banners por comissão. Confirmado pelo autor em 2026-09-03: o produto mira **qualquer freelancer de GFX Roblox**, não só o círculo de amigos.

Situação típica: Photoshop ou Blender em tela cheia, pedidos chegando por DM do Discord, várias comissões abertas ao mesmo tempo, pagamento em Pix, Robux ou PayPal, muitas vezes adiantado (sinal) ou muito depois da entrega. Grande parte desse público tem dificuldade de foco; o autor tem TDAH e construiu o app a partir da própria dor.

O trabalho que essa pessoa está tentando fazer: **terminar uma comissão por vez, saber exatamente quem deve o quê, e não deixar o dinheiro evaporar**.

Hoje quem usa é o autor (sak / Kauan Lacerda) e amigos freelancers, que também servem de testadores — o Zakyen mandou três gravações de tela que viraram as correções da v1.3.2 e é agradecido dentro do app na v1.3.4.

## Product Purpose

O Crava existe porque dá para faturar bem com GFX de Roblox e mesmo assim **não terminar nada e não sobrar dinheiro no fim do mês**. Ele resolve as duas pontas:

- **Foco:** um trabalho ativo por vez ("cravar" em um pausa o outro), captura rápida de pedidos sem sair do que se está fazendo, widget sempre por cima, meta diária com recompensa.
- **Dinheiro:** cada centavo rastreado por estado real — não pago → sinal → pago → vendido/caiu na conta — em três moedas, com cofre para separar uma porcentagem e cobrador para quem está devendo.

Sucesso, para o usuário: entregas concluídas no prazo, clientes cobrados, e uma parte do dinheiro guardada sem esforço de vontade. Sucesso, para o produto: ser o app que um freelancer de GFX Roblox abre junto com o Photoshop, todo dia.

## Positioning

**Feito por quem tem TDAH, para quem tem TDAH.** Confirmado pelo autor como o coração do produto (2026-09-03).

Um Locked In, Notion ou Trello pode copiar um quadro kanban ou um cronômetro. Não pode copiar honestamente a premissa de que, para essa cabeça, terminar e não gastar são o mesmo problema — e que a resposta é **recompensa imediata como princípio, não enfeite**: streak, "jogo liberado" ao bater a meta, macaco comemorando, insígnias que evoluem. As regras duras (um ativo por vez, fila com teto) existem para tirar a paralisia de escolha, não para disciplinar.

Segundo pilar, derivado do primeiro: **dinheiro com estado honesto**. Robux e PayPal ficam "a converter" até virarem real na conta; ninguém rastreia comissão de GFX assim.

## Operating Context

- **Entrada de pedidos:** Discord. A captura rápida (`Ctrl+Shift+N`) lê o título da janela do Discord e a área de transferência para sugerir cliente, valor, moeda e prazo. Esse rastreio é opcional nas configurações.
- **Ambiente de trabalho:** Windows, Photoshop/Blender em tela cheia. O widget flutuante e a captura precisam funcionar por cima disso. O app vive na bandeja.
- **Dinheiro:** Pix (R$), Robux (RBX) e PayPal (US$). Cotação do dólar buscada online a cada 5 minutos; cotação de Robux definida pelo usuário. Cofre com porcentagem escolhida; retiradas registradas.
- **Distribuição:** grátis, código aberto (MIT), instalador NSIS publicado em releases do GitHub com auto-update via electron-updater. O instalador **não tem assinatura digital**: o Windows mostra o aviso azul do SmartScreen e o README ensina a passar por ele.
- **Dados:** offline-first. JSON local é a verdade; Supabase (Auth + Postgres jsonb + RLS) é espelho, sincronizado a cada 5 minutos e no fechamento, último-a-escrever-vence com carimbos de tempo. Backup local diário dos últimos 14 dias. Também funciona sem conta.
- **Idiomas:** PT-BR (primário, informal, "você") e EN com paridade total via dicionário `i18n.js`.
- **Ritual de release:** bump → entrada em `docs/novidades.json` → tag → GitHub Actions builda → notas ricas escritas via API. A tela de novidades abre no app após atualizar e pode carregar um recado em destaque (`nota`).

## Capabilities and Constraints

**Funciona hoje (v1.3.4):** Hoje / Trabalhos (quadro por etapa: Esperando pagamento → Na fila → Fazendo → Entregue, arrastar e soltar, lentes) / Finanças (calendário de lucro, gráfico de fluxo mensal, rosquinha de moedas, carteira, conversor, card do mês exportável como PNG ou GIF) / Cofre / Insígnias (51, com meta escolhida na barra lateral) / Configurações. Widget flutuante, captura rápida com autofill do Discord, notificações de prazo, cobrador, streak, celebração, tutorial de primeira vez, tela de novidades e histórico de patches, conta e sincronização.

**Restrições técnicas assumidas:**
- Electron + HTML/CSS/JS **puro**: sem framework, sem build step, sem bundler. Um `app.js` grande com `render()` central; gráficos, card e calendário em canvas 2D.
- Infraestrutura de **custo zero** (Supabase free tier). Nada de servidor próprio.
- Sem telemetria ou analytics (nenhuma dependência do tipo no projeto).
- Windows apenas.

**Vocabulário do produto** (não traduzir para termos genéricos): *Cravar* (tornar ativo), *Na fila*, *Esperando* (pagamento), *Fazendo*, *Entregue*, *Cofre*, *Cobrador*, *Meta diária*, *Streak*, *Jogo liberado*, *Card do mês*, *Insígnia*, *Macaco* (mascote), *Lente* (filtro do quadro).

**Decidido mas não construído / em aberto:**
- Como alcançar a comunidade GFX além dos amigos: não existe site, página ou material de divulgação. Em aberto.
- Assinatura digital do instalador: descartada por custo (~R$ 400/ano).
- Recebido em Robux com regra de "a converter": implementado; R$/hora a partir do tempo acumulado por trabalho: dado coletado (`tempoTotalMs`), tela não construída.
- Um bug relatado pelo Zakyen (botão "Recebi" piscando) não foi reproduzido e segue em aberto.

## Brand Commitments

Travados pelo autor em 2026-09-03 — trabalho futuro preserva, não propõe alternativa:

- **Nome: Crava.** O brainstorm de renomear está encerrado.
- **Mascote: o macaco em 6 cores** (azul, vermelho, verde, roxo, laranja, branco), pixel art, em `assets/macaco/<cor>/macaco-0N.png`. A cor escolhida muda o app inteiro. O crocodilo em `assets/croc` é histórico, não é mascote.
- **Base visual herdada do Cube Graphics** (app da agência do autor, uso autorizado): Manrope, cantos de 16–20px, slate escuro (#0b0e13 / #12161d), azul #339dff, verde #2fd39c. Existe tema claro, tema azul e um modo sem glow; a base tipográfica e a linguagem de forma não mudam.
- **Voz: recompensa, nunca culpa.** O app comemora, libera o jogo, cobra o *cliente* — nunca pune o usuário. Vale para todo texto, notificação e estado vazio, nos dois idiomas.
- Wordmark CRAVA em fonte pixel (Press Start 2P) registrado na spec de 2026-09-01; confirmar no código antes de estender.

## Evidence on Hand

- `README.md` e `LEIA-ME-AMIGOS.md`: copy real do produto, lista de funcionalidades, perguntas frequentes.
- `docs/specs/2026-09-01-cravado-v1-design.md`: spec de design da v1.
- Mockups aprovados (2026-09-01): https://claude.ai/code/artifact/f48d4cae-c512-45eb-8fa0-30913b877340
- `docs/novidades.json`: changelog completo, v1.0.1 → v1.3.4, nos dois idiomas.
- `assets/`: macaco em 6 cores, 51 artes de insígnia, ícones por cor, `clipboard-sheet.png`.
- Releases públicas: https://github.com/kauanlacerda/crava/releases — a v1.3.4 foi publicada em 2026-09-02 e ainda não tinha downloads na manhã de 2026-09-03.
- Relatos reais de bug em vídeo (Zakyen, 2026-09-02), já analisados e transformados em correções.

**Não existe** (não inventar): depoimentos, número de usuários, casos de sucesso, imprensa, benchmarks, preço (é grátis), avaliações.

## Product Principles

1. **Recompensa, nunca culpa.** Cada feedback do app é uma comemoração ou uma informação; nunca uma bronca. Quem leva bronca é o cliente devedor.
2. **Um por vez.** A interface reduz escolhas, não as amplia. Onde houver lista, há um "próximo" claro. Regras duras existem para eliminar paralisia, e sempre têm saída explícita.
3. **Dinheiro só é dinheiro quando cai.** Nenhum número finge certeza que não tem: "a converter", "sinal", "a liquidar" são estados de primeira classe, não notas de rodapé.
4. **Entrada sem custo de atenção.** Anotar um pedido nunca pode tirar a pessoa do trabalho atual: captura em segundos, sugestões prontas, sem trocar de janela.
5. **Calma visual é requisito funcional.** Para essa cabeça, tela piscando ou recarregando é distração real, não detalhe de acabamento. Nada re-renderiza sem motivo; toda mudança de estado é local, suave e previsível.

## Accessibility & Inclusion

O público-alvo tem TDAH como traço central. Isso se traduz em requisitos concretos já assumidos: zero flicker e zero recarga espontânea de tela; feedback imediato; carga de escolha baixa; modo sem glow para quem prefere discreto; textos curtos e diretos. Não há padrão formal (WCAG) adotado e o código atual não usa atributos ARIA — decisão em aberto, não uma escolha feita.
