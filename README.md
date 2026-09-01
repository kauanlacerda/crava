<div align="center">

<img src="assets/macaco/azul/macaco-03.png" width="120" alt="Crava">

# CRAVA

**O app de foco pra quem vive de comissão — um trabalho por vez, o dinheiro no lugar certo, e um macaco que comemora com você.**

[![License: MIT](https://img.shields.io/badge/License-MIT-339dff.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.x-2fd39c.svg)](https://electronjs.org)
[![Platform](https://img.shields.io/badge/Windows-10%2F11-0078D6.svg)]()
[![Idiomas](https://img.shields.io/badge/PT--BR%20%2F%20EN-f5b74e.svg)]()

[⬇️ Baixar a última versão](https://github.com/kauanlacerda/crava/releases/latest)

</div>

---

## O que é isso

O Crava nasceu de um problema real: dá pra faturar bem fazendo GFX pra Roblox e mesmo assim **não terminar nada e não sobrar dinheiro no fim do mês**. Cinco comissões abertas, você joga no meio de todas; o cliente paga em Robux, você vende um mês depois e nem lembra quanto entrou.

Ele resolve as duas pontas: **só um trabalho ativo por vez** (acabou a paralisia de escolher) e **cada centavo rastreado** — de "não pago" até "caiu na conta", passando por sinal de 50%, venda de Robux e PayPal.

Funciona 100% offline. Cria uma conta e seus trabalhos te seguem pra qualquer PC.

## Funcionalidades

### Foco
| | |
|---|---|
| 🎯 **Um por vez** | Só um trabalho ativo. Cravar em outro pausa o anterior sozinho |
| 🪟 **Widget flutuante** | Janelinha sempre por cima com o trabalho atual, cronômetro e progresso do dia — funciona por cima do Photoshop |
| ⚡ **Captura rápida** | `Ctrl+Shift+N` de qualquer lugar: anota o pedido em 5 segundos sem sair do que está fazendo |
| 📋 **Quadro por etapa** | Esperando pagamento → Na fila → Fazendo → Entregue, com arrastar e soltar |
| 🎮 **Meta diária** | Bateu a meta, o app libera o jogo sem culpa |
| 🔥 **Streak** | Dias seguidos batendo a meta — a dopamina jogando a seu favor |
| 🎰 **Slots** | Limite de trabalhos aceitos ao mesmo tempo; o slot só libera quando o dinheiro cai |
| ⏰ **Alerta de prazo** | Notificação quando falta menos de 24h |

### Dinheiro
| | |
|---|---|
| 💵 **Três moedas** | Pix (R$), Robux e PayPal (US$), com cotações que você define |
| 🤝 **Sinal de 50%** | Registra pagamento parcial e mostra quanto falta |
| 💱 **Vendi / Caiu** | Robux e PayPal ficam "a converter" até você confirmar quanto entrou de verdade |
| 🐷 **Cofre** | Quando o dinheiro cai, o app lembra quanto separar (a % é sua) — e cobra se você deixar pra depois |
| 📣 **Cobrador** | Avisa quem está devendo há dias: "cobra o fulano" |
| 💳 **Carteira** | Guardado × livre na conta × a liquidar, em cartões que giram |
| 🔄 **Conversor** | Entre as três moedas, com cotação do dólar buscada online |

### Visão
| | |
|---|---|
| 📅 **Calendário de lucro** | Quanto entrou em cada dia do mês, com melhor dia e sequência |
| 📈 **Fluxo mensal** | Gráfico do faturamento ao longo dos meses |
| 🍩 **Moedas do mês** | Quanto cada moeda representou |
| 📊 **Histórico** | Entregas, atrasos e ganhos mês a mês |

### Coleção e identidade
| | |
|---|---|
| 🏅 **51 insígnias** | Macaquinhos em pixel art que evoluem — de "Primeiro Crava" a "Deus do Robux" |
| 🖼️ **Card do mês** | Seu faturamento num card bonito pra postar, com foto ou GIF de fundo |
| 🐵 **Macaco em 6 cores** | Azul, vermelho, verde, roxo, laranja e branco — muda o app inteiro junto |
| 🌗 **Tema claro/escuro** | E um modo sem glow, se preferir discreto |
| 🌎 **PT-BR / EN** | Interface completa nos dois |

### Plataforma
| | |
|---|---|
| ☁️ **Conta e sincronização** | Entra e seus trabalhos aparecem em qualquer PC |
| 📴 **Offline de verdade** | Tudo salvo no seu PC; a nuvem é só um espelho |
| 🔒 **Privado** | Cada conta só enxerga os próprios dados — garantido pelo banco |
| 💾 **Backup automático** | Cópia diária local dos últimos 14 dias |

## Instalação

1. Baixa o instalador na [página de releases](https://github.com/kauanlacerda/crava/releases/latest)
2. Dois cliques e segue o instalador
3. Abre pelo atalho na área de trabalho

> O Windows mostra um aviso azul porque o instalador não tem assinatura digital paga.
> Clica em **Mais informações** → **Executar assim mesmo**.

## Rodar do código

```bash
git clone https://github.com/kauanlacerda/crava.git
cd crava
npm install
npm start
```

Pra gerar o instalador:

```bash
npm run build
```

Se quiser sua própria nuvem, roda o `docs/supabase-schema.sql` num projeto [Supabase](https://supabase.com) e troca a URL e a chave em `renderer/nuvem.js`.

## Como é feito

Electron com HTML, CSS e JavaScript puro — sem framework, sem build step. Os dados ficam num JSON local e sincronizam com Supabase (Postgres + Auth), com as regras de acesso no próprio banco.

Os gráficos, o card e o calendário são desenhados em canvas, e o GIF animado é montado quadro a quadro na hora de exportar.

## Licença

MIT — usa, modifica e distribui à vontade.

---

<div align="center">

Feito por **[sak](https://github.com/kauanlacerda)** 🐵

</div>
