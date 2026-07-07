function logEvent(message) {
  const list = document.getElementById('log-list');
  if (!list) return;
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString('pl-PL');
  item.textContent = `[${time}] ${message}`;
  list.prepend(item);
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch (err) {
    return iso;
  }
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Czytelna etykieta źródła danych meczu (patrz match.dataSource) - zobacz też komentarze w matchBuilder.js/legacyJsonParser.js/roflParser.js/leagueSheetParser.js. */
const DATA_SOURCE_LABELS = {
  'lcu-live': 'Na żywo (koniec gry)',
  'lcu-history': 'Historia klienta League',
  'rofl-stats': 'Statystyki z pliku .rofl',
  'legacy-json': 'Stary plik JSON',
  manual: 'Arkusz ligi (ręcznie wpisane)',
  placeholder: 'Brak danych (tylko ID)',
};

function formatDataSource(dataSource) {
  return DATA_SOURCE_LABELS[dataSource] || dataSource || '-';
}

/**
 * Etykieta strony meczu (pole player.team / match.winningTeam). BLUE/RED to
 * prawdziwe, potwierdzone strony z klienta League. LEFT/RIGHT pochodzą z
 * ręcznie prowadzonego arkusza ligi sprzed tej apki, gdzie strona była
 * przydzielana losowo (nieznana wtedy prawdziwa strona Blue/Red) - stąd
 * osobna etykieta, żeby nie sugerować pewności, której w rzeczywistości nie ma.
 */
const TEAM_LABELS = {
  BLUE: 'Drużyna niebieska',
  RED: 'Drużyna czerwona',
  LEFT: 'Strona lewa (nieprzypisana do Blue/Red)',
  RIGHT: 'Strona prawa (nieprzypisana do Blue/Red)',
};
const TEAM_ORDER = ['BLUE', 'LEFT', 'RED', 'RIGHT'];

function formatTeamLabel(team) {
  return TEAM_LABELS[team] || team || 'Nieznana strona';
}

/** Sortuje listę wartości "team" tak, żeby BLUE/LEFT zawsze wypadały przed RED/RIGHT, a nieznane na końcu. */
function sortTeamValues(teams) {
  return teams.slice().sort((a, b) => {
    const ia = TEAM_ORDER.indexOf(a);
    const ib = TEAM_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ---- Statystyki pomocnicze (współdzielone przez stats.js / players.js) ----

function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isWinValue(value) {
  return value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1';
}

function buildPlayersByPuuid(players) {
  const map = {};
  (players || []).forEach((p) => {
    if (p.puuid) map[p.puuid] = p;
  });
  return map;
}

function mostFrequent(values) {
  const counts = {};
  values.forEach((v) => {
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  let best = '';
  let bestCount = 0;
  Object.keys(counts).forEach((k) => {
    if (counts[k] > bestCount) {
      best = k;
      bestCount = counts[k];
    }
  });
  return { value: best, count: bestCount };
}

function shortenPuuid(puuid) {
  return puuid ? String(puuid).slice(0, 8) + '...' : 'nieznany';
}

/**
 * Nick jest jedyną nazwą pokazywaną w większości apki - surowe summonerName
 * (prawdziwe Riot ID) pojawia się celowo tylko w Profilu i Losowaniu, zawsze
 * obok nicku, nigdy zamiast niego. Gdy nick nie jest jeszcze przypisany, tutaj
 * pokazujemy skrócone puuid, a NIE summonerName.
 */
function getPlayerDisplayName(puuid, playersByPuuid) {
  const p = playersByPuuid[puuid];
  if (p && p.nick) return p.nick;
  return shortenPuuid(puuid);
}

/** Jak getPlayerDisplayName, ale gdy obiekt gracza jest już w ręku (bez potrzeby mapy puuid->gracz). */
function displayNameForPlayer(player) {
  if (player && player.nick) return player.nick;
  return shortenPuuid(player && player.puuid);
}

// ---- Kolor gracza (paleta + przypisanie deterministyczne po puuid) ----

const COLOR_PALETTE = [
  '#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#469990', '#9A6324',
  '#800000', '#808000', '#000075', '#a9a9a9', '#ff4500',
  '#2e8b57', '#4682b4', '#b8860b', '#8b008b', '#556b2f',
];

function hashStringToIndex(str, modulo) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

/** Zwraca kolor gracza: ręcznie ustawiony (pole "color") albo domyślny z palety, przypisany deterministycznie po puuid. */
function getPlayerColor(player) {
  if (player && player.color) return player.color;
  const key = (player && (player.puuid || player.summonerName)) || 'unknown';
  return COLOR_PALETTE[hashStringToIndex(String(key), COLOR_PALETTE.length)];
}

/** Koloruje nazwę gracza znacznikiem <font> (celowo bez CSS - patrz README). */
function colorizeName(name, color) {
  const span = document.createElement('font');
  span.setAttribute('color', color);
  span.textContent = name;
  return span.outerHTML;
}

// ---- Awatar gracza (Data Dragon) ----

let cachedDdragonVersion = null;

async function getDdragonVersion() {
  if (cachedDdragonVersion) return cachedDdragonVersion;
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    cachedDdragonVersion = versions[0];
  } catch (err) {
    cachedDdragonVersion = '14.23.1'; // brak internetu - awaryjna, może nieaktualna wersja
  }
  return cachedDdragonVersion;
}

async function getProfileIconUrl(profileIconId) {
  if (profileIconId === '' || profileIconId === null || profileIconId === undefined) return '';
  const version = await getDdragonVersion();
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${profileIconId}.png`;
}

/**
 * Zwraca URL awatara gracza zgodnie z wybranym domyślnym źródłem (pole "avatarSource"):
 * "discord" (zapisany awatar z Discorda) albo domyślnie "lol" (ikona profilu z League).
 * Jeśli preferowane źródło jest niedostępne, próbuje drugiego jako zapasowego.
 */
async function getPlayerAvatarUrl(player) {
  if (!player) return '';
  if (player.avatarSource === 'discord') {
    if (player.discordAvatarUrl) return player.discordAvatarUrl;
    return getProfileIconUrl(player.profileIconId);
  }
  const lolUrl = await getProfileIconUrl(player.profileIconId);
  return lolUrl || player.discordAvatarUrl || '';
}
