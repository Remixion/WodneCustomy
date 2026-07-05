const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeTeamPosition, resolveDuplicateJungles } = require('./matchBuilder');

function teamLabel(teamId) {
  return teamId === 100 ? 'BLUE' : teamId === 200 ? 'RED' : String(teamId);
}

function computeKda(k, d, a) {
  if (!d) return k + a === 0 ? '0.00' : 'Perfect';
  return ((k + a) / d).toFixed(2);
}

/** Zwraca wartość pierwszego zdefiniowanego (i niepustego) klucza z listy kandydatów. */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function toNum(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function toWinBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null) return false;
  const s = String(v).toLowerCase();
  return s === 'win' || s === 'true' || s === '1';
}

/** Stary format zapisywał już gotowe "TOP"/"JNG"/"MID"/"ADC"/"SUP" zamiast lane+role. */
const ROLE_TO_POSITION = { TOP: 'TOP', JNG: 'JUNGLE', MID: 'MIDDLE', ADC: 'BOTTOM', SUP: 'SUPPORT' };

/** Jeśli folder danych zawiera luźne pliki .json (poza matches/ i players.json), to pewnie tam. */
function detectDefaultLegacyJsonFolder(dataDir) {
  if (!dataDir) return null;
  try {
    const hasLooseJson = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .some((e) => e.isFile() && e.name.toLowerCase().endsWith('.json') && e.name !== 'players.json');
    return hasLooseJson ? dataDir : null;
  } catch (err) {
    return null;
  }
}

/**
 * Pliki z tego starego narzędzia bywają zapisane bez wiarygodnego identyfikatora
 * gry - pole "gameId"/"matchId" bywa dosłownie stringiem "Unknown" (potwierdzone
 * na realnym pliku). W takim wypadku budujemy stabilne ID z zawartości pliku
 * (hash SHA-1), żeby ten sam plik zawsze mapował się na ten sam mecz, a różne
 * pliki bez ID się ze sobą nie zlały w jeden wiersz w arkuszu.
 */
function extractGameId(raw, filePath) {
  const value = pick(raw, 'gameId', 'matchId');
  if (value !== undefined && String(value).trim().toLowerCase() !== 'unknown') {
    return String(value);
  }
  const hash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
  return `legacy-${hash}`;
}

/** Listuje pliki .json w podanym folderze (bez podfolderów), odczytując gameId z zawartości pliku. */
function listLegacyJsonFilesInFolder(folderPath) {
  if (!folderPath) return [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Nie udało się odczytać folderu "${folderPath}": ${err.message}`);
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json') && e.name.toLowerCase() !== 'players.json')
    .map((e) => {
      const filePath = path.join(folderPath, e.name);
      let gameId = null;
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        gameId = extractGameId(raw, filePath);
      } catch (err) {
        gameId = null;
      }
      return { filePath, fileName: e.name, gameId, mtime: fs.statSync(filePath).mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

/**
 * Buduje mecz + graczy z pliku JSON zapisanego kiedyś innym (starszym)
 * narzędziem, poza tą apką - w przeciwieństwie do importu z historii/.rofl,
 * plik już zawiera pełne, wcześniej zebrane statystyki, więc w ogóle nie
 * wymaga uruchomionego klienta League ani odpytywania go o dane tej gry.
 *
 * Obsługuje dwa spotykane w praktyce kształty danych:
 * - "strukturalny": camelCase, participants[].items/spells/runes jako osobne
 *   struktury (championName, kills, cs, items: [...], runes: {...}, ...);
 * - surowy zrzut końca gry z klienta League (EOG stats block): płaskie pola
 *   WIELKIMI_LITERAMI wprost na obiekcie gracza (CHAMPIONS_KILLED,
 *   GOLD_EARNED, RIOT_ID_GAME_NAME, PUUID, WIN: "Win"/"Fail", ITEM0..6,
 *   PERK0../PERK_PRIMARY_STYLE/PERK_SUB_STYLE, SUMMONER_SPELL_1/2, TEAM,
 *   TEAM_POSITION...), bez osobnej tablicy "teams" z banami/celami
 *   drużynowymi (liczymy je wtedy sumując pola per-gracz) - i bez
 *   identyfikatora championa (tylko "SKIN", czyli nazwa skina, zwykle równa
 *   nazwie championa przy domyślnym wyglądzie). Brakujące w danym kształcie
 *   pola (np. bany, dokładna data utworzenia gry) zostają puste albo
 *   przybliżone (data z modyfikacji pliku) - zgodnie z zasadą "zapisz co
 *   jest dostępne, nie zgaduj reszty".
 *
 * Jeśli ten mecz był już wcześniej zaimportowany z prawdziwym eogStatsBlock
 * (np. przez żywe przechwytywanie), wciąż wolimy jego detectedTeamPosition
 * (dokładniejsze niż to, co niesie ten plik), przekazane jako
 * previousEogStatsBlock - tak samo jak przy ponownym imporcie z historii/.rofl.
 */
function buildMatchFromLegacyJson(raw, { gameId, previousEogStatsBlock = null } = {}) {
  const eogPlayerByPuuid = {};
  if (previousEogStatsBlock && Array.isArray(previousEogStatsBlock.teams)) {
    previousEogStatsBlock.teams.forEach((team) => {
      (team.players || []).forEach((eogPlayer) => {
        if (eogPlayer.puuid) eogPlayerByPuuid[eogPlayer.puuid] = eogPlayer;
      });
    });
  }

  const participants = raw.participants || [];

  const bansToNames = (team) =>
    (team.bans || [])
      .slice()
      .sort((a, b) => a.pickTurn - b.pickTurn)
      .map((b) => b.championName || (b.championId >= 0 ? `#${b.championId}` : ''))
      .filter(Boolean)
      .join(', ');

  // Format "strukturalny" ma osobną tablicę "teams" z banami i sumarycznymi
  // celami drużynowymi. Surowy zrzut EOG stats block jej nie ma - trzeba te
  // wartości zsumować z pól per-gracz (bany zostają wtedy puste, bo nie da
  // się ich odtworzyć z samych statystyk graczy).
  let blueTeam;
  let redTeam;
  if (Array.isArray(raw.teams) && raw.teams.length) {
    const byId = {};
    raw.teams.forEach((t) => {
      byId[t.teamId] = t;
    });
    blueTeam = byId[100] || {};
    redTeam = byId[200] || {};
  } else {
    const summed = { 100: { teamId: 100 }, 200: { teamId: 200 } };
    participants.forEach((p) => {
      const team = summed[toNum(pick(p, 'teamId', 'TEAM'))];
      if (!team) return;
      if (toWinBool(pick(p, 'win', 'WIN'))) team.win = true;
      team.baronKills = (team.baronKills || 0) + toNum(pick(p, 'BARON_KILLS'));
      team.dragonKills = (team.dragonKills || 0) + toNum(pick(p, 'DRAGON_KILLS'));
      team.riftHeraldKills = (team.riftHeraldKills || 0) + toNum(pick(p, 'RIFT_HERALD_KILLS'));
      team.towerKills = (team.towerKills || 0) + toNum(pick(p, 'TURRETS_KILLED'));
      team.inhibitorKills = (team.inhibitorKills || 0) + toNum(pick(p, 'BARRACKS_KILLED'));
    });
    blueTeam = summed[100];
    redTeam = summed[200];
  }
  const winningTeam = blueTeam.win === true || blueTeam.win === 'Win' ? 'BLUE' : redTeam.win === true || redTeam.win === 'Win' ? 'RED' : '';

  let gameDurationSec = toNum(pick(raw, 'gameDuration', 'gameLength'), 0);
  // Surowe zrzuty EOG stats block podają czas gry w milisekundach, nie w
  // sekundach (potwierdzone na realnym pliku: TIME_PLAYED graczy w sekundach
  // odpowiada w przybliżeniu gameDuration/1000).
  if (gameDurationSec > 36000) gameDurationSec = Math.round(gameDurationSec / 1000);

  const gameCreationDate =
    raw.date || (raw.gameCreation ? new Date(raw.gameCreation).toISOString() : null) || new Date().toISOString();

  const match = {
    matchId: gameId,
    gameCreationDate,
    gameDurationSec,
    gameMode: pick(raw, 'gameMode', 'queueType') || '',
    gameType: raw.gameType || '',
    mapId: raw.mapId || '',
    queueId: raw.queueId || '',
    gameVersion: raw.gameVersion || '',
    winningTeam,
    blueBans: bansToNames(blueTeam),
    redBans: bansToNames(redTeam),
    blueBaronKills: blueTeam.baronKills || 0,
    blueDragonKills: blueTeam.dragonKills || 0,
    blueHeraldKills: blueTeam.riftHeraldKills || blueTeam.riftHerald || 0,
    blueTowerKills: blueTeam.towerKills || 0,
    blueInhibKills: blueTeam.inhibitorKills || blueTeam.inhibKills || 0,
    redBaronKills: redTeam.baronKills || 0,
    redDragonKills: redTeam.dragonKills || 0,
    redHeraldKills: redTeam.riftHeraldKills || redTeam.riftHerald || 0,
    redTowerKills: redTeam.towerKills || 0,
    redInhibKills: redTeam.inhibitorKills || redTeam.inhibKills || 0,
    notes: '',
    rawDataJson: JSON.stringify({ legacyJson: raw, eogStatsBlock: null }),
  };

  const minutes = match.gameDurationSec > 0 ? match.gameDurationSec / 60 : null;

  const players = participants.map((p) => {
    const puuid = pick(p, 'puuid', 'PUUID') || '';
    const gameName = p.RIOT_ID_GAME_NAME;
    const summonerName =
      p.summonerName || (gameName ? `${gameName}#${p.RIOT_ID_TAG_LINE || ''}` : '') || p.NAME || '';

    const items = Array.isArray(p.items) ? p.items : null;
    const item = (i) => (items ? items[i] || 0 : toNum(pick(p, `ITEM${i}`)));

    const spells = Array.isArray(p.spells) ? p.spells : null;
    const spell1 = (spells && spells[0] && spells[0].id) || pick(p, 'spell1', 'SUMMONER_SPELL_1') || '';
    const spell2 = (spells && spells[1] && spells[1].id) || pick(p, 'spell2', 'SUMMONER_SPELL_2') || '';

    const runes = p.runes || {};
    const primaryRuneStyle = (runes.primaryPath && runes.primaryPath.id) || pick(p, 'PERK_PRIMARY_STYLE') || '';
    const subRuneStyle = (runes.subPath && runes.subPath.id) || pick(p, 'PERK_SUB_STYLE') || '';
    const keystone = (runes.keystone && runes.keystone.id) || pick(p, 'KEYSTONE_ID', 'PERK0') || '';

    const kills = toNum(pick(p, 'kills', 'CHAMPIONS_KILLED'));
    const deaths = toNum(pick(p, 'deaths', 'NUM_DEATHS'));
    const assists = toNum(pick(p, 'assists', 'ASSISTS'));
    const cs =
      pick(p, 'cs') !== undefined
        ? toNum(pick(p, 'cs'))
        : toNum(pick(p, 'MINIONS_KILLED')) + toNum(pick(p, 'NEUTRAL_MINIONS_KILLED'));
    const csPerMin =
      pick(p, 'csPerMin') !== undefined
        ? typeof p.csPerMin === 'number'
          ? p.csPerMin.toFixed(2)
          : String(p.csPerMin)
        : minutes
        ? (cs / minutes).toFixed(2)
        : '0';

    const eogPlayer = puuid ? eogPlayerByPuuid[puuid] : null;
    const rawTeamPosition =
      pick(p, 'teamPosition', 'TEAM_POSITION', 'INDIVIDUAL_POSITION') || ROLE_TO_POSITION[p.inferredRole] || '';

    return {
      matchId: gameId,
      team: p.teamSide ? p.teamSide.toUpperCase() : teamLabel(toNum(pick(p, 'teamId', 'TEAM'))),
      puuid,
      summonerName,
      championName: p.championName || p.SKIN || (p.championId !== undefined ? `#${p.championId}` : ''),
      championId: pick(p, 'championId') || '',
      teamPosition: normalizeTeamPosition((eogPlayer && eogPlayer.detectedTeamPosition) || rawTeamPosition),
      spell1,
      spell2,
      primaryRuneStyle,
      subRuneStyle,
      keystone,
      champLevel: toNum(pick(p, 'championLevel', 'LEVEL')),
      kills,
      deaths,
      assists,
      kda: computeKda(kills, deaths, assists),
      cs,
      csPerMin,
      goldEarned: toNum(pick(p, 'goldEarned', 'GOLD_EARNED')),
      damageDealtToChampions: toNum(pick(p, 'damageDealt', 'TOTAL_DAMAGE_DEALT_TO_CHAMPIONS')),
      damageTaken: toNum(pick(p, 'damageTaken', 'TOTAL_DAMAGE_TAKEN')),
      damageSelfMitigated: toNum(pick(p, 'selfMitigatedDmg', 'TOTAL_DAMAGE_SELF_MITIGATED')),
      totalHeal: toNum(pick(p, 'healingDone', 'TOTAL_HEAL')),
      visionScore: toNum(pick(p, 'visionScore', 'VISION_SCORE')),
      wardsPlaced: toNum(pick(p, 'wardsPlaced', 'WARD_PLACED')),
      wardsKilled: toNum(pick(p, 'wardsKilled', 'WARD_KILLED')),
      controlWardsPlaced: toNum(pick(p, 'wardsBought', 'VISION_WARDS_BOUGHT_IN_GAME')),
      item0: item(0),
      item1: item(1),
      item2: item(2),
      item3: item(3),
      item4: item(4),
      item5: item(5),
      item6: item(6),
      firstBloodKill: pick(p, 'firstBloodKill', 'FIRST_BLOOD_KILL') || false,
      firstTowerKill: pick(p, 'firstTowerKill', 'FIRST_TOWER_KILL') || false,
      doubleKills: toNum(pick(p, 'doubleKills', 'DOUBLE_KILLS')),
      tripleKills: toNum(pick(p, 'tripleKills', 'TRIPLE_KILLS')),
      quadraKills: toNum(pick(p, 'quadraKills', 'QUADRA_KILLS')),
      pentaKills: toNum(pick(p, 'pentaKills', 'PENTA_KILLS')),
      win: pick(p, 'win') !== undefined ? Boolean(p.win) : toWinBool(pick(p, 'WIN')),
      notes: '',
    };
  });

  resolveDuplicateJungles(players);

  return { match, players };
}

module.exports = {
  detectDefaultLegacyJsonFolder,
  listLegacyJsonFilesInFolder,
  buildMatchFromLegacyJson,
  extractGameId,
};
