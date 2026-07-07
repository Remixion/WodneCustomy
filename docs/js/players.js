// Tylko pola faktycznie obecne w PLAYERS_HEADERS (Code.gs) - w przeciwieństwie
// do apki desktopowej, ta strona nie ma lokalnego magazynu jako zapasowego
// miejsca zapisu, więc edycja pola spoza Arkusza (np. notes, Flex, mistrzostwo)
// nie miałaby się gdzie zapisać i kończyłaby się błędem serwera.
const PLAYER_FIELDS = [
  'nick', 'color', 'avatarSource', 'discordNick', 'discordAvatarUrl',
  'summonerName', 'summonerId', 'accountId', 'profileIconId', 'summonerLevel',
  'soloTier', 'soloRank', 'soloLP', 'soloWins', 'soloLosses',
];

async function renderProfileDetail(puuid, data, individualStats) {
  const section = document.getElementById('profile-detail-section');
  const player = (data.players || []).find((p) => p.puuid === puuid);
  const stats = individualStats.find((s) => s.puuid === puuid);

  if (!player && !stats) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const playersByPuuid = buildPlayersByPuuid(data.players);
  const color = getPlayerColor(player || { puuid });
  const name = getPlayerDisplayName(puuid, playersByPuuid);

  document.getElementById('profile-name').innerHTML = colorizeName(name, color);

  const avatarImg = document.getElementById('profile-avatar');
  const iconUrl = await getPlayerAvatarUrl(player);
  if (iconUrl) avatarImg.src = iconUrl;
  avatarImg.alt = name;

  const dl = document.getElementById('profile-info-list');
  dl.innerHTML = `
    <dt>Nazwa przywoływacza (LoL)</dt><dd>${(player && player.summonerName) || '-'}</dd>
    <dt>Poziom konta</dt><dd>${(player && player.summonerLevel) || '-'}</dd>
    <dt>Ranga Solo/Duo</dt><dd>${player && player.soloTier ? `${player.soloTier} ${player.soloRank} (${player.soloLP} LP) - ${player.soloWins}W/${player.soloLosses}L` : 'brak danych'}</dd>
    <dt>Rozegrane custom gry</dt><dd>${stats ? stats.gamesPlayed : 0}</dd>
    <dt>Bilans W/L</dt><dd>${stats ? `${stats.wins}W / ${stats.losses}L (${stats.winRatePct.toFixed(1)}%)` : '-'}</dd>
    <dt>Średnie KDA</dt><dd>${stats ? (stats.avgKda === null ? 'Perfect' : stats.avgKda.toFixed(2)) : '-'} (${stats ? stats.avgKills.toFixed(1) : 0}/${stats ? stats.avgDeaths.toFixed(1) : 0}/${stats ? stats.avgAssists.toFixed(1) : 0})</dd>
    <dt>Ulubiony champion</dt><dd>${(stats && stats.favoriteChampion) || '-'}</dd>
    <dt>Ulubiona rola</dt><dd>${(stats && stats.favoriteRole) || '-'}</dd>
  `;

  const recentMatches = (data.matchPlayers || [])
    .filter((mp) => mp.puuid === puuid)
    .map((mp) => ({ mp, match: (data.matches || []).find((m) => String(m.matchId) === String(mp.matchId)) }))
    .filter((r) => r.match)
    .sort((a, b) => new Date(b.match.gameCreationDate) - new Date(a.match.gameCreationDate))
    .slice(0, 10);

  const tbody = document.querySelector('#recent-matches-table tbody');
  tbody.innerHTML = '';
  if (!recentMatches.length) {
    tbody.innerHTML = '<tr><td colspan="8">Brak rozegranych meczów.</td></tr>';
    return;
  }
  recentMatches.forEach(({ mp, match }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(match.gameCreationDate)}</td>
      <td>${mp.championName || ''}</td>
      <td>${isWinValue(mp.win) ? 'Wygrana' : 'Przegrana'}</td>
      <td>${mp.kills}/${mp.deaths}/${mp.assists}</td>
      <td>${mp.kda || ''}</td>
      <td>${mp.cs != null ? mp.cs : ''}</td>
      <td>${mp.damageDealtToChampions != null ? mp.damageDealtToChampions : ''}</td>
      <td><a href="match.html?matchId=${encodeURIComponent(match.matchId)}">Szczegóły</a></td>
    `;
    tbody.appendChild(tr);
  });
}

async function renderPlayersTable(players, individualStatsByPuuid) {
  const thead = document.querySelector('#players-table thead');
  const tbody = document.querySelector('#players-table tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headRow = document.createElement('tr');
  ['Avatar', 'Podgląd', 'puuid', 'Gry', '% wygranych'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  PLAYER_FIELDS.forEach((f) => {
    const th = document.createElement('th');
    th.textContent = f;
    headRow.appendChild(th);
  });
  const actionsTh = document.createElement('th');
  actionsTh.textContent = 'Akcje';
  headRow.appendChild(actionsTh);
  thead.appendChild(headRow);

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="${PLAYER_FIELDS.length + 6}">Brak zapisanych graczy.</td></tr>`;
    return;
  }

  for (const player of players) {
    const stats = individualStatsByPuuid[player.puuid];
    const tr = document.createElement('tr');

    const avatarTd = document.createElement('td');
    const img = document.createElement('img');
    img.width = 32;
    img.height = 32;
    img.alt = '';
    const avatarUrl = await getPlayerAvatarUrl(player);
    if (avatarUrl) img.src = avatarUrl;
    avatarTd.appendChild(img);
    tr.appendChild(avatarTd);

    const previewTd = document.createElement('td');
    previewTd.innerHTML = colorizeName(displayNameForPlayer(player), getPlayerColor(player));
    tr.appendChild(previewTd);

    const puuidTd = document.createElement('td');
    puuidTd.textContent = player.puuid ? String(player.puuid).slice(0, 8) + '...' : '';
    tr.appendChild(puuidTd);

    const gamesTd = document.createElement('td');
    gamesTd.textContent = stats ? stats.gamesPlayed : 0;
    tr.appendChild(gamesTd);

    const winrateTd = document.createElement('td');
    winrateTd.textContent = stats ? stats.winRatePct.toFixed(1) + '%' : '-';
    tr.appendChild(winrateTd);

    PLAYER_FIELDS.forEach((field) => {
      const td = document.createElement('td');
      td.textContent = player[field] != null ? player[field] : '';
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    const profileLink = document.createElement('a');
    profileLink.href = `players.html?puuid=${encodeURIComponent(player.puuid)}`;
    profileLink.textContent = 'Profil';
    actionsTd.appendChild(profileLink);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  }
}

async function load() {
  const statusEl = document.getElementById('status-message');
  try {
    const data = await fetchData();
    statusEl.textContent = `Dane zaktualizowano: ${formatDate(data.generatedAt)} - liczba graczy: ${data.players.length}`;

    const playersByPuuid = buildPlayersByPuuid(data.players);
    const individualStats = computeIndividualStats(data.matchPlayers, playersByPuuid);
    const individualStatsByPuuid = {};
    individualStats.forEach((s) => (individualStatsByPuuid[s.puuid] = s));

    const puuid = qs('puuid');
    await renderProfileDetail(puuid, data, individualStats);
    await renderPlayersTable(data.players || [], individualStatsByPuuid);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
