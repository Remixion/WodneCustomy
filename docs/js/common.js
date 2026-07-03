function getConfig() {
  return {
    appsScriptUrl: localStorage.getItem('appsScriptUrl') || '',
    sharedSecret: localStorage.getItem('sharedSecret') || '',
  };
}

function setConfig(cfg) {
  localStorage.setItem('appsScriptUrl', cfg.appsScriptUrl || '');
  localStorage.setItem('sharedSecret', cfg.sharedSecret || '');
}

async function fetchData() {
  const { appsScriptUrl } = getConfig();
  if (!appsScriptUrl) throw new Error('Brak skonfigurowanego adresu URL Apps Script. Przejdź do zakładki Ustawienia.');
  const res = await fetch(appsScriptUrl, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Nieznany błąd serwera.');
  return json.data;
}

async function postAction(action, payload) {
  const { appsScriptUrl, sharedSecret } = getConfig();
  if (!appsScriptUrl) throw new Error('Brak skonfigurowanego adresu URL Apps Script. Przejdź do zakładki Ustawienia.');
  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: sharedSecret, action, payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Nieznany błąd serwera.');
  return json;
}

function logEvent(message) {
  const list = document.getElementById('log-list');
  if (!list) return;
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString('pl-PL');
  item.textContent = `[${time}] ${message}`;
  list.prepend(item);
}

function formatDuration(seconds) {
  if (seconds === '' || seconds === null || seconds === undefined) return '';
  const total = Number(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
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

// ---- Statystyki pomocnicze (współdzielone przez stats.js / profile.js) ----

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

function getPlayerDisplayName(puuid, summonerNameFallback, playersByPuuid) {
  const p = playersByPuuid[puuid];
  if (p && p.nick) return p.nick;
  if (p && p.summonerName) return p.summonerName;
  if (summonerNameFallback) return summonerNameFallback;
  return puuid ? String(puuid).slice(0, 8) + '...' : 'nieznany';
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
