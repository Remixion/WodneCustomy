const { getChampionMap } = require('./championData');

function teamLabel(teamId) {
  return teamId === 100 ? 'BLUE' : teamId === 200 ? 'RED' : String(teamId);
}

function computeKda(k, d, a) {
  if (!d) return k + a === 0 ? '0.00' : 'Perfect';
  return ((k + a) / d).toFixed(2);
}

/**
 * Odczytuje dane właśnie zakończonej gry z LCU (faza EndOfGame) i buduje
 * znormalizowany rekord meczu + listę graczy (na bazie /lol-match-history/v1/games/{gameId},
 * czyli tego samego kształtu danych co publiczne Riot Match API - stabilniejszego
 * niż nieoficjalny /lol-end-of-game/v1/eog-stats-block, który dołączamy dodatkowo
 * jako surowy JSON w polu rawDataJson).
 */
async function collectMatch(client) {
  const session = await client.get('/lol-gameflow/v1/session').catch(() => null);
  const gameId = session && session.gameData && session.gameData.gameId;
  if (!gameId) {
    throw new Error('Nie udało się odczytać gameId zakończonej gry z sesji gameflow.');
  }

  const matchHistory = await client.get(`/lol-match-history/v1/games/${gameId}`);

  let eogStatsBlock = null;
  try {
    eogStatsBlock = await client.get('/lol-end-of-game/v1/eog-stats-block');
  } catch (err) {
    eogStatsBlock = null; // opcjonalne, niedokumentowane API - brak nie blokuje zapisu meczu
  }

  const champMap = await getChampionMap(client);

  const identityByParticipantId = {};
  (matchHistory.participantIdentities || []).forEach((pi) => {
    identityByParticipantId[pi.participantId] = pi.player || {};
  });

  const teamsByTeamId = {};
  (matchHistory.teams || []).forEach((t) => {
    teamsByTeamId[t.teamId] = t;
  });

  const blueTeam = teamsByTeamId[100] || {};
  const redTeam = teamsByTeamId[200] || {};
  const winningTeam = blueTeam.win === 'Win' ? 'BLUE' : redTeam.win === 'Win' ? 'RED' : '';

  const bansToNames = (team) =>
    (team.bans || [])
      .slice()
      .sort((a, b) => a.pickTurn - b.pickTurn)
      .map((b) => champMap[b.championId] || `#${b.championId}`)
      .join(', ');

  const match = {
    matchId: String(gameId),
    gameCreationDate: new Date(matchHistory.gameCreation).toISOString(),
    gameDurationSec: matchHistory.gameDuration,
    gameMode: matchHistory.gameMode,
    gameType: matchHistory.gameType,
    mapId: matchHistory.mapId,
    queueId: matchHistory.queueId,
    gameVersion: matchHistory.gameVersion,
    winningTeam,
    blueBans: bansToNames(blueTeam),
    redBans: bansToNames(redTeam),
    blueBaronKills: blueTeam.baronKills || 0,
    blueDragonKills: blueTeam.dragonKills || 0,
    blueHeraldKills: blueTeam.riftHeraldKills || 0,
    blueTowerKills: blueTeam.towerKills || 0,
    blueInhibKills: blueTeam.inhibitorKills || 0,
    redBaronKills: redTeam.baronKills || 0,
    redDragonKills: redTeam.dragonKills || 0,
    redHeraldKills: redTeam.riftHeraldKills || 0,
    redTowerKills: redTeam.towerKills || 0,
    redInhibKills: redTeam.inhibitorKills || 0,
    notes: '',
    rawDataJson: JSON.stringify({ matchHistory, eogStatsBlock }),
  };

  const minutes = (matchHistory.gameDuration || 1) / 60;

  const players = (matchHistory.participants || []).map((p) => {
    const identity = identityByParticipantId[p.participantId] || {};
    const stats = p.stats || {};
    const cs = (stats.totalMinionsKilled || 0) + (stats.neutralMinionsKilled || 0);
    const summonerName = identity.summonerName
      ? identity.summonerName
      : identity.gameName
      ? `${identity.gameName}#${identity.tagLine || ''}`
      : '';

    return {
      matchId: String(gameId),
      team: teamLabel(p.teamId),
      puuid: identity.puuid || '',
      summonerName,
      championName: champMap[p.championId] || `#${p.championId}`,
      championId: p.championId,
      teamPosition: (p.timeline && p.timeline.lane) || '',
      spell1: p.spell1Id,
      spell2: p.spell2Id,
      primaryRuneStyle: stats.perkPrimaryStyle || '',
      subRuneStyle: stats.perkSubStyle || '',
      keystone: stats.perk0 || '',
      champLevel: stats.champLevel,
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      kda: computeKda(stats.kills || 0, stats.deaths || 0, stats.assists || 0),
      cs,
      csPerMin: minutes > 0 ? (cs / minutes).toFixed(2) : '0',
      goldEarned: stats.goldEarned,
      damageDealtToChampions: stats.totalDamageDealtToChampions,
      damageTaken: stats.totalDamageTaken,
      damageSelfMitigated: stats.damageSelfMitigated,
      totalHeal: stats.totalHeal,
      visionScore: stats.visionScore,
      wardsPlaced: stats.wardsPlaced,
      wardsKilled: stats.wardsKilled,
      controlWardsPlaced: stats.visionWardsBoughtInGame,
      item0: stats.item0,
      item1: stats.item1,
      item2: stats.item2,
      item3: stats.item3,
      item4: stats.item4,
      item5: stats.item5,
      item6: stats.item6,
      firstBloodKill: stats.firstBloodKill,
      firstTowerKill: stats.firstTowerKill,
      doubleKills: stats.doubleKills,
      tripleKills: stats.tripleKills,
      quadraKills: stats.quadraKills,
      pentaKills: stats.pentaKills,
      win: stats.win,
      notes: '',
    };
  });

  return { match, players };
}

module.exports = { collectMatch };
