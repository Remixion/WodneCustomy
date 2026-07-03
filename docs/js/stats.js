// ---- Obliczenia (współdzielona logika - patrz też desktop-app/renderer/js/stats.js) ----

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

function displayName(puuid, summonerNameFallback, playersByPuuid) {
  const p = playersByPuuid[puuid];
  if (p && p.nick) return p.nick;
  if (p && p.summonerName) return p.summonerName;
  if (summonerNameFallback) return summonerNameFallback;
  return puuid ? String(puuid).slice(0, 8) + '...' : 'nieznany';
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

    return {
      puuid,
      displayName: displayName(puuid, games[0].summonerName, playersByPuuid),
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

// ---- Renderowanie ----

function renderRankings(individualStats) {
  const container = document.getElementById('rankings-container');
  container.innerHTML = '';
  RANKING_DEFS.forEach((def) => {
    const section = document.createElement('section');
    const h3 = document.createElement('h3');
    h3.textContent = def.title;
    section.appendChild(h3);

    const ranked = rankBy(individualStats, def).slice(0, 10);
    const table = document.createElement('table');
    table.setAttribute('border', '1');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Miejsce</th><th>Gracz</th><th>Wartość</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    if (!ranked.length) {
      tbody.innerHTML = '<tr><td colspan="3">Brak danych.</td></tr>';
    } else {
      ranked.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${s.displayName}</td><td>${def.format(s)}</td>`;
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
  });
}

function renderIndividualStats(individualStats) {
  const thead = document.querySelector('#individual-stats-table thead');
  const tbody = document.querySelector('#individual-stats-table tbody');
  thead.innerHTML = `
    <tr>
      <th>Gracz</th><th>Gry</th><th>Wygrane</th><th>Przegrane</th><th>% wygranych</th>
      <th>Śr. K</th><th>Śr. D</th><th>Śr. A</th><th>Śr. KDA</th>
      <th>Śr. CS</th><th>Śr. CS/min</th><th>Śr. złoto</th>
      <th>Śr. obrażenia bohaterom</th><th>Śr. przyjęte obrażenia</th><th>Śr. Vision Score</th>
      <th>Pentakille</th><th>Ulubiony champion</th><th>Ulubiona rola</th>
    </tr>
  `;
  tbody.innerHTML = '';
  if (!individualStats.length) {
    tbody.innerHTML = '<tr><td colspan="18">Brak danych.</td></tr>';
    return;
  }
  const sorted = individualStats.slice().sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  sorted.forEach((s) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.displayName}</td>
      <td>${s.gamesPlayed}</td>
      <td>${s.wins}</td>
      <td>${s.losses}</td>
      <td>${s.winRatePct.toFixed(1)}%</td>
      <td>${s.avgKills.toFixed(1)}</td>
      <td>${s.avgDeaths.toFixed(1)}</td>
      <td>${s.avgAssists.toFixed(1)}</td>
      <td>${s.avgKda === null ? 'Perfect' : s.avgKda.toFixed(2)}</td>
      <td>${s.avgCs.toFixed(1)}</td>
      <td>${s.avgCsPerMin.toFixed(2)}</td>
      <td>${Math.round(s.avgGoldEarned)}</td>
      <td>${Math.round(s.avgDamageDealtToChampions)}</td>
      <td>${Math.round(s.avgDamageTaken)}</td>
      <td>${s.avgVisionScore.toFixed(1)}</td>
      <td>${s.totalPentaKills}</td>
      <td>${s.favoriteChampion || ''}</td>
      <td>${s.favoriteRole || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderGeneralStats(general) {
  const dl = document.getElementById('general-stats-list');
  const durationText = (sec) => {
    const m = Math.floor(numberOr(sec) / 60);
    const s = numberOr(sec) % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  dl.innerHTML = `
    <dt>Liczba zarejestrowanych meczów</dt><dd>${general.totalMatches}</dd>
    <dt>Łączny czas gry</dt><dd>${durationText(general.totalDurationSec)}</dd>
    <dt>Średni czas trwania meczu</dt><dd>${durationText(general.avgDurationSec)}</dd>
    <dt>Najdłuższy mecz</dt><dd>${general.longestMatch ? durationText(general.longestMatch.gameDurationSec) + ' (' + general.longestMatch.matchId + ')' : '-'}</dd>
    <dt>Najkrótszy mecz</dt><dd>${general.shortestMatch ? durationText(general.shortestMatch.gameDurationSec) + ' (' + general.shortestMatch.matchId + ')' : '-'}</dd>
    <dt>Zwycięstwa drużyny niebieskiej</dt><dd>${general.blueWins} (${general.blueWinRatePct.toFixed(1)}%)</dd>
    <dt>Zwycięstwa drużyny czerwonej</dt><dd>${general.redWins} (${general.redWinRatePct.toFixed(1)}%)</dd>
    <dt>Najczęściej wybierany champion</dt><dd>${general.mostPickedChampion || '-'} (${general.mostPickedChampionCount}x)</dd>
    <dt>Najczęściej banowany champion</dt><dd>${general.mostBannedChampion || '-'} (${general.mostBannedChampionCount}x)</dd>
    <dt>Łączna liczba zabójstw we wszystkich meczach</dt><dd>${general.totalKills}</dd>
    <dt>Średnia liczba zabójstw na mecz</dt><dd>${general.avgKillsPerGame.toFixed(1)}</dd>
    <dt>Łączna liczba Pentakilli</dt><dd>${general.totalPentaKills}</dd>
  `;
}

async function load() {
  const statusEl = document.getElementById('status-message');
  try {
    const data = await fetchData();
    statusEl.textContent = `Dane zaktualizowano: ${formatDate(data.generatedAt)}`;
    const playersByPuuid = buildPlayersByPuuid(data.players);
    const individualStats = computeIndividualStats(data.matchPlayers, playersByPuuid);
    const general = computeGeneralStats(data.matches, data.matchPlayers);
    renderRankings(individualStats);
    renderIndividualStats(individualStats);
    renderGeneralStats(general);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
