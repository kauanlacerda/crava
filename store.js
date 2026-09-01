// Persistência local em JSON (%APPDATA%/cravado/cravado-data.json).
// Camada única de dados — quando o sync com servidor (fase B) chegar,
// ele pluga aqui sem mudar o resto do app.
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  config: {
    metaDiaria: 5,
    metaMensal: 15000,
    slots: 3,
    cofrePct: 30,
    atalho: 'CommandOrControl+Shift+N',
    tema: 'escuro',
    cotacaoUSD: 5.4,
    cotacaoRBX1k: 28,
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
    notificados: {}
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
