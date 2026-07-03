// Agregacje statystyk używane przez stats.js oraz profile.js.
// Wymaga funkcji pomocniczych z common.js (numberOr, isWinValue, mostFrequent, getPlayerDisplayName, getPlayerColor).

function computeIndividualStats(matchPlayers, playersByPuuid) {
  const byPuuid = {};
  (matchPlayers || []).forEach((mp) => {
    if (!mp.puuid) return;
    if (!byPuuid[mp.puuid]) byPuuid[mp.puuid] = [];
    byPuuid[mp.puuid].push(mp);
  });

  return Object.keys(byPuuid).map((puuid) => {
    const games = byPuuid[puuid];
    const gamesPlayed = games.length;
    const wins = games.filter((g) => isWinValue(g.win)).length;
    const losses = gamesPlayed - wins;
    const sum = (field) => games.reduce((acc, g) => acc + numberOr(g[field]), 0);
    const totalKills = sum('kills');
    const totalDeaths = sum('deaths');
    const totalAssists = sum('assists');
    const player = playersByPuuid[puuid];

    return {
      puuid,
      displayName: getPlayerDisplayName(puuid, games[0].summonerName, playersByPuuid),
      color: getPlayerColor(player || { puuid, summonerName: games[0].summonerName }),
      gamesPlayed,
      wins,
      losses,
      winRatePct: gamesPlayed ? (wins / gamesPlayed) * 100 : 0,
      totalKills,
      totalDeaths,
      totalAssists,
      avgKills: totalKills / gamesPlayed,
      avgDeaths: totalDeaths / gamesPlayed,
      avgAssists: totalAssists / gamesPlayed,
      avgKda: totalDeaths === 0 ? null : (totalKills + totalAssists) / totalDeaths,
      avgCs: sum('cs') / gamesPlayed,
      avgCsPerMin: sum('csPerMin') / gamesPlayed,
      avgGoldEarned: sum('goldEarned') / gamesPlayed,
      avgDamageDealtToChampions: sum('damageDealtToChampions') / gamesPlayed,
      avgDamageTaken: sum('damageTaken') / gamesPlayed,
      avgVisionScore: sum('visionScore') / gamesPlayed,
      totalPentaKills: sum('pentaKills'),
      totalQuadraKills: sum('quadraKills'),
      totalTripleKills: sum('tripleKills'),
      totalDoubleKills: sum('doubleKills'),
      totalFirstBloods: games.filter((g) => isWinValue(g.firstBloodKill)).length,
      favoriteChampion: mostFrequent(games.map((g) => g.championName)).value,
      favoriteRole: mostFrequent(games.map((g) => g.teamPosition)).value,
    };
  });
}

function computeGeneralStats(matches, matchPlayers) {
  const totalMatches = matches.length;
  const totalDurationSec = matches.reduce((acc, m) => acc + numberOr(m.gameDurationSec), 0);
  const sortedByDuration = matches.slice().sort((a, b) => numberOr(b.gameDurationSec) - numberOr(a.gameDurationSec));
  const blueWins = matches.filter((m) => m.winningTeam === 'BLUE').length;
  const redWins = matches.filter((m) => m.winningTeam === 'RED').length;
  const championPicks = mostFrequent((matchPlayers || []).map((p) => p.championName));

  const allBans = [];
  matches.forEach((m) => {
    String(m.blueBans || '').split(',').forEach((b) => { if (b.trim()) allBans.push(b.trim()); });
    String(m.redBans || '').split(',').forEach((b) => { if (b.trim()) allBans.push(b.trim()); });
  });
  const bannedChampion = mostFrequent(allBans);

  const totalKills = (matchPlayers || []).reduce((acc, p) => acc + numberOr(p.kills), 0);
  const totalPentaKills = (matchPlayers || []).reduce((acc, p) => acc + numberOr(p.pentaKills), 0);

  return {
    totalMatches,
    totalDurationSec,
    avgDurationSec: totalMatches ? totalDurationSec / totalMatches : 0,
    longestMatch: sortedByDuration[0] || null,
    shortestMatch: sortedByDuration[sortedByDuration.length - 1] || null,
    blueWins,
    redWins,
    blueWinRatePct: totalMatches ? (blueWins / totalMatches) * 100 : 0,
    redWinRatePct: totalMatches ? (redWins / totalMatches) * 100 : 0,
    mostPickedChampion: championPicks.value,
    mostPickedChampionCount: championPicks.count,
    mostBannedChampion: bannedChampion.value,
    mostBannedChampionCount: bannedChampion.count,
    totalKills,
    avgKillsPerGame: totalMatches ? totalKills / totalMatches : 0,
    totalPentaKills,
  };
}

const RANKING_DEFS = [
  { title: 'Najwięcej zwycięstw', minGames: 0, key: (s) => s.wins, format: (s) => s.wins },
  { title: '% wygranych (min. 3 gry)', minGames: 3, key: (s) => s.winRatePct, format: (s) => s.winRatePct.toFixed(1) + '%' },
  { title: 'Najwięcej rozegranych gier', minGames: 0, key: (s) => s.gamesPlayed, format: (s) => s.gamesPlayed },
  { title: 'Najlepsze średnie KDA', minGames: 0, key: (s) => (s.avgKda === null ? Infinity : s.avgKda), format: (s) => (s.avgKda === null ? 'Perfect' : s.avgKda.toFixed(2)) },
  { title: 'Najwięcej zabójstw łącznie', minGames: 0, key: (s) => s.totalKills, format: (s) => s.totalKills },
  { title: 'Najwięcej asyst łącznie', minGames: 0, key: (s) => s.totalAssists, format: (s) => s.totalAssists },
  { title: 'Średnie obrażenia zadane bohaterom / gra', minGames: 0, key: (s) => s.avgDamageDealtToChampions, format: (s) => Math.round(s.avgDamageDealtToChampions) },
  { title: 'Średni Vision Score / gra', minGames: 0, key: (s) => s.avgVisionScore, format: (s) => s.avgVisionScore.toFixed(1) },
  { title: 'Najwięcej Pentakilli', minGames: 0, key: (s) => s.totalPentaKills, format: (s) => s.totalPentaKills, onlyPositive: true },
  { title: 'Najwięcej pierwszych krwi', minGames: 0, key: (s) => s.totalFirstBloods, format: (s) => s.totalFirstBloods, onlyPositive: true },
];

function rankBy(individualStats, def) {
  return individualStats
    .filter((s) => s.gamesPlayed >= def.minGames)
    .filter((s) => !def.onlyPositive || def.key(s) > 0)
    .slice()
    .sort((a, b) => def.key(b) - def.key(a));
}
