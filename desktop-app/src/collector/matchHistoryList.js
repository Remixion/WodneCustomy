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
      isCustom: g.gameType === 'CUSTOM_GAME' || g.queueId === 0,
    }));
}

function dedupeByGameId(games) {
  const seen = new Set();
  return games.filter((g) => {
    if (seen.has(g.gameId)) return false;
    seen.add(g.gameId);
    return true;
  });
}

/** Pobiera skróconą listę ostatnich `count` meczów. */
async function fetchRecentMatchSummaries(client, puuid, count = 20) {
  const games = await fetchGamePage(client, puuid, 0, Math.max(0, count - 1));
  return dedupeByGameId(games).sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
}

/**
 * Jak fetchRecentMatchSummaries, ale zamiast stałej liczby meczów pobiera
 * WSZYSTKIE mecze od podanej daty (włącznie) do teraz - stronicując po
 * `pageSize` (żeby nie zakładać, ile meczów odda jedno zapytanie) i
 * przerywając, gdy trafi na mecz starszy niż `sinceDate` albo na pustą stronę
 * (koniec lokalnej historii klienta).
 *
 * To niedokumentowane, lokalne API bywa niestabilne: czasem `begIndex`/
 * `endIndex` są ignorowane i każde zapytanie zwraca tę samą, pierwszą stronę
 * wyników. Żeby to wykryć zamiast wpaść w pętlę powielającą te same mecze aż
 * do `maxPages`, każdy mecz jest odfiltrowywany po `gameId` względem już
 * zebranych - gdy cała kolejna strona okaże się złożona wyłącznie z meczów
 * widzianych wcześniej, przerywamy stronicowanie (`truncated: true` w
 * wyniku sygnalizuje, że lista może nie sięgać żądanej daty).
 *
 * Uwaga: to lokalny cache klienta League, nie serwerowa baza Riota - trzyma
 * ograniczoną liczbę ostatnich gier. Dla odległych dat lista może się urwać
 * wcześniej, niż faktyczna liczba rozegranych meczów by sugerowała, mimo że
 * te mecze się naprawdę odbyły.
 */
async function fetchMatchSummariesSince(client, puuid, sinceDate, { pageSize = 20, maxPages = 100 } = {}) {
  const sinceTime = new Date(sinceDate).getTime();
  const collected = [];
  const seenGameIds = new Set();
  let begIndex = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const pageGames = await fetchGamePage(client, puuid, begIndex, begIndex + pageSize - 1);
    if (!pageGames.length) break;

    let reachedCutoff = false;
    let newInThisPage = 0;
    for (const g of pageGames) {
      const created = new Date(g.gameCreationDate).getTime();
      if (Number.isFinite(created) && created < sinceTime) {
        reachedCutoff = true;
        break;
      }
      if (seenGameIds.has(g.gameId)) continue;
      seenGameIds.add(g.gameId);
      collected.push(g);
      newInThisPage++;
    }

    if (newInThisPage === 0) {
      truncated = true;
      break;
    }
    if (reachedCutoff || pageGames.length < pageSize) break;
    begIndex += pageSize;
  }

  return {
    matches: collected.sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate)),
    truncated,
  };
}

module.exports = { fetchRecentMatchSummaries, fetchMatchSummariesSince };
