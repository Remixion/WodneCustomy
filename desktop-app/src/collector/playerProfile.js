const { getChampionMap } = require('./championData');

/**
 * Dociąga jak najwięcej danych o graczu z LCU: profil, statystyki rankingowe,
 * mistrzostwo championów. Wszystkie zapytania są "best-effort" - LCU API jest
 * nieoficjalne i część endpointów bywa niedostępna (np. ranking innych graczy
 * w niektórych wersjach klienta), więc błędy nie przerywają całości.
 */
async function enrichPlayer(client, basicPlayer) {
  const result = {
    puuid: basicPlayer.puuid,
    summonerName: basicPlayer.summonerName,
    summonerId: '',
    accountId: '',
    profileIconId: '',
    summonerLevel: '',
    soloTier: '',
    soloRank: '',
    soloLP: '',
    soloWins: '',
    soloLosses: '',
    soloWinRatePct: '',
    flexTier: '',
    flexRank: '',
    flexLP: '',
    flexWins: '',
    flexLosses: '',
    flexWinRatePct: '',
    top1ChampionName: '',
    top1ChampionPoints: '',
    top2ChampionName: '',
    top2ChampionPoints: '',
    top3ChampionName: '',
    top3ChampionPoints: '',
    totalMasteryScore: '',
  };

  if (!basicPlayer.puuid) return result;

  try {
    const summoner = await client.get(`/lol-summoner/v2/summoners/puuid/${basicPlayer.puuid}`);
    if (summoner) {
      result.summonerId = summoner.summonerId;
      result.accountId = summoner.accountId;
      result.profileIconId = summoner.profileIconId;
      result.summonerLevel = summoner.summonerLevel;
    }
  } catch (err) {
    // profil niedostępny - kontynuuj z pustymi polami
  }

  try {
    const ranked = await client.get(`/lol-ranked/v1/ranked-stats/${basicPlayer.puuid}`);
    const queues = (ranked && ranked.queues) || [];
    const solo = queues.find((q) => q.queueType === 'RANKED_SOLO_5x5');
    const flex = queues.find((q) => q.queueType === 'RANKED_FLEX_SR');
    if (solo) {
      result.soloTier = solo.tier;
      result.soloRank = solo.division;
      result.soloLP = solo.leaguePoints;
      result.soloWins = solo.wins;
      result.soloLosses = solo.losses;
      result.soloWinRatePct = solo.wins + solo.losses > 0 ? ((solo.wins / (solo.wins + solo.losses)) * 100).toFixed(1) : '';
    }
    if (flex) {
      result.flexTier = flex.tier;
      result.flexRank = flex.division;
      result.flexLP = flex.leaguePoints;
      result.flexWins = flex.wins;
      result.flexLosses = flex.losses;
      result.flexWinRatePct = flex.wins + flex.losses > 0 ? ((flex.wins / (flex.wins + flex.losses)) * 100).toFixed(1) : '';
    }
  } catch (err) {
    // ranking niedostępny dla tego gracza - kontynuuj
  }

  try {
    const mastery = await client.get(`/lol-champion-mastery/v1/champion-mastery/${basicPlayer.puuid}`);
    if (Array.isArray(mastery) && mastery.length) {
      const champMap = await getChampionMap(client);
      const sorted = mastery.slice().sort((a, b) => (b.championPoints || 0) - (a.championPoints || 0));
      const total = mastery.reduce((sum, m) => sum + (m.championPoints || 0), 0);
      result.totalMasteryScore = total;
      [0, 1, 2].forEach((i) => {
        const m = sorted[i];
        if (m) {
          result[`top${i + 1}ChampionName`] = champMap[m.championId] || `#${m.championId}`;
          result[`top${i + 1}ChampionPoints`] = m.championPoints;
        }
      });
    }
  } catch (err) {
    // mistrzostwo niedostępne - kontynuuj
  }

  return result;
}

module.exports = { enrichPlayer };
