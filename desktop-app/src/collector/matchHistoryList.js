/**
 * Pobiera z LOKALNEJ historii klienta League jedną "stronę" wyników (zakres
 * indeksów [begIndex, endIndex]) dla zalogowanego konta i mapuje ją na
 * uproszczony kształt. Historia jest posortowana od najnowszego meczu
 * (begIndex=0) do najstarszego. Dostępna niezależnie od tego, czy ta apka
 * była wtedy uruchomiona. Służy tylko do zbudowania listy wyboru w UI - pełne
 * dane meczu i tak są pobierane osobno przez buildMatchFromGameId przy
 * właściwym imporcie.
 */
async function fetchGamePage(client, puuid, begIndex, endIndex) {
  const data = await client.get(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=${begIndex}&endIndex=${endIndex}`);
  const rawGames =
    (data && data.games && Array.isArray(data.games.games) && data.games.games) ||
    (data && Array.isArray(data.games) && data.games) ||
    (Array.isArray(data) ? data : []);

  return rawGames
    .filter((g) => g && g.gameId)
    .map((g) => ({
      gameId: String(g.gameId),
      gameCreationDate: g.gameCreation ? new Date(g.gameCreation).toISOString() : '',
      gameDurationSec: g.gameDuration || 0,
      gameMode: g.gameMode || '',
      gameType: g.gameType || '',
      queueId: g.queueId,
      mapId: g.mapId,
    }));
}

/** Pobiera skróconą listę ostatnich `count` meczów. */
async function fetchRecentMatchSummaries(client, puuid, count = 20) {
  const games = await fetchGamePage(client, puuid, 0, Math.max(0, count - 1));
  return games.sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
}

/**
 * Jak fetchRecentMatchSummaries, ale zamiast stałej liczby meczów pobiera
 * WSZYSTKIE mecze od podanej daty (włącznie) do teraz - stronicując po
 * `pageSize` (żeby nie zakładać, ile meczów odda jedno zapytanie) i
 * przerywając, gdy trafi na mecz starszy niż `sinceDate` albo na pustą stronę
 * (koniec lokalnej historii klienta).
 *
 * Uwaga: to lokalny cache klienta League, nie serwerowa baza Riota - trzyma
 * ograniczoną liczbę ostatnich gier. Dla odległych dat lista może się urwać
 * wcześniej, niż faktyczna liczba rozegranych meczów by sugerowała, mimo że
 * te mecze się naprawdę odbyły.
 */
async function fetchMatchSummariesSince(client, puuid, sinceDate, { pageSize = 20, maxPages = 100 } = {}) {
  const sinceTime = new Date(sinceDate).getTime();
  const collected = [];
  let begIndex = 0;

  for (let page = 0; page < maxPages; page++) {
    const pageGames = await fetchGamePage(client, puuid, begIndex, begIndex + pageSize - 1);
    if (!pageGames.length) break;

    let reachedCutoff = false;
    for (const g of pageGames) {
      const created = new Date(g.gameCreationDate).getTime();
      if (Number.isFinite(created) && created < sinceTime) {
        reachedCutoff = true;
        break;
      }
      collected.push(g);
    }
    if (reachedCutoff || pageGames.length < pageSize) break;
    begIndex += pageSize;
  }

  return collected.sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
}

module.exports = { fetchRecentMatchSummaries, fetchMatchSummariesSince };
