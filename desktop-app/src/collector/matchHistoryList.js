/**
 * Pobiera skróconą listę ostatnich meczów z LOKALNEJ historii klienta League
 * (dostępna niezależnie od tego, czy ta apka była wtedy uruchomiona - to
 * historia zapisana przez sam klient dla zalogowanego konta). Służy tylko do
 * zbudowania listy wyboru w UI - pełne dane meczu i tak są pobierane osobno
 * przez buildMatchFromGameId przy właściwym imporcie.
 */
async function fetchRecentMatchSummaries(client, puuid, count = 20) {
  const data = await client.get(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=${Math.max(0, count - 1)}`);
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
    }))
    .sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
}

module.exports = { fetchRecentMatchSummaries };
