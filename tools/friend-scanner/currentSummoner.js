/** Zwraca puuid aktualnie zalogowanego w kliencie League gracza (działa też poza grą). */
async function getCurrentSummonerPuuid(client) {
  const summoner = await client.get('/lol-summoner/v1/current-summoner');
  return summoner && summoner.puuid;
}

module.exports = { getCurrentSummonerPuuid };
