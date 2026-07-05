const fs = require('fs');

/**
 * Import ręcznie prowadzonego arkusza ligi sprzed tej apki (kolumny: GID,
 * Patch, Data, WIN, Top_L/Jng_L/Mid_L/Adc_L/Supp_L (nicki - strona "Lewa"),
 * Top_P/.../Supp_P (nicki - strona "Prawa"), Champ_* (championi w tej samej
 * kolejności ról/stron), KdaJson, ImgUrl, ParticipantsJson, LoLID).
 *
 * Ta strona ("Lewa"/"Prawa") była przydzielana losowo przy zapisywaniu meczu,
 * bez znajomości prawdziwej strony Blue/Red z klienta League - dlatego
 * zapisujemy ją jako team="LEFT"/"RIGHT" (osobne od BLUE/RED używanych przez
 * pozostałe źródła danych), żeby niczego nie sugerować na wyrost. Gdy
 * konkretny mecz zostanie później znaleziony przez inne źródło (skaner Game
 * ID, import .rofl/z historii - patrz kolumna LoLID, czasem już wypełniona),
 * ten sam matchId sprawi, że nowe, pełne dane z prawdziwym Blue/Red
 * nadpiszą ten wpis zamiast tworzyć duplikat.
 *
 * Gracze nie mają tu puuid (to tylko nicki) - używamy znormalizowanego nicku
 * jako stabilnego zastępczego klucza ("nick:<nick>"), żeby statystyki tej
 * samej osoby łączyły się między meczami z tego arkusza. To nie jest
 * prawdziwe puuid i nigdy nie połączy się automatycznie z prawdziwym kontem
 * League tego gracza w podarkuszu Players.
 */

const ROLE_COLUMNS = [
  { role: 'TOP', side: 'LEFT', nameCol: 'Top_L', champCol: 'Champ_Top_L' },
  { role: 'JUNGLE', side: 'LEFT', nameCol: 'Jng_L', champCol: 'Champ_Jng_L' },
  { role: 'MIDDLE', side: 'LEFT', nameCol: 'Mid_L', champCol: 'Champ_Mid_L' },
  { role: 'BOTTOM', side: 'LEFT', nameCol: 'Adc_L', champCol: 'Champ_Adc_L' },
  { role: 'SUPPORT', side: 'LEFT', nameCol: 'Supp_L', champCol: 'Champ_Supp_L' },
  { role: 'TOP', side: 'RIGHT', nameCol: 'Top_P', champCol: 'Champ_Top_P' },
  { role: 'JUNGLE', side: 'RIGHT', nameCol: 'Jng_P', champCol: 'Champ_Jng_P' },
  { role: 'MIDDLE', side: 'RIGHT', nameCol: 'Mid_P', champCol: 'Champ_Mid_P' },
  { role: 'BOTTOM', side: 'RIGHT', nameCol: 'Adc_P', champCol: 'Champ_Adc_P' },
  { role: 'SUPPORT', side: 'RIGHT', nameCol: 'Supp_P', champCol: 'Champ_Supp_P' },
];

function pick(row, key) {
  const v = row[key];
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function detectDelimiter(headerLine) {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return tabCount >= commaCount ? '\t' : ',';
}

/** Minimalny parser CSV/TSV bez obsługi cudzysłowów - wystarczający dla tego arkusza (bez przecinków/tabulatorów w nickach/nazwach championów). */
function parseDelimitedText(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '');
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] || '').trim();
    });
    return row;
  });
}

function normalizeNickKey(nick) {
  return `nick:${nick.trim().toLowerCase()}`;
}

/** Buduje mecz + graczy z jednego wiersza arkusza ligi. Rzuca błąd, jeśli wiersz nie ma GID. */
function buildMatchFromLeagueSheetRow(row) {
  const gid = pick(row, 'GID');
  if (!gid) throw new Error('Wiersz nie ma wartości w kolumnie GID.');

  const lolId = pick(row, 'LoLID');
  const matchId = lolId && lolId.toLowerCase() !== 'unknown' ? lolId : `legacy-${gid.padStart(4, '0')}`;

  const dateValue = pick(row, 'Data');
  const parsedDate = dateValue ? new Date(dateValue) : null;
  const gameCreationDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();

  const winSideRaw = pick(row, 'WIN').toUpperCase();
  const winningTeam = winSideRaw === 'LEWA' ? 'LEFT' : winSideRaw === 'PRAWA' ? 'RIGHT' : '';

  const imgUrl = pick(row, 'ImgUrl');
  const notes = imgUrl.toLowerCase().startsWith('http') ? `Zrzut ekranu: ${imgUrl}` : '';

  const match = {
    matchId,
    dataSource: 'league-sheet',
    gameCreationDate,
    gameDurationSec: '',
    gameMode: 'CLASSIC',
    gameType: 'CUSTOM_GAME',
    mapId: 11,
    queueId: 0,
    gameVersion: pick(row, 'Patch'),
    winningTeam,
    blueBans: '',
    redBans: '',
    blueBaronKills: 0,
    blueDragonKills: 0,
    blueHeraldKills: 0,
    blueTowerKills: 0,
    blueInhibKills: 0,
    redBaronKills: 0,
    redDragonKills: 0,
    redHeraldKills: 0,
    redTowerKills: 0,
    redInhibKills: 0,
    notes,
    rawDataJson: JSON.stringify({ leagueSheetRow: row }),
  };

  const players = ROLE_COLUMNS.map(({ role, side, nameCol, champCol }) => {
    const nick = pick(row, nameCol);
    if (!nick) return null;
    return {
      matchId,
      team: side,
      puuid: normalizeNickKey(nick),
      summonerName: nick,
      championName: pick(row, champCol),
      championId: '',
      teamPosition: role,
      spell1: '',
      spell2: '',
      primaryRuneStyle: '',
      subRuneStyle: '',
      keystone: '',
      champLevel: '',
      kills: '',
      deaths: '',
      assists: '',
      kda: '',
      cs: '',
      csPerMin: '',
      goldEarned: '',
      damageDealtToChampions: '',
      damageTaken: '',
      damageSelfMitigated: '',
      totalHeal: '',
      visionScore: '',
      wardsPlaced: '',
      wardsKilled: '',
      controlWardsPlaced: '',
      item0: '',
      item1: '',
      item2: '',
      item3: '',
      item4: '',
      item5: '',
      item6: '',
      firstBloodKill: '',
      firstTowerKill: '',
      doubleKills: '',
      tripleKills: '',
      quadraKills: '',
      pentaKills: '',
      win: winningTeam ? side === winningTeam : '',
      notes: '',
    };
  }).filter(Boolean);

  return { match, players };
}

/** Parsuje cały plik arkusza ligi na listę { gid, ok, match, players } / { gid, ok: false, error }. */
function parseLeagueSheetFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseDelimitedText(text).filter((row) => pick(row, 'GID'));
  return rows.map((row) => {
    const gid = pick(row, 'GID');
    try {
      const { match, players } = buildMatchFromLeagueSheetRow(row);
      return { gid, ok: true, match, players };
    } catch (err) {
      return { gid, ok: false, error: String(err) };
    }
  });
}

module.exports = { parseLeagueSheetFile, buildMatchFromLeagueSheetRow, parseDelimitedText };
