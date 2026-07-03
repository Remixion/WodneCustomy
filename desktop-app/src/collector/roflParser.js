const path = require('path');

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

module.exports = { parseGameIdFromRoflFilename };
