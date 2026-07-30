// Wspólne funkcje do rysowania Scoreboardu (bany + drużyny z ikonami
// championów/przedmiotów/run/przywoływaczy z Data Dragon) - używane zarówno
// przez samodzielną stronę scoreboard.html, jak i rozwijany podgląd na liście
// meczów (index.js). Wymaga funkcji z common.js (getDdragonVersion,
// getPlayerColor, colorizeName, getPlayerDisplayName, formatTeamLabel).

const ROLE_ORDER_SCOREBOARD = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];

let championKeyMapCache = null;
async function getChampionKeyMap() {
  if (championKeyMapCache) return championKeyMapCache;
  const version = await getDdragonVersion();
  championKeyMapCache = {};
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
    const data = await res.json();
    Object.values(data.data || {}).forEach((c) => { championKeyMapCache[c.name] = c.id; });
  } catch (err) {
    // brak internetu - portrety championów po prostu się nie wyświetlą
  }
  return championKeyMapCache;
}

async function getChampionKey(championName) {
  const map = await getChampionKeyMap();
  return map[championName] || (championName || '').replace(/[^a-zA-Z0-9]/g, '');
}

async function getChampionSquareUrl(championName) {
  if (!championName) return '';
  const version = await getDdragonVersion();
  const key = await getChampionKey(championName);
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

/** Duży portret (splash art) championa - w przeciwieństwie do kwadratowej ikonki, nie zależy od wersji patcha. */
async function getChampionSplashUrl(championName) {
  if (!championName) return '';
  const key = await getChampionKey(championName);
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.png`;
}

function getItemIconUrl(itemId, version) {
  if (!itemId || Number(itemId) === 0) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

let summonerSpellMapCache = null;
async function getSummonerSpellMap() {
  if (summonerSpellMapCache) return summonerSpellMapCache;
  const version = await getDdragonVersion();
  summonerSpellMapCache = {};
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/summoner.json`);
    const data = await res.json();
    Object.values(data.data || {}).forEach((s) => { summonerSpellMapCache[s.key] = s.id; });
  } catch (err) {
    // brak internetu - ikony przywoływaczy po prostu się nie wyświetlą
  }
  return summonerSpellMapCache;
}

async function getSummonerSpellIconUrl(spellId) {
  if (!spellId) return '';
  const version = await getDdragonVersion();
  const map = await getSummonerSpellMap();
  const imgId = map[String(spellId)];
  if (!imgId) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imgId}.png`;
}

let runeIconMapCache = null;
async function getRuneIconMap() {
  if (runeIconMapCache) return runeIconMapCache;
  const version = await getDdragonVersion();
  runeIconMapCache = {};
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`);
    const data = await res.json();
    (data || []).forEach((style) => {
      runeIconMapCache[style.id] = style.icon;
      (style.slots || []).forEach((slot) => {
        (slot.runes || []).forEach((rune) => {
          runeIconMapCache[rune.id] = rune.icon;
        });
      });
    });
  } catch (err) {
    // brak internetu - ikony run po prostu się nie wyświetlą
  }
  return runeIconMapCache;
}

async function getRuneIconUrl(perkId) {
  if (!perkId) return '';
  const map = await getRuneIconMap();
  const iconPath = map[Number(perkId)];
  if (!iconPath) return '';
  return `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`;
}

function img(url, size, alt) {
  if (!url) return '';
  const el = document.createElement('img');
  el.src = url;
  el.width = size;
  el.height = size;
  el.alt = alt || '';
  return el.outerHTML;
}

/** Jak img(), ale ustawia tylko szerokość - bez atrybutu height przeglądarka skaluje proporcjonalnie, więc prostokątny splash art nie wychodzi ściśnięty do kwadratu. */
function imgWidth(url, width, alt) {
  if (!url) return '';
  const el = document.createElement('img');
  el.src = url;
  el.width = width;
  el.alt = alt || '';
  return el.outerHTML;
}

// 1x1 przezroczysty GIF, skalowany atrybutami width/height - pusty slot na
// przedmiot ma ten sam rozmiar co wypełniony, więc siatka nie "skacze".
const EMPTY_SLOT_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

/** Ikona przedmiotu w stałym rozmiarze - pusty slot (brak przedmiotu) pokazuje obramowany pusty kwadrat zamiast nic nie renderować. */
function itemSlotImg(itemId, ddragonVersion, alt) {
  const url = getItemIconUrl(itemId, ddragonVersion) || EMPTY_SLOT_IMG;
  const el = document.createElement('img');
  el.src = url;
  el.width = 24;
  el.height = 24;
  el.border = 1;
  el.alt = alt || '';
  return el.outerHTML;
}

function sortByRole(players) {
  return players.slice().sort((a, b) => ROLE_ORDER_SCOREBOARD.indexOf(a.teamPosition) - ROLE_ORDER_SCOREBOARD.indexOf(b.teamPosition));
}

/** "Sylas, None, Teemo" -> ["Sylas", "Teemo"] - "None" to placeholder Riota dla niewykorzystanego slotu banu, nie prawdziwy champion. */
function parseBanNames(bansField) {
  return (bansField || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && name.toLowerCase() !== 'none');
}

function bansFieldForTeam(match, team) {
  return team === 'BLUE' || team === 'LEFT' ? match.blueBans : match.redBans;
}

/** Zbanowany champion: ikonka + przekreślenie (<s> działa też na obrazkach, nie tylko na tekście). */
async function banIcon(championName) {
  const url = await getChampionSquareUrl(championName);
  const el = document.createElement('s');
  el.innerHTML = img(url, 32, championName);
  return el.outerHTML;
}

/** blueTowerKills/redTowerKills itd. - już zapisane wprost na meczu, bez potrzeby sięgania po rawDataJson. */
function objectivesForTeam(match, team) {
  const prefix = team === 'BLUE' || team === 'LEFT' ? 'blue' : 'red';
  return {
    tower: match[`${prefix}TowerKills`],
    baron: match[`${prefix}BaronKills`],
    dragon: match[`${prefix}DragonKills`],
    herald: match[`${prefix}HeraldKills`],
    inhib: match[`${prefix}InhibKills`],
  };
}

/** Belka nad statystykami JEDNEJ drużyny: bany + cele drużynowe (wieże/barony/smoki/heroldy/inhibitory) - osobno dla każdej drużyny, nie jedna wspólna dla obu. */
async function renderTeamBansAndObjectivesInto(container, match, team) {
  container.innerHTML = '';
  const names = parseBanNames(bansFieldForTeam(match, team));
  const obj = objectivesForTeam(match, team);

  const table = document.createElement('table');
  table.border = '1';
  table.width = '100%';

  const headerRow = document.createElement('tr');
  ['Bany', 'Wieże', 'Barony', 'Smoki', 'Heroldy', 'Inhibitory'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  const tr = document.createElement('tr');

  const iconsTd = document.createElement('td');
  if (names.length) {
    const icons = await Promise.all(names.map((name) => banIcon(name)));
    iconsTd.innerHTML = icons.join(' ');
  } else {
    iconsTd.textContent = '-';
  }
  tr.appendChild(iconsTd);

  [obj.tower, obj.baron, obj.dragon, obj.herald, obj.inhib].forEach((val) => {
    const td = document.createElement('td');
    td.align = 'center';
    td.textContent = val != null && val !== '' ? val : '-';
    tr.appendChild(td);
  });
  table.appendChild(tr);

  container.appendChild(table);
}

/**
 * Statystyki na poziomie pojedynczego gracza są dużo bogatsze niż to, co
 * trzymamy w znormalizowanym MatchPlayers (kda/cs/goldEarned/...) - reszta
 * (largestKillingSpree, podział obrażeń na typy, goldSpent, itd.) siedzi już
 * w rawDataJson (surowa odpowiedź /lol-match-history z LCU), tylko nigdy nie
 * była z niej wyciągana do osobnych kolumn. Czytamy ją tu wyłącznie do
 * WYŚWIETLENIA - bez zapisywania czegokolwiek do Arkusza czy zmiany schematu.
 * Mecze z arkusza ligi / starego JSON-a (bez tego surowego kształtu) po
 * prostu nie mają tych szczegółów - tabela pokaże wtedy czytelny komunikat
 * zamiast zmyślać dane.
 */
function extractRawStatsMap(match) {
  let raw;
  try {
    raw = JSON.parse(match.rawDataJson || '{}');
  } catch (err) {
    return {};
  }

  if (raw.matchHistory && Array.isArray(raw.matchHistory.participants)) {
    const identityByParticipantId = {};
    (raw.matchHistory.participantIdentities || []).forEach((pi) => {
      identityByParticipantId[pi.participantId] = pi.player || {};
    });
    const map = {};
    raw.matchHistory.participants.forEach((p) => {
      const identity = identityByParticipantId[p.participantId] || {};
      if (identity.puuid) map[identity.puuid] = p.stats || {};
    });
    return map;
  }

  // Stare pliki JSON (inne narzędzie, importowane przez legacyJsonParser.js)
  // niosą dokładnie ten sam zestaw pól co surowy blok statystyk z LCU, tylko
  // pod inną ścieżką: raw.legacyJson.participants[]._rawStats, z puuid już
  // wprost na tym samym obiekcie (bez potrzeby osobnego participantIdentities).
  if (raw.legacyJson && Array.isArray(raw.legacyJson.participants)) {
    const map = {};
    raw.legacyJson.participants.forEach((p) => {
      if (p.puuid && p._rawStats) map[p.puuid] = p._rawStats;
    });
    return map;
  }

  return {};
}

const DETAILED_STAT_SECTIONS = [
  {
    title: 'COMBAT',
    rows: [
      { label: 'Largest Killing Spree', field: 'largestKillingSpree' },
      { label: 'Largest Multi Kill', field: 'largestMultiKill' },
      { label: 'Crowd Control Score', field: 'timeCCingOthers' },
      { label: 'First Blood', field: 'firstBloodKill', bool: true },
    ],
  },
  {
    title: 'DAMAGE DEALT',
    rows: [
      { label: 'Total Damage to Champions', field: 'totalDamageDealtToChampions' },
      { label: 'Physical Damage to Champions', field: 'physicalDamageDealtToChampions' },
      { label: 'Magic Damage to Champions', field: 'magicDamageDealtToChampions' },
      { label: 'True Damage to Champions', field: 'trueDamageDealtToChampions' },
      { label: 'Total Damage Dealt', field: 'totalDamageDealt' },
      { label: 'Physical Damage Dealt', field: 'physicalDamageDealt' },
      { label: 'Magic Damage Dealt', field: 'magicDamageDealt' },
      { label: 'True Damage Dealt', field: 'trueDamageDealt' },
      { label: 'Largest Critical Strike', field: 'largestCriticalStrike' },
      { label: 'Total Damage To Turrets', field: 'damageDealtToTurrets' },
      { label: 'Total Damage To Objectives', field: 'damageDealtToObjectives' },
    ],
  },
  {
    title: 'DAMAGE TAKEN AND HEALED',
    rows: [
      { label: 'Damage Healed', field: 'totalHeal' },
      { label: 'Damage Taken', field: 'totalDamageTaken' },
      { label: 'Physical Damage Taken', field: 'physicalDamageTaken' },
      { label: 'Magic Damage Taken', field: 'magicalDamageTaken' },
      { label: 'True Damage Taken', field: 'trueDamageTaken' },
      { label: 'Self Mitigated Damage', field: 'damageSelfMitigated' },
    ],
  },
  {
    title: 'VISION',
    rows: [
      { label: 'Vision Score', field: 'visionScore' },
      { label: 'Wards Placed', field: 'wardsPlaced' },
      { label: 'Wards Destroyed', field: 'wardsKilled' },
      { label: 'Control Wards Purchased', field: 'visionWardsBoughtInGame' },
    ],
  },
  {
    title: 'INCOME',
    rows: [
      { label: 'Gold Earned', field: 'goldEarned' },
      { label: 'Gold Spent', field: 'goldSpent' },
      { label: 'Minions Killed', field: 'totalMinionsKilled' },
      { label: 'Neutral Minions Killed', field: 'neutralMinionsKilled' },
    ],
  },
  {
    title: 'MISC',
    rows: [
      { label: 'Towers Destroyed', field: 'turretKills' },
      { label: 'Inhibitors Destroyed', field: 'inhibitorKills' },
    ],
  },
];

/** Tabela statystyk kolumnowo (jeden gracz = jedna kolumna) z sekcjami zwijanymi po kliknięciu nagłówka. */
async function buildDetailedStatsTable(match, orderedPlayers, playersByPuuid, { showHeader = true } = {}) {
  const rawStatsMap = extractRawStatsMap(match);
  const hasDetailedStats = Object.keys(rawStatsMap).length > 0;
  const ddragonVersion = await getDdragonVersion();

  const table = document.createElement('table');
  table.border = '1';
  table.width = '100%';

  // Na liście meczów tabela jest "przyklejona" tuż pod kafelkiem, który już
  // pokazuje avatar/nick/wynik każdego gracza - nagłówek byłby tam zbędnym
  // powtórzeniem. Samodzielna strona scoreboard.html nie ma takiego kafelka
  // nad sobą, więc tam nagłówek zostaje jedyną identyfikacją kolumn.
  if (showHeader) {
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    for (const p of orderedPlayers) {
      const th = document.createElement('th');
      const squareUrl = await getChampionSquareUrl(p.championName);
      const known = playersByPuuid[p.puuid];
      const resultLabel = !match.winningTeam ? '' : match.winningTeam === p.team ? 'WIN' : 'LOSE';
      th.innerHTML = `${img(squareUrl, 40, p.championName)}<br />${colorizeName(getPlayerDisplayName(p.puuid, playersByPuuid), getPlayerColor(known || { puuid: p.puuid }))}<br />${resultLabel}`;
      if (match.winningTeam) th.bgcolor = match.winningTeam === p.team ? '#cceccc' : '#eccccc';
      headerRow.appendChild(th);
    }
    table.appendChild(headerRow);
  }

  const itemsRow = document.createElement('tr');
  const itemsLabelTd = document.createElement('td');
  itemsLabelTd.textContent = 'Przedmioty';
  itemsRow.appendChild(itemsLabelTd);
  for (const p of orderedPlayers) {
    const td = document.createElement('td');
    td.align = 'center';
    const regularItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((id) => itemSlotImg(id, ddragonVersion)).join(' ');
    td.innerHTML = `${regularItems} ${itemSlotImg(p.item6, ddragonVersion, 'Trinket/Ward')}`;
    itemsRow.appendChild(td);
  }
  table.appendChild(itemsRow);

  if (!hasDetailedStats) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = orderedPlayers.length + 1;
    td.textContent = 'Szczegółowe statystyki niedostępne dla tego meczu (brak surowych danych z klienta League - dotyczy głównie meczów z arkusza ligi/starych plików JSON).';
    tr.appendChild(td);
    table.appendChild(tr);
    return table;
  }

  DETAILED_STAT_SECTIONS.forEach((section) => {
    const sectionTh = document.createElement('th');
    sectionTh.colSpan = orderedPlayers.length + 1;
    sectionTh.align = 'left';
    sectionTh.textContent = `▼ ${section.title}`;
    const sectionRow = document.createElement('tr');
    sectionRow.appendChild(sectionTh);
    table.appendChild(sectionRow);

    const bodyRows = section.rows.map((rowDef) => {
      const tr = document.createElement('tr');
      const labelTd = document.createElement('td');
      labelTd.textContent = rowDef.label;
      tr.appendChild(labelTd);
      orderedPlayers.forEach((p) => {
        const td = document.createElement('td');
        td.align = 'center';
        const stats = rawStatsMap[p.puuid];
        if (rowDef.custom) {
          td.textContent = rowDef.custom(stats, p);
        } else if (rowDef.bool) {
          td.textContent = stats && stats[rowDef.field] ? '●' : '○';
        } else {
          const val = stats ? stats[rowDef.field] : undefined;
          td.textContent = val != null ? Number(val).toLocaleString('pl-PL') : '-';
        }
        tr.appendChild(td);
      });
      return tr;
    });
    bodyRows.forEach((tr) => table.appendChild(tr));

    let collapsed = false;
    sectionTh.title = 'Kliknij, żeby zwinąć/rozwinąć sekcję';
    sectionTh.addEventListener('click', () => {
      collapsed = !collapsed;
      sectionTh.textContent = `${collapsed ? '▶' : '▼'} ${section.title}`;
      bodyRows.forEach((tr) => { tr.hidden = collapsed; });
    });
  });

  return table;
}

/**
 * Rysuje pełną (wspólną dla obu drużyn) kolumnową tabelę statystyk do podanego
 * kontenera. Bany+cele drużynowe pokazywane są ODDZIELNIE, patrz
 * renderBansBarsInto - nie tutaj. `showHeader: false` pomija wiersz z
 * avatarem/nickiem/wynikiem - używane tam, gdzie tabela jest "przyklejona"
 * tuż pod kafelkiem meczu, który już tę identyfikację pokazuje (index.js).
 */
async function renderScoreboardBody(container, match, players, playersByPuuid, { showHeader = true } = {}) {
  const teams = sortTeamValues([...new Set(players.map((p) => p.team).filter(Boolean))]);
  const orderedPlayers = [];
  teams.forEach((team) => orderedPlayers.push(...sortByRole(players.filter((p) => p.team === team))));
  container.innerHTML = '';
  container.appendChild(await buildDetailedStatsTable(match, orderedPlayers, playersByPuuid, { showHeader }));
}

/**
 * Belki bany+cele obu drużyn OBOK SIEBIE (jedna na drużynę, nie jedna wspólna) -
 * do umieszczenia NAD kafelkiem meczu (index.js) albo nad nagłówkiem strony
 * scoreboard.html, a nie wewnątrz rozwijanych szczegółowych statystyk.
 */
async function renderBansBarsInto(container, match, teams) {
  container.innerHTML = '';
  const table = document.createElement('table');
  table.width = '100%';
  const tr = document.createElement('tr');
  for (const team of teams) {
    const td = document.createElement('td');
    td.width = '50%';
    td.valign = 'top';
    await renderTeamBansAndObjectivesInto(td, match, team);
    tr.appendChild(td);
  }
  table.appendChild(tr);
  container.appendChild(table);
}
