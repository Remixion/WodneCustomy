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
 * Wcześniej zakładaliśmy (na bazie https://github.com/RiotGames/developer-relations/issues/831),
 * że pole "statsJson" w metadanych pliku jest zawsze puste - stąd jedyną
 * drogą było wyciągnięcie gameId z nazwy pliku ("<PLATFORMA>-<gameId>.rofl",
 * np. "EUN1-3880767863.rofl") i pobranie pełnych danych z lokalnej historii
 * klienta (buildMatchFromGameId). Sprawdzone jednak na realnych plikach z tej
 * wersji klienta: "statsJson" bywa jak najbardziej wypełnione - patrz
 * extractEmbeddedStats poniżej. Historia klienta ma za to inne ograniczenie:
 * zwraca dane tylko dla gier, w których brało udział aktualnie zalogowane
 * konto - dla nagrań cudzych meczów (np. hostowania/obserwowania customów)
 * kończy się błędem. Dlatego import próbuje najpierw historii klienta (pełniejszy
 * kształt danych - osobne bany drużynowe), a dopiero w razie błędu sięga po
 * statystyki zaszyte w samym pliku .rofl.
 */
function parseGameIdFromRoflFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const match = base.match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

/**
 * Wyciąga z pliku .rofl zaszyty w nim blok metadanych JSON (zawierający m.in.
 * "gameLength" i "statsJson") bez pełnego parsowania binarnego formatu -
 * metadane są zapisane jako czytelny tekst JSON, więc wystarczy znaleźć jego
 * granice w treści pliku. "statsJson" to zagnieżdżony string JSON z tablicą
 * uczestników w tym samym płaskim formacie WIELKIMI_LITERAMI co przy imporcie
 * starych plików JSON (zobacz legacyJsonParser.js) - stąd współdzielimy z nim
 * buildMatchFromLegacyJson do zbudowania meczu/graczy z tych danych.
 * Zwraca null, jeśli metadanych/statsJson nie udało się znaleźć albo sparsować
 * (np. starszy klient, dla którego pole faktycznie jest puste).
 */
function extractEmbeddedStats(filePath) {
  const buf = fs.readFileSync(filePath);
  const text = buf.toString('latin1');
  const marker = '"gameLength"';
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return null;

  let start = markerIdx;
  while (start > 0 && text[start] !== '{') start--;

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  let meta;
  try {
    meta = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return null;
  }
  if (!meta.statsJson) return null;

  let participants;
  try {
    participants = JSON.parse(meta.statsJson);
  } catch (err) {
    return null;
  }
  if (!Array.isArray(participants) || !participants.length) return null;

  return { gameLength: meta.gameLength, participants };
}

module.exports = {
  parseGameIdFromRoflFilename,
  detectDefaultReplaysFolder,
  listRoflFilesInFolder,
  extractEmbeddedStats,
};
