const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_REPLAYS_CANDIDATES = [
  path.join(os.homedir(), 'Documents', 'League of Legends', 'Replays'),
  'C:/Riot Games/League of Legends/Replays',
];

/** Próbuje wykryć domyślny folder Replays klienta League (jeśli istnieje). */
function detectDefaultReplaysFolder() {
  return DEFAULT_REPLAYS_CANDIDATES.find((p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch (err) {
      return false;
    }
  }) || null;
}

/** Listuje pliki .rofl w podanym folderze (bez podfolderów) wraz z odczytanym z nazwy gameId. */
function listRoflFilesInFolder(folderPath) {
  if (!folderPath) return [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Nie udało się odczytać folderu "${folderPath}": ${err.message}`);
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.rofl'))
    .map((e) => {
      const filePath = path.join(folderPath, e.name);
      return {
        filePath,
        fileName: e.name,
        gameId: parseGameIdFromRoflFilename(filePath),
        mtime: fs.statSync(filePath).mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

/**
 * Import meczów z plików .rofl (replay League of Legends).
 *
 * Plik .rofl jest formatem nieoficjalnym, regularnie zmienianym przez Riota.
 * Sprawdzono bezpośrednie parsowanie jego zawartości binarnej na realnych
 * plikach z aktualnej wersji klienta - okazało się niewiarygodne (struktura
 * nie odpowiada powszechnie cytowanej dokumentacji społeczności). Co więcej,
 * od patcha 13.20 Riot i tak usunął z tych plików szczegółowe statystyki
 * graczy (pole "statsJson" jest puste - zgłoszony, nigdy niezałatany błąd:
 * https://github.com/RiotGames/developer-relations/issues/831), więc nawet
 * poprawne odtworzenie starego formatu nie dałoby pełnych danych.
 *
 * Zamiast tego wykorzystujemy nazwę pliku, którą klient League zapisuje
 * w postaci "<PLATFORMA>-<gameId>.rofl" (np. "EUN1-3880767863.rofl") - i na
 * jej podstawie pobieramy PEŁNE dane meczu tym samym, sprawdzonym sposobem
 * co przy automatycznym przechwytywaniu (buildMatchFromGameId), o ile klient
 * League jest uruchomiony i ma dostęp do historii tej gry. Zweryfikowane
 * działa to również dla meczów sprzed wielu miesięcy.
 */
function parseGameIdFromRoflFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const match = base.match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

module.exports = { parseGameIdFromRoflFilename, detectDefaultReplaysFolder, listRoflFilesInFolder };
