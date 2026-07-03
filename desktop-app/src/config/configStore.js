const fs = require('fs');
const path = require('path');

/** Trwałe ustawienia aplikacji (URL Apps Script, sekret, ścieżki) zapisywane w pliku JSON. */
class ConfigStore {
  constructor(filePath, defaultDataDir) {
    this.filePath = filePath;
    this.defaults = {
      appsScriptUrl: '',
      sharedSecret: '',
      dataDir: defaultDataDir,
      customLockfilePath: '',
      autoSync: true,
      discordClientId: '',
    };
    this.data = this.load();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return { ...this.defaults, ...JSON.parse(raw) };
    } catch (err) {
      return { ...this.defaults };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  getAll() {
    return { ...this.data };
  }

  setAll(partial) {
    this.data = { ...this.data, ...partial };
    this.save();
    return this.getAll();
  }
}

module.exports = { ConfigStore };
