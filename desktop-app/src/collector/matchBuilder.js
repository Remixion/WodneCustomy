const { getChampionMap } = require('./championData');

function teamLabel(teamId) {
  return teamId === 100 ? 'BLUE' : teamId === 200 ? 'RED' : String(teamId);
}

function computeKda(k, d, a) {
  if (!d) return k + a === 0 ? '0.00' : 'Perfect';
  return ((k + a) / d).toFixed(2);
}

/** Ucina pełny numer wersji klienta (np. "15.24.734.7485") do samego patcha ("15.24"). */
function toPatchVersion(version) {
  if (!version) return '';
  const parts = String(version).split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : String(version);
}

/**
 * Odtwarza rolę gracza z pary timeline.lane + timeline.role (fallback, gdy
 * eogStatsBlock/detectedTeamPosition nie jest dostępny - czyli przy imporcie
 * z historii klienta albo z pliku .rofl). Samo "lane" bywa mylące w
 * customach (np. dwóch graczy oznaczonych jako JUNGLE), dlatego łączymy je
 * z "role":
 *   lane=JUNGLE, role=NONE    -> JUNGLE
 *   lane=TOP                  -> TOP
 *   lane=MIDDLE/MID, role=SOLO -> MIDDLE
 *   lane=BOTTOM/BOT, role=CARRY/DUO_CARRY -> BOTTOM
 *   lane=BOTTOM/BOT, role=SUPPORT/DUO_SUPPORT -> SUPPORT
 */
function deriveTeamPosition(lane, role) {
  if (!lane) return '';
  if (lane === 'TOP') return 'TOP';
  if (lane === 'JUNGLE') return 'JUNGLE';
  if (lane === 'MIDDLE' || lane === 'MID') return 'MIDDLE';
  if (lane === 'BOTTOM' || lane === 'BOT') {
    if (role === 'SUPPORT' || role === 'DUO_SUPPORT') return 'SUPPORT';
    return 'BOTTOM';
  }
  return lane;
}

/** eogStatsBlock/detectedTeamPosition nazywa wsparcie "UTILITY" - ujednolicamy do "SUPPORT". */
function normalizeTeamPosition(position) {
  return position === 'UTILITY' ? 'SUPPORT' : position;
}

const SUMMONER_SPELL_SMITE_ID = 11;
const STANDARD_POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];

/**
 * Riotowe "lane" bywa błędne na tyle, że w jednej drużynie potrafi wskazać
 * dwóch graczy jako JUNGLE (żaden combo z "role" tego nie naprawi). Jedyny
 * gracz na pozycji JUNGLE może mieć w wyposażeniu Smite'a (id 11) - jeśli
 * dokładnie jeden z "podwójnych" jungli ma Smite'a, a w drużynie brakuje
 * dokładnie jednej innej pozycji, to ten drugi gracz naprawdę grał na tej
 * brakującej pozycji.
 */
function resolveDuplicateJungles(players) {
  ['BLUE', 'RED'].forEach((team) => {
    const teamPlayers = players.filter((p) => p.team === team);
    const junglers = teamPlayers.filter((p) => p.teamPosition === 'JUNGLE');
    if (junglers.length <= 1) return;

    const missingPositions = STANDARD_POSITIONS.filter(
      (pos) => !teamPlayers.some((p) => p.teamPosition === pos)
    );
    if (missingPositions.length !== 1) return; // niejednoznaczne - nie zgaduj

    const withSmite = junglers.filter(
      (p) => p.spell1 === SUMMONER_SPELL_SMITE_ID || p.spell2 === SUMMONER_SPELL_SMITE_ID
    );
    if (withSmite.length !== 1) return; // brak jednoznacznego Smite'a - nie zgaduj

    junglers
      .filter((p) => p !== withSmite[0])
      .forEach((p) => {
        p.teamPosition = missingPositions[0];
      });
  });
}

/**
 * Buduje znormalizowany rekord meczu + listę graczy na bazie
 * /lol-match-history/v1/games/{gameId} (ten sam kształt danych co publiczne
 * Riot Match API). Współdzielone przez: automatyczne przechwytywanie po
 * zakończeniu gry (collectMatch) oraz ręczny import z historii meczów klienta
 * (import starszych meczów, w których apka nie była uruchomiona).
 *
 * eogStatsBlock (/lol-end-of-game/v1/eog-stats-block) to niedokumentowane,
 * przejściowe dane z ekranu końca gry - mają sens tylko tuż po zakończeniu
 * aktualnie rozgrywanej gry, dlatego dołączamy je wyłącznie w collectMatch,
 * nigdy przy imporcie historycznego meczu. Jeśli mecz był już wcześniej
 * zaimportowany z prawdziwym eogStatsBlock, przekaż go jako
 * previousEogStatsBlock - zostanie użyty do wyliczenia teamPosition
 * (detectedTeamPosition), żeby ponowny import (np. przycisk "Importuj
 * ponownie") nie pogorszył dokładności roli graczy tylko dlatego, że tym
 * razem eogStatsBlock nie jest dostępny na świeżo.
 */
async function buildMatchFromGameId(
  client,
  gameId,
  { includeEogStatsBlock = false, previousEogStatsBlock = null, dataSource = 'lcu-history' } = {}
) {
  const matchHistory = await client.get(`/lol-match-history/v1/games/${gameId}`);

  let eogStatsBlock = null;
  if (includeEogStatsBlock) {
    try {
      eogStatsBlock = await client.get('/lol-end-of-game/v1/eog-stats-block');
    } catch (err) {
      eogStatsBlock = null; // opcjonalne, niedokumentowane API - brak nie blokuje zapisu meczu
    }
  }

  const champMap = await getChampionMap(client);

  // eogStatsBlock (dostępny tylko przy żywym przechwytywaniu, albo zachowany
  // z poprzedniego importu) zawiera pole "detectedTeamPosition" - znacznie
  // dokładniejsze wykrycie roli gracza niż "timeline.lane" z
  // /lol-match-history, które w customach często zwraca niepoprawne/puste
  // wartości.
  const eogPlayerByPuuid = {};
  const effectiveEogStatsBlock = eogStatsBlock || previousEogStatsBlock;
  if (effectiveEogStatsBlock && Array.isArray(effectiveEogStatsBlock.teams)) {
    effectiveEogStatsBlock.teams.forEach((team) => {
      (team.players || []).forEach((eogPlayer) => {
        if (eogPlayer.puuid) eogPlayerByPuuid[eogPlayer.puuid] = eogPlayer;
      });
    });
  }

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
    dataSource,
    gameCreationDate: new Date(matchHistory.gameCreation).toISOString(),
    gameDurationSec: matchHistory.gameDuration,
    gameMode: matchHistory.gameMode,
    gameType: matchHistory.gameType,
    mapId: matchHistory.mapId,
    queueId: matchHistory.queueId,
    gameVersion: toPatchVersion(matchHistory.gameVersion),
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
    const eogPlayer = identity.puuid ? eogPlayerByPuuid[identity.puuid] : null;

    return {
      matchId: String(gameId),
      team: teamLabel(p.teamId),
      puuid: identity.puuid || '',
      summonerName,
      championName: champMap[p.championId] || `#${p.championId}`,
      championId: p.championId,
      teamPosition: normalizeTeamPosition(
        (eogPlayer && eogPlayer.detectedTeamPosition) ||
          deriveTeamPosition(p.timeline && p.timeline.lane, p.timeline && p.timeline.role)
      ),
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

  resolveDuplicateJungles(players);

  return { match, players };
}

/**
 * Odczytuje dane właśnie zakończonej gry z LCU (faza EndOfGame): pobiera
 * gameId z aktywnej sesji gameflow i buduje mecz + graczy przez
 * buildMatchFromGameId, dołączając dodatkowo surowy eog-stats-block.
 */
async function collectMatch(client) {
  const session = await client.get('/lol-gameflow/v1/session').catch(() => null);
  const gameId = session && session.gameData && session.gameData.gameId;
  if (!gameId) {
    throw new Error('Nie udało się odczytać gameId zakończonej gry z sesji gameflow.');
  }
  return buildMatchFromGameId(client, gameId, { includeEogStatsBlock: true, dataSource: 'lcu-live' });
}

module.exports = {
  collectMatch,
  buildMatchFromGameId,
  deriveTeamPosition,
  normalizeTeamPosition,
  resolveDuplicateJungles,
  toPatchVersion,
};
