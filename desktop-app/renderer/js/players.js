const PLAYER_FIELDS = [
  'nick', 'color', 'avatarSource', 'discordNick', 'discordAvatarUrl',
  'summonerName', 'summonerId', 'accountId', 'profileIconId', 'summonerLevel',
  'soloTier', 'soloRank', 'soloLP', 'soloWins', 'soloLosses', 'soloWinRatePct',
  'flexTier', 'flexRank', 'flexLP', 'flexWins', 'flexLosses', 'flexWinRatePct',
  'top1ChampionName', 'top1ChampionPoints', 'top2ChampionName', 'top2ChampionPoints',
  'top3ChampionName', 'top3ChampionPoints', 'totalMasteryScore',
  'customGamesPlayed', 'customGamesWon', 'customGamesLost',
  'notes',
];

async function renderProfileDetail(puuid, players, matches, matchPlayers, individualStats) {
  const section = document.getElementById('profile-detail-section');
  const player = (players || []).find((p) => p.puuid === puuid);
  const stats = individualStats.find((s) => s.puuid === puuid);

  if (!player && !stats) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const playersByPuuid = buildPlayersByPuuid(players);
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
    <dt>Ranga Flex</dt><dd>${player && player.flexTier ? `${player.flexTier} ${player.flexRank} (${player.flexLP} LP) - ${player.flexWins}W/${player.flexLosses}L` : 'brak danych'}</dd>
    <dt>Rozegrane custom gry</dt><dd>${stats ? stats.gamesPlayed : 0}</dd>
    <dt>Bilans W/L</dt><dd>${stats ? `${stats.wins}W / ${stats.losses}L (${stats.winRatePct.toFixed(1)}%)` : '-'}</dd>
    <dt>Średnie KDA</dt><dd>${stats ? (stats.avgKda === null ? 'Perfect' : stats.avgKda.toFixed(2)) : '-'} (${stats ? stats.avgKills.toFixed(1) : 0}/${stats ? stats.avgDeaths.toFixed(1) : 0}/${stats ? stats.avgAssists.toFixed(1) : 0})</dd>
    <dt>Ulubiony champion</dt><dd>${(stats && stats.favoriteChampion) || '-'}</dd>
    <dt>Ulubiona rola</dt><dd>${(stats && stats.favoriteRole) || '-'}</dd>
    <dt>Notatki</dt><dd>${(player && player.notes) || ''}</dd>
  `;

  const recentMatches = (matchPlayers || [])
    .filter((mp) => mp.puuid === puuid)
    .map((mp) => ({ mp, match: (matches || []).find((m) => String(m.matchId) === String(mp.matchId)) }))
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
    tbody.innerHTML = `<tr><td colspan="${PLAYER_FIELDS.length + 6}">Brak zapisanych graczy - dane pojawią się po zebraniu pierwszego meczu.</td></tr>`;
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
    puuidTd.textContent = player.puuid ? player.puuid.slice(0, 8) + '...' : '';
    tr.appendChild(puuidTd);

    const gamesTd = document.createElement('td');
    gamesTd.textContent = stats ? stats.gamesPlayed : 0;
    tr.appendChild(gamesTd);

    const winrateTd = document.createElement('td');
    winrateTd.textContent = stats ? stats.winRatePct.toFixed(1) + '%' : '-';
    tr.appendChild(winrateTd);

    PLAYER_FIELDS.forEach((field) => {
      const td = document.createElement('td');
      let input;
      if (field === 'avatarSource') {
        input = document.createElement('select');
        [['lol', 'League of Legends'], ['discord', 'Discord']].forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          if ((player.avatarSource || 'lol') === value) option.selected = true;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = player[field] != null ? player[field] : '';
        input.size = field === 'summonerName' || field === 'nick' ? 20 : 8;
        if (field === 'color') input.placeholder = '#rrggbb (puste = kolor domyślny z palety)';
        if (field === 'discordNick') input.placeholder = 'nazwa użytkownika lub nick na serwerze Discord';
        if (field === 'discordAvatarUrl') input.placeholder = 'link do avatara Discord (wypełniany automatycznie lub ręcznie)';
      }
      input.addEventListener('change', async () => {
        await window.api.store.updatePlayerField(player.puuid, field, input.value);
        logEvent(`Zapisano ${field} dla ${displayNameForPlayer(player)}`);
        if (['nick', 'color', 'avatarSource', 'discordAvatarUrl', 'profileIconId'].includes(field)) load();
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');

    const profileLink = document.createElement('a');
    profileLink.href = `players.html?puuid=${encodeURIComponent(player.puuid)}`;
    profileLink.textContent = 'Profil';
    actionsTd.appendChild(profileLink);
    actionsTd.appendChild(document.createTextNode(' | '));

    const deleteLocalBtn = document.createElement('button');
    deleteLocalBtn.type = 'button';
    deleteLocalBtn.textContent = 'Usuń lokalnie';
    deleteLocalBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć gracza ${displayNameForPlayer(player)} z lokalnego magazynu? (nie usuwa danych z arkusza)`)) return;
      await window.api.store.deletePlayer(player.puuid);
      logEvent(`Usunięto gracza ${displayNameForPlayer(player)} lokalnie`);
      load();
    });
    actionsTd.appendChild(deleteLocalBtn);
    actionsTd.appendChild(document.createTextNode(' | '));

    const deleteSheetsBtn = document.createElement('button');
    deleteSheetsBtn.type = 'button';
    deleteSheetsBtn.textContent = 'Usuń z Sheets';
    deleteSheetsBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć gracza ${displayNameForPlayer(player)} z Arkusza Google? (dane lokalne zostaną)`)) return;
      deleteSheetsBtn.disabled = true;
      const result = await window.api.sync.deletePlayer(player.puuid);
      logEvent(`Usunięto gracza ${displayNameForPlayer(player)} z Sheets: ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
      deleteSheetsBtn.disabled = false;
    });
    actionsTd.appendChild(deleteSheetsBtn);

    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }
}

async function load() {
  const storedMatches = await window.api.store.listMatches();
  const players = await window.api.store.refreshPlayersFromSheets();
  const matches = storedMatches.map((m) => m.match);
  const matchPlayers = storedMatches.reduce((acc, m) => acc.concat(m.players), []);

  const playersByPuuid = buildPlayersByPuuid(players);
  const individualStats = computeIndividualStats(matchPlayers, playersByPuuid);
  const individualStatsByPuuid = {};
  individualStats.forEach((s) => (individualStatsByPuuid[s.puuid] = s));

  const puuid = qs('puuid');
  await renderProfileDetail(puuid, players, matches, matchPlayers, individualStats);
  await renderPlayersTable(players, individualStatsByPuuid);
}

document.getElementById('refresh-btn').addEventListener('click', load);
document.getElementById('push-all-btn').addEventListener('click', async () => {
  const result = await window.api.sync.pushAllPlayers();
  logEvent(`Wysłano graczy do Google Sheets: ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
});

/** Gracze, których puuid nie występuje w żadnym lokalnie zapisanym meczu ("Rozegrane custom gry: 0" w profilu). */
document.getElementById('cleanup-zero-games-btn').addEventListener('click', async () => {
  const players = await window.api.store.listPlayers();
  const storedMatches = await window.api.store.listMatches();
  const puuidsWithGames = new Set();
  storedMatches.forEach((m) => (m.players || []).forEach((p) => { if (p.puuid) puuidsWithGames.add(p.puuid); }));

  const ghosts = players.filter((p) => p.puuid && !puuidsWithGames.has(p.puuid));
  if (!ghosts.length) {
    logEvent('Brak graczy bez rozegranych meczów.');
    return;
  }

  const names = ghosts.map((p) => displayNameForPlayer(p)).join(', ');
  if (!confirm(`Usunąć ${ghosts.length} gracz(y) bez rozegranych meczów (lokalnie i z Arkusza Google): ${names}?`)) return;

  for (const p of ghosts) {
    await window.api.store.deletePlayer(p.puuid);
    const result = await window.api.sync.deletePlayer(p.puuid);
    logEvent(`Usunięto gracza ${displayNameForPlayer(p)}: lokalnie OK, Sheets ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
  }
  load();
});

load();
