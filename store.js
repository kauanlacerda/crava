// Persistência local em JSON (%APPDATA%/cravado/cravado-data.json).
// Camada única de dados — quando o sync com servidor (fase B) chegar,
// ele pluga aqui sem mudar o resto do app.
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  config: {
    metaDiaria: 5,
    slots: 3,
    cofrePct: 30,
    atalho: 'CommandOrControl+Shift+N',
    tema: 'escuro',
    cor: 'azul',
    idioma: 'pt',
    glowCards: true,
    cotacaoUSD: 5.4,        // reserva: só vale quando não dá pra buscar a cotação online
    cotacaoUSDauto: 0,      // última cotação vinda da internet
    cotacaoUSDautoEm: '',
    cotacaoRBX1k: 28,
    vizFundo: 'auto',       // fundo do gráfico de lucro: auto | preto | branco
    cofreGrad: 'azul',      // degradê do card do cofre
    palpiteCaptura: true,   // ler a janela em foco e o texto copiado na captura rápida
    metaInsignia: '',       // insígnia que a barra lateral está perseguindo   // ler a janela em foco e o texto copiado na captura rápida
    tutorialVisto: false,
    nome: 'você'
  },
  jobs: [],
  stats: {
    streak: 0,
    maxStreak: 0,
    ultimoDiaMeta: '',
    recompensaMostrada: '',
    historico: {},
    cofres: [],
    cofreRetiradas: [],
    notificados: {},
    insigniasGanhas: {},
    versaoVista: '',
    donoId: ''        // de qual conta são estes dados, pra não vazarem entre logins
  }
};

class Store {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'cravado-data.json');
    this.backupDir = path.join(userDataDir, 'backups');
    this.data = this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return {
        config: { ...DEFAULTS.config, ...raw.config },
        jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
        stats: { ...DEFAULTS.stats, ...raw.stats }
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  get() { return this.data; }

  set(data) {
    this.data = data;
    if (this.data && this.data.stats) this.data.stats.atualizadoEm = new Date().toISOString();
    this._gravar();
  }

  // Anotações que não são alteração de conteúdo (ex.: 'isto já subiu pra
  // nuvem') não podem renovar o carimbo, senão o app acharia que sempre há
  // trabalho novo pra enviar e nunca mais aceitaria dados de outro PC.
  setSemCarimbo(data) {
    this.data = data;
    this._gravar();
  }

  _gravar() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  // Backup diário automático (mantém os últimos 14)
  backupDiario() {
    try {
      fs.mkdirSync(this.backupDir, { recursive: true });
      const hoje = new Date().toISOString().slice(0, 10);
      const dest = path.join(this.backupDir, `cravado-${hoje}.json`);
      if (!fs.existsSync(dest) && fs.existsSync(this.file)) {
        fs.copyFileSync(this.file, dest);
        const todos = fs.readdirSync(this.backupDir).sort();
        while (todos.length > 14) fs.unlinkSync(path.join(this.backupDir, todos.shift()));
      }
    } catch { /* backup nunca derruba o app */ }
  }
}

module.exports = Store;
