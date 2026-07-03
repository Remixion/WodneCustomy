// Renderowanie zakładki Statystyki. Obliczenia: patrz statsCore.js (i pomocnicze funkcje w common.js).

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
        tr.innerHTML = `<td>${i + 1}</td><td>${colorizeName(s.displayName, s.color)}</td><td>${def.format(s)}</td>`;
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
      <td>${colorizeName(s.displayName, s.color)}</td>
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
