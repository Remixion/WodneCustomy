async function renderPlayerList(players, individualStatsByPuuid) {
  const tbody = document.querySelector('#player-list-table tbody');
  tbody.innerHTML = '';
  if (!players.length) {
    tbody.innerHTML = '<tr><td colspan="5">Brak zapisanych graczy.</td></tr>';
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
    const iconUrl = await getPlayerAvatarUrl(player);
    if (iconUrl) img.src = iconUrl;
    avatarTd.appendChild(img);
    tr.appendChild(avatarTd);

    const nameTd = document.createElement('td');
    nameTd.innerHTML = colorizeName(player.nick || player.summonerName || player.puuid, getPlayerColor(player));
    tr.appendChild(nameTd);

    const gamesTd = document.createElement('td');
    gamesTd.textContent = stats ? stats.gamesPlayed : 0;
    tr.appendChild(gamesTd);

    const winrateTd = document.createElement('td');
    winrateTd.textContent = stats ? stats.winRatePct.toFixed(1) + '%' : '-';
    tr.appendChild(winrateTd);

    const linkTd = document.createElement('td');
    const a = document.createElement('a');
    a.href = `profile.html?puuid=${encodeURIComponent(player.puuid)}`;
    a.textContent = 'Zobacz profil';
    linkTd.appendChild(a);
    tr.appendChild(linkTd);

    tbody.appendChild(tr);
  }
}

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
  const name = getPlayerDisplayName(puuid, player && player.summonerName, playersByPuuid);

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
    <dt>Ranga Flex</dt><dd>${player && player.flexTier ? `${player.flexTier} ${player.flexRank} (${player.flexLP} LP) - ${player.flexWins}W/${player.flexLosses}L` : 'brak danych'}</dd>
    <dt>Rozegrane custom gry</dt><dd>${stats ? stats.gamesPlayed : 0}</dd>
    <dt>Bilans W/L</dt><dd>${stats ? `${stats.wins}W / ${stats.losses}L (${stats.winRatePct.toFixed(1)}%)` : '-'}</dd>
    <dt>Średnie KDA</dt><dd>${stats ? (stats.avgKda === null ? 'Perfect' : stats.avgKda.toFixed(2)) : '-'} (${stats ? stats.avgKills.toFixed(1) : 0}/${stats ? stats.avgDeaths.toFixed(1) : 0}/${stats ? stats.avgAssists.toFixed(1) : 0})</dd>
    <dt>Ulubiony champion</dt><dd>${(stats && stats.favoriteChampion) || '-'}</dd>
    <dt>Ulubiona rola</dt><dd>${(stats && stats.favoriteRole) || '-'}</dd>
    <dt>Notatki</dt><dd>${(player && player.notes) || ''}</dd>
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

async function load() {
  const statusEl = document.getElementById('status-message');
  try {
    const data = await fetchData();
    statusEl.textContent = `Dane zaktualizowano: ${formatDate(data.generatedAt)}`;
    const playersByPuuid = buildPlayersByPuuid(data.players);
    const individualStats = computeIndividualStats(data.matchPlayers, playersByPuuid);
    const individualStatsByPuuid = {};
    individualStats.forEach((s) => (individualStatsByPuuid[s.puuid] = s));

    const puuid = qs('puuid');
    await renderProfileDetail(puuid, data, individualStats);
    await renderPlayerList(data.players || [], individualStatsByPuuid);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
