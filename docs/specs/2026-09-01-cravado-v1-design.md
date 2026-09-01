# Cravado — especificação da v1

Data: 2026-09-01 · Status: aguardando aprovação do dono

## Problema

Freelancer de GFX Roblox (thumbnails), renda de R$ 10-30k/mês, com forte
dificuldade de foco (possível TDAH, em processo de acompanhamento médico) e de
retenção do dinheiro. Trabalhos chegam pelo Discord e são controlados de
cabeça. Padrão: começa trabalhos, interrompe para jogar/outras coisas, e gasta
quase tudo que ganha.

O app é **andaime comportamental**, não tratamento: reduz atrito para focar em
UM trabalho, dá dopamina pelas vias certas (streak, recompensa) e intercepta o
dinheiro no momento em que entra.

## Escopo da v1

### Janela principal ("Hoje")
- Lista de trabalhos do dia com pipeline: Aceito → Fazendo → Entregue → Aprovado → Pago
- **Um trabalho ATIVO por vez** — regra dura, o app impede dois "Fazendo"
- Fila do dia (próximos) e concluídos do dia
- Slots de capacidade (padrão 3): **slot só libera quando o trabalho é PAGO**
- Painel "Próximos prazos" ordenado por urgência (verde/amarelo/vermelho)
- Ganho do mês (soma dos pagos) no topo
- 🔥 Streak: dias seguidos batendo a meta diária

### Widget flutuante (always-on-top)
- Janela pequena (~360×208), sem moldura, arrastável, por cima de tudo
- Mostra: trabalho ativo, cronômetro da sessão, progresso do dia (2/5), botão
  "Concluir etapa", pausar, expandir para a janela principal

### Captura rápida
- Atalho global (padrão Ctrl+Shift+N) abre popup mínimo: título, cliente,
  valor, prazo → Enter salva como "Aceito" e fecha
- Funciona com o app minimizado na bandeja

### Regra do cofre
- Ao marcar um trabalho como Pago: popup "Entrou R$ X → separa R$ Y (Z%)"
- Percentual configurável (padrão 30%)
- Botão "Separei ✓" registra a confirmação (histórico de disciplina)

### Recompensa e alertas
- Bateu a meta do dia → tela "🎮 Jogo liberado, sem culpa"
- Notificação do Windows quando prazo < 24h (verificação a cada 30 min)
- Ícone na bandeja; fechar minimiza para a bandeja, não mata o app

## Fora da v1 (fase 2)
Integração Discord, bloqueio/detecção de apps, gráficos de ganhos, calendário
mensal, controle de gastos completo.

## Arquitetura

- **Electron** + HTML/CSS/JS puro (sem framework, sem build step) —
  iteração rápida, menos partes móveis
- **3 janelas**: principal, widget (frameless, alwaysOnTop), captura (frameless,
  invocada por globalShortcut)
- **Dados**: JSON local via `electron-store` em %APPDATA%/cravado — sem conta,
  sem nuvem
- **Empacotamento**: electron-builder → instalador .exe; opção "abrir com o
  Windows" nas configurações
- **Visual**: mockups aprovados no canvas "Cravado" (slate escuro, azul
  #339dff, verde #2fd39c, fonte Manrope, cantos 16-20px), baseado no design da
  agência Cube Graphics (uso autorizado pelo dono)

## Modelo de dados

```
Job:    { id, titulo, cliente, valor, prazo, status, criadoEm, pagoEm }
        status ∈ aceito | fazendo | entregue | aprovado | pago
Config: { metaDiaria: 5, slots: 3, percentCofre: 30, atalho: "Ctrl+Shift+N" }
Stats:  { streak, ultimoDiaMeta, cofre: [{data, valor, confirmado}] }
```

Regras derivadas (não gravadas): ganho do mês = soma de `valor` com `pagoEm`
no mês; progresso do dia = jobs que avançaram para entregue+ hoje vs meta.

## Testes
- Smoke manual guiado por checklist (abrir, criar job, ciclo completo do
  pipeline, captura via atalho, widget on-top sobre Photoshop, cofre, streak)
- Sem suíte automatizada na v1 (app local de usuário único; custo > benefício)

## Riscos e decisões
- OneDrive: projeto fica em C:\dev\cravado (fora do sync)
- Nome "Cravado" é provisório e trocável
- Cronômetro é informativo (não bloqueia nada) na v1
