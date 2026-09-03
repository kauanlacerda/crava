# Auditoria técnica — Crava v1.3.4 (+ correção local do fundo do gráfico)

Data: 2026-09-03 · Método: `/impeccable audit` · Escopo: `renderer/` (index.html, styles.css, app.js, capture.html, widget.html)

Como foi medido: detector mecânico do Impeccable (modo degradado: sem parser HTML/CSS, portanto subcontagem), contagens estáticas no código, e **medição ao vivo** num perfil isolado (`%TEMP%\crava-viz`, nunca o perfil real) via Chrome DevTools Protocol: contraste computado de cada texto visível nas 6 abas × 2 temas, elementos focáveis, alvos pequenos, comportamento de tokens ao trocar a cor do mascote.

## Placar

| # | Dimensão | Nota | Achado principal |
|---|---|---|---|
| 1 | Acessibilidade | **1**/4 | Nenhum `<button>`, nenhum `tabindex`: 156 controles clicáveis inalcançáveis por teclado. Token `--faint` a 2,9:1 (escuro) e 2,4:1 (claro) |
| 2 | Performance | **2**/4 | Qualquer `salvar()` refaz a aba inteira (medido hoje: 2 renders + 14 mutações pra trocar uma cor). `backdrop-filter` por célula do calendário sobre GIF |
| 3 | Responsivo | **3**/4 | Alvo é desktop 1020×660+; 4 media queries; quadro com colunas fixas rola na horizontal no mínimo. Não medido em 1020×660 |
| 4 | Tematização | **3**/4 | 74 tokens, 421 usos, 2 temas × 6 cores. Gradiente azul fixo em logo/avatar ignora a cor do mascote; fontes vêm do Google em tempo de execução |
| 5 | Integridade da implementação | **3**/4 | Sistema coerente e específico do produto. Atalho sistêmico: `div.btn` no lugar de `<button>` |
| | **Total** | **12/20** | **Aceitável — trabalho significativo, concentrado em acessibilidade** |

## Veredito de integridade: PASSA

A implementação expressa um sistema próprio, não intercambiável: vocabulário do produto no DOM e no CSS (`.kb-*`, `.cofre-*`, `.insignia-*`, `.pipe-label`), 74 custom properties com paleta por tema e por cor de mascote, canvas para gráficos e card. O detector rodou degradado (sem `htmlparser2`/`css-tree`) e apontou 5 transições de layout — todas barras de progresso animando `width`, legítimas — mais um aviso de travessões no texto (voz do autor, não slop) e uma imagem "quebrada" que na verdade fica oculta até receber `src` (falso positivo). O único atalho repetido de verdade é estrutural: 35 `<div class="btn">` no HTML e 0 `<button>`, o que puxa a nota 1 pra baixo.

## Resumo

- Placar: **12/20** (Aceitável)
- Problemas: **P0** 0 · **P1** 3 · **P2** 6 · **P3** 4
- Os 3 críticos: teclado inoperante; contraste do `--faint`/`--muted`; re-render total a cada salvamento
- Próximos passos: `/impeccable harden` (teclado + nomes + labels), `/impeccable colorize` (tokens de contraste), `/impeccable optimize` (render local por mudança)

## Achados por severidade

### P1 — corrigir antes da próxima versão

**[P1] Nada além dos campos de formulário é alcançável por teclado**
- Onde: `renderer/index.html` (35 `div.btn`, `div.nav-item`), `renderer/app.js` (templates de `.kb-card`, `.job-row`, `.mini-btn`, `.badge-chip.click`, `.tema-opt`, `.cor-opt`, `.toggle`)
- Categoria: Acessibilidade
- Medido: `buttons: 0, tabindex: 0, links: 0, inputs: 32, divsClicaveis: 156, focusVisibleCSS: false`
- Impacto: quem navega por Tab só chega nos inputs. Trocar de aba, cravar, marcar entregue, abrir o cofre, mudar tema: tudo exige mouse. Leitor de tela não anuncia nenhum controle como botão. Também derruba os atalhos que já existem (Ctrl+K, Ctrl+C/V nos cards) porque o foco nunca está num card.
- WCAG: 2.1.1 Teclado (A), 4.1.2 Nome, Função, Valor (A), 2.4.7 Foco visível (AA)
- Recomendação: trocar `div.btn`/`div.mini-btn`/`div.nav-item` por `<button type="button">` mantendo as classes (o CSS já é por classe; `button { all: unset }` ou reset de `font: inherit; border: 0; background: none` resolve). Cards e linhas: `tabindex="0"` + `role="button"` + Enter/Espaço no handler. Um único `:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px }` global.
- Comando: `/impeccable harden`

**[P1] Token `--faint` está abaixo do mínimo nos dois temas; `--muted` falha no claro**
- Onde: `renderer/styles.css:12-13` (escuro `--muted #8b98a9`, `--faint #5a6676`), `:39-40` (claro `--muted #64748b`, `--faint #94a3b8`)
- Categoria: Acessibilidade / Tematização
- Medido ao vivo (texto sobre o fundo opaco real):

  | Elemento | Tamanho | Escuro | Claro | Mínimo |
  |---|---|---|---|---|
  | `.meta-vazia`, `.kbd-chip`, `.badge-chip` neutro, `.kb-col-soma`, `.kb-vazio`, `.insignia-data`, `.pipe-label` pendente (todos `--faint`) | 10–12px | **2,93:1** | **2,41:1** | 4,5:1 |
  | `.btn-ghost`, `.mini-btn` (`--muted` sobre `--panel2`) | 12px | 5,83:1 ✓ | **4,47:1** | 4,5:1 |
  | `.section-label` (`--muted` sobre `--bg`) | 13px | 6,59:1 ✓ | **4,32:1** | 4,5:1 |
  | `.pipe-label.done` (`--green` claro sobre branco) | 10px | 9,43:1 ✓ | **3,77:1** | 4,5:1 |

- Impacto: é justamente o texto de estado ("Não pago", "falta receber R$…", "conquistada em…", "Escolha uma meta") que fica ilegível — e ele está em 10–12px, onde o contraste pesa mais. No tema claro até os botões secundários falham.
- WCAG: 1.4.3 Contraste mínimo (AA)
- Recomendação: subir `--faint` para ~`#7c8798` (escuro, ≈4,6:1 sobre `--panel2`) e ~`#6b7a90` (claro); `--muted` claro para ~`#556274`; `--green` claro para `#047857` ou usar `--green` só em ≥14px bold. Se `--faint` for intencionalmente "quase invisível" (decorativo), então nenhum texto informativo pode usá-lo — hoje 7 classes usam.
- Comando: `/impeccable colorize`

**[P1] Todo `salvar()` refaz a aba aberta inteira**
- Onde: `renderer/app.js` — `salvar()` → `render()`; 27 pontos de `innerHTML =`; handlers de preferência (`temaPicker`, `corPicker`, `cofreGrad`, `lentePicker` etc.) chamam `await salvar()`
- Categoria: Performance (e princípio 5 do produto: calma visual)
- Medido hoje: o botão de fundo do gráfico, no código publicado, disparava 2 renders completos e 14 mutações de DOM em painéis vizinhos por clique; corrigido localmente para 0/0 gravando em silêncio e redesenhando só o canvas. Os demais pickers seguem no padrão antigo.
- Impacto: é a família de bugs que o usuário e o Zakyen mais reportam ("pisca", "recarrega do nada", "comprime"). Cada um foi corrigido pontualmente (idle renders, GIF do calendário, badge, fundo do gráfico); a causa estrutural continua.
- Recomendação: separar `salvar()` (persistir + sincronizar) de `render()`; cada handler declara o que mudou e chama o renderer daquela região (`renderCarteira`, `desenharViz`, `renderKanban`…). Como padrão de transição: `salvar({ render: false })` + chamada local, igual ao que a cotação e o `vizFundo` já fazem.
- Comando: `/impeccable optimize`

### P2 — próxima passada

**[P2] Labels não estão associadas aos campos**
- Onde: `renderer/index.html` — 16 `<label>`, 0 com `for=`, 0 envolvendo o input; 13 campos dependem de `placeholder` como nome; medido ao vivo: 5 controles sem nome acessível em Configurações, 2 em Finanças (slider de opacidade e seletores de cor)
- Categoria: Acessibilidade · WCAG 1.3.1, 3.3.2, 4.1.2
- Impacto: leitor de tela lê "editar texto" sem dizer o quê; clicar na label não foca o campo.
- Recomendação: `for`/`id` em cada par; `aria-label` nos controles só-ícone (`#midiaOpacidade`, opções de cor, `.fundo-opt`).
- Comando: `/impeccable harden`

**[P2] Nenhuma resposta a `prefers-reduced-motion`**
- Onde: `renderer/styles.css` — 12 `@keyframes`, 20 `animation:` (`celebra-*`, `confete-voa`, `pulsoVivo`, `piscaCard`, `tutPula`), 0 `prefers-reduced-motion`
- Categoria: Acessibilidade · WCAG 2.3.3 (AAA, mas central pro público do produto)
- Impacto: o público-alvo é TDAH; o app já tem "modo sem glow" e a classe `.sem-anim` (linha 1203) — só não escuta a preferência do sistema.
- Recomendação: `@media (prefers-reduced-motion: reduce)` aplicando as mesmas regras de `.sem-anim`, preservando mudança de estado (opacidade sem deslocamento) em vez de matar tudo com `0.01ms`.
- Comando: `/impeccable animate`

**[P2] `backdrop-filter` por célula do calendário sobre GIF animado**
- Onde: `renderer/styles.css:859` `.cal-panel.com-fundo .cal-cell { backdrop-filter: blur(2px) }`; mais `blur(14px)` em 869/875/970/974
- Categoria: Performance
- Impacto: até 35 células, cada uma com um blur próprio, compostas sobre um canvas que redesenha quadros de GIF. É o cenário do "flick" já investigado no calendário. GPU integrada de amigo vai sentir.
- Recomendação: um único véu com blur no painel (não por célula), ou blur pré-aplicado no canvas do fundo (`ctx.filter`), zero `backdrop-filter` em elementos repetidos.
- Comando: `/impeccable optimize`

**[P2] Gradiente azul fixo em logo e avatares ignora a cor do mascote**
- Onde: `renderer/styles.css:82` `.logo-mark`, `:319` `.user-avatar`, `:331` `.perfil-avatar` — `linear-gradient(135deg, #339dff, #1f6fd9)`
- Categoria: Tematização
- Medido: com `data-cor="vermelho"`, `--blue` vira `#ff6b5e` e `.btn-primary`/`.nav-item.active` acompanham; os três gradientes ficam azuis. (No teste o avatar tinha foto, então o fallback não apareceu; o CSS é incondicional.)
- Impacto: "macaco em 6 cores muda o app inteiro junto" é compromisso de marca; quem não tem foto vê um círculo azul num app vermelho.
- Recomendação: `linear-gradient(135deg, var(--vivid-blue-a), var(--vivid-blue-b))` — os tokens já existem por cor (linhas 650–660).
- Comando: `/impeccable polish`

**[P2] Fontes da marca carregam do Google em tempo de execução**
- Onde: `renderer/index.html:6` — Manrope (4 pesos), Baloo 2, Press Start 2P via `fonts.googleapis.com`, `display=swap`
- Categoria: Tematização / Performance
- Impacto: o README promete "100% offline"; sem rede, a tipografia inteira cai pra Segoe UI e o wordmark pixel desaparece. Com rede, há troca visível de fonte no primeiro quadro (FOUT) — mais uma "piscada" na abertura. Também é a única dependência de rede fora do Supabase.
- Recomendação: baixar os `.woff2` para `assets/fonts/` e declarar `@font-face` local com `font-display: block` para o wordmark e `swap` para o corpo; remover o `<link>`.
- Comando: `/impeccable typeset`

**[P2] Sem marcos nem cabeçalhos semânticos**
- Onde: `renderer/index.html` — 0 `<h1>–<h3>`, 0 `<main>/<nav>/<header>`
- Categoria: Acessibilidade · WCAG 1.3.1, 2.4.1
- Impacto: leitor de tela não tem por onde pular; a barra lateral não é anunciada como navegação.
- Recomendação: `<nav aria-label="Abas">` na sidebar, `<main>` na área de conteúdo, um `<h1>` visualmente igual ao título de cada aba.
- Comando: `/impeccable harden`

### P3 — se sobrar tempo

- **[P3] `transition: all`** em `.nav-item, .badge-chip, .mini-btn, .cobrador-btn, .toggle, .fundo-opt` (`styles.css:552`) e mais 3 pontos (1120, 1327, 1557). Anima layout sem querer; listar propriedades (`background-color, color, border-color, transform`). Comando: `/impeccable animate`
- **[P3] Quadro com colunas fixas no mínimo da janela**: `repeat(4, 220px)` ≤1280px (`styles.css:1200`) → 916px de quadro numa área de ~740px em 1020×660; rola na horizontal por `overflow-x: auto`. Funciona, mas na janela mínima a 4ª coluna nasce escondida. Não medido ao vivo. Comando: `/impeccable adapt`
- **[P3] Alvos finos**: `input#searchInput` 19px de altura (o wrapper é maior), `input#midiaOpacidade` 16px. Desktop com mouse tolera; teclado não é o problema aqui. Comando: `/impeccable polish`
- **[P3] Detector: `#userBadge` com `alt=""` e sem `src`** — fica `display:none` até ter insígnia; falso positivo funcional, mas um `hidden` explícito evita o aviso. Comando: `/impeccable polish`

## Padrões sistêmicos

1. **Interatividade em `<div>`.** 156 controles, 0 botões nativos. Não é um esquecimento pontual: é o padrão de construção do app. Cada correção de a11y vai bater nisso primeiro.
2. **Um `render()` pra tudo.** Estado muda → aba inteira é reconstruída por `innerHTML`. Toda a saga de flicker desta semana é sintoma disso. Cada fix pontual (cotação, `vizFundo`) mostra o caminho: gravar em silêncio, redesenhar a região.
3. **Escala tipográfica pequena com tokens fracos.** Metade dos textos de estado tem 10–12px e usa `--faint`. Tamanho pequeno + contraste baixo se multiplicam.

## O que está bom e deve ser mantido

- **Sistema de tokens sério**: 74 custom properties, 421 usos, dois temas completos e seis cores de mascote por `data-cor`, com variantes claro/escuro por cor. Praticamente zero cor solta fora dos tokens (os `#fff` sobre cartões sólidos são intencionais).
- **Tratamento de movimento já existe**: `silenciarAnimacoes()` + `.sem-anim` + modo sem glow. Falta só ligar ao sistema operacional.
- **Canvas gated por aba**: `desenharViz` só desenha com largura > 0; gráficos não rodam escondidos. Medido hoje: 0 renders em 20s de idle em 6 abas.
- **Todas as 15 imagens têm `alt`.**
- **`will-change` usado uma vez, no lugar certo** (celebração). Sem abuso.
- **Vocabulário do produto no código**: nomes de classe e funções em português do domínio (`cravar`, `cofre`, `cobrador`, `fila`). Facilita manter a voz "recompensa, nunca culpa" consistente.

## Ações recomendadas, em ordem

1. **[P1] `/impeccable harden`** — botões nativos + `tabindex`/`role` em cards, `:focus-visible` global, labels com `for`, `aria-label` nos controles de ícone, `<nav>`/`<main>`/`<h1>`. Resolve os dois maiores buracos de acessibilidade de uma vez.
2. **[P1] `/impeccable colorize`** — recalibrar `--faint`, `--muted` (claro) e `--green` (claro) contra os fundos reais; revisar quais das 7 classes que usam `--faint` são informativas.
3. **[P1] `/impeccable optimize`** — separar persistir de renderizar; renderers por região; trocar `backdrop-filter` por célula por um véu único no calendário.
4. **[P2] `/impeccable animate`** — `prefers-reduced-motion` mapeado ao `.sem-anim`; substituir os 4 `transition: all`.
5. **[P2] `/impeccable typeset`** — fontes locais em `assets/fonts/`, `@font-face`, fim do FOUT e da dependência de rede.
6. **[P2] `/impeccable polish`** — gradientes de logo/avatar nos tokens `--vivid-blue-*`, `#userBadge hidden`, alvos finos.
7. **[P3] `/impeccable adapt`** — conferir o quadro em 1020×660.
8. **`/impeccable polish`** — passada final depois de tudo.
