const fs = require('fs');
const path = require('path');

/**
 * Trwały bufor Game ID znalezionych przez skaner zakresu, ale jeszcze nie
 * zaimportowanych. Bez tego znalezione mecze żyły tylko w pamięci okna
 * renderera (wysyłane jednorazowo przez zdarzenie scanner:progress) - awaria
 * zasilania/crash apki między znalezieniem a kliknięciem "Importuj" gubiła je
 * bezpowrotnie, bo wznowienie skanowania rusza dalej od ostatniego
 * sprawdzonego ID i nigdy ponownie nie sprawdza tych samych ID.
 */
class ScanFoundStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  list() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      return [];
    }
  }

  /** Dodaje/nadpisuje wpisy po gameId - bezpieczne wywoływanie wielokrotnie dla tych samych meczów. */
  add(games) {
    if (!games || !games.length) return;
    const byId = {};
    this.list().forEach((g) => { byId[g.gameId] = g; });
    games.forEach((g) => { byId[g.gameId] = g; });
    this._save(Object.values(byId));
  }

  /** Usuwa wpis po zaimportowaniu (albo połączeniu z meczem legacy) - nie ma już czego przechowywać. */
  remove(gameId) {
    this._save(this.list().filter((g) => String(g.gameId) !== String(gameId)));
  }

  _save(games) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(games, null, 2), 'utf8');
  }
}

module.exports = { ScanFoundStore };
