const fs = require('fs');
const path = require('path');

function safeParseJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (err) {
    return fallback;
  }
}

/** Scala dwa obiekty klucz-po-kluczu: wartość z "next", chyba że jest null/undefined - wtedy z "prev". */
function mergePreferNonEmpty(prev, next) {
  const merged = {};
  new Set([...Object.keys(prev), ...Object.keys(next)]).forEach((key) => {
    const nextVal = next[key];
    merged[key] = nextVal === null || nextVal === undefined ? prev[key] : nextVal;
  });
  return merged;
}

/** Lokalny zapis danych jako pliki JSON: jeden plik na mecz + jeden zbiorczy plik graczy. */
class LocalStore {
  constructor(baseDir) {
    this.setBaseDir(baseDir);
  }

  setBaseDir(baseDir) {
    this.baseDir = baseDir;
    this.matchesDir = path.join(baseDir, 'matches');
    this.playersFile = path.join(baseDir, 'players.json');
    fs.mkdirSync(this.matchesDir, { recursive: true });
    if (!fs.existsSync(this.playersFile)) fs.writeFileSync(this.playersFile, '[]', 'utf8');
  }

  saveMatch(match, players) {
    const file = path.join(this.matchesDir, `${match.matchId}.json`);
    fs.writeFileSync(file, JSON.stringify({ match, players }, null, 2), 'utf8');
  }

  /**
   * Jak saveMatch, ale jeśli ten mecz był już zapisany wcześniej, scala nowe
   * dane ze starymi zamiast je nadpisywać w ciemno - tak żeby ponowny import
   * (np. przycisk "Importuj ponownie") nie kasował rzeczy niedostępnych przy
   * tym konkretnym pobraniu: przede wszystkim eogStatsBlock wewnątrz
   * rawDataJson (dostępny tylko przy żywym przechwytywaniu, nie przy
   * imporcie z historii/pliku .rofl) oraz ręcznie wpisane notatki (meczu
   * i poszczególnych graczy).
   */
  saveMatchPreservingData(match, players) {
    const existing = this.getMatch(match.matchId);
    if (existing) {
      if (!match.notes && existing.match.notes) {
        match.notes = existing.match.notes;
      }
      // gid (numer z ręcznie prowadzonego arkusza ligi) nie jest znany przez
      // żaden inny sposób pozyskania danych (żywe przechwytywanie, historia
      // klienta, skaner) - gdyby taki mecz został later ponownie zaimportowany
      // stamtąd, nowy obiekt nie ma pola gid w ogóle i bez tego trzeba by je
      // odtworzyć ręcznie.
      if (!match.gid && existing.match.gid) {
        match.gid = existing.match.gid;
      }

      const oldRaw = safeParseJson(existing.match.rawDataJson, {});
      const newRaw = safeParseJson(match.rawDataJson, {});
      match.rawDataJson = JSON.stringify(mergePreferNonEmpty(oldRaw, newRaw));

      const existingPlayerByPuuid = {};
      (existing.players || []).forEach((p) => {
        if (p.puuid) existingPlayerByPuuid[p.puuid] = p;
      });
      players.forEach((p) => {
        const prevPlayer = p.puuid && existingPlayerByPuuid[p.puuid];
        if (prevPlayer && !p.notes && prevPlayer.notes) {
          p.notes = prevPlayer.notes;
        }
      });
    }

    this.saveMatch(match, players);
  }

  listMatches() {
    if (!fs.existsSync(this.matchesDir)) return [];
    return fs
      .readdirSync(this.matchesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.matchesDir, f), 'utf8')))
      .sort((a, b) => new Date(b.match.gameCreationDate) - new Date(a.match.gameCreationDate));
  }

  getMatch(matchId) {
    const file = path.join(this.matchesDir, `${matchId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  /**
   * Przelicza `gid` (numer porządkowy, 1 = najstarszy mecz) dla WSZYSTKICH
   * lokalnie zapisanych meczów na podstawie `gameCreationDate` - niezależnie
   * od źródła (arkusz ligi, żywe przechwytywanie, historia klienta, .rofl,
   * skaner). Dzięki temu nowo dodany mecz zawsze wskakuje na właściwe
   * miejsce w chronologii całej ligi, nawet jeśli jego data wypada między
   * już ponumerowanymi meczami - co oznacza, że gid już istniejących meczów
   * może się przy tym przesunąć (to zamierzone, nie błąd).
   * Zwraca listę zmienionych wpisów { matchId, gid }, żeby wywołujący mógł
   * zsynchronizować z Arkuszem tylko te, które faktycznie się zmieniły.
   */
  recomputeAllGids() {
    const sortedOldestFirst = this.listMatches().reverse();
    const changed = [];
    sortedOldestFirst.forEach(({ match }, index) => {
      const newGid = String(index + 1);
      if (String(match.gid || '') !== newGid) {
        this.updateMatchField(match.matchId, 'gid', newGid);
        changed.push({ matchId: match.matchId, gid: newGid });
      }
    });
    return changed;
  }

  updateMatchField(matchId, field, value) {
    const data = this.getMatch(matchId);
    if (!data) return false;
    data.match[field] = value;
    fs.writeFileSync(path.join(this.matchesDir, `${matchId}.json`), JSON.stringify(data, null, 2), 'utf8');
    return true;
  }

  updateMatchPlayerField(matchId, puuid, field, value) {
    const data = this.getMatch(matchId);
    if (!data) return false;
    const player = data.players.find((p) => p.puuid === puuid);
    if (!player) return false;
    player[field] = value;
    fs.writeFileSync(path.join(this.matchesDir, `${matchId}.json`), JSON.stringify(data, null, 2), 'utf8');
    return true;
  }

  deleteMatch(matchId) {
    const file = path.join(this.matchesDir, `${matchId}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  }

  listPlayers() {
    if (!fs.existsSync(this.playersFile)) return [];
    return JSON.parse(fs.readFileSync(this.playersFile, 'utf8'));
  }

  /** Scala nowo pobrane dane profilu z istniejącymi wpisami, zachowując ręczne notatki, nick i kolor. */
  upsertPlayers(freshPlayers) {
    const existing = this.listPlayers();
    const byPuuid = {};
    existing.forEach((p) => (byPuuid[p.puuid] = p));
    freshPlayers.forEach((p) => {
      const prev = byPuuid[p.puuid] || {};
      byPuuid[p.puuid] = { ...prev, ...p, notes: prev.notes || '', nick: prev.nick || '', color: prev.color || '' };
    });
    const merged = Object.values(byPuuid);
    fs.writeFileSync(this.playersFile, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  updatePlayerField(puuid, field, value) {
    const players = this.listPlayers();
    const player = players.find((p) => p.puuid === puuid);
    if (!player) return false;
    player[field] = value;
    fs.writeFileSync(this.playersFile, JSON.stringify(players, null, 2), 'utf8');
    return true;
  }

  deletePlayer(puuid) {
    const players = this.listPlayers().filter((p) => p.puuid !== puuid);
    fs.writeFileSync(this.playersFile, JSON.stringify(players, null, 2), 'utf8');
    return true;
  }
}

module.exports = { LocalStore };
