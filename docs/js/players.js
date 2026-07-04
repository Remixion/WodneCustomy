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

async function load() {
  const statusEl = document.getElementById('status-message');
  try {
    const data = await fetchData();
    statusEl.textContent = `Dane zaktualizowano: ${formatDate(data.generatedAt)} - liczba graczy: ${data.players.length}`;
    await renderPlayers(data.players);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

async function renderPlayers(players) {
  const thead = document.querySelector('#players-table thead');
  const tbody = document.querySelector('#players-table tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headRow = document.createElement('tr');
  const avatarTh = document.createElement('th');
  avatarTh.textContent = 'Avatar';
  headRow.appendChild(avatarTh);
  const previewTh = document.createElement('th');
  previewTh.textContent = 'Podgląd';
  headRow.appendChild(previewTh);
  const cornerTh = document.createElement('th');
  cornerTh.textContent = 'puuid';
  headRow.appendChild(cornerTh);
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
    tbody.innerHTML = `<tr><td colspan="${PLAYER_FIELDS.length + 4}">Brak zapisanych graczy.</td></tr>`;
    return;
  }

  for (const player of players) {
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
    previewTd.innerHTML = colorizeName(player.nick || player.summonerName || player.puuid, getPlayerColor(player));
    tr.appendChild(previewTd);

    const puuidTd = document.createElement('td');
    puuidTd.textContent = player.puuid ? String(player.puuid).slice(0, 8) + '...' : '';
    tr.appendChild(puuidTd);

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
        if (field === 'discordAvatarUrl') input.placeholder = 'link do avatara Discord (ręcznie lub z apki desktopowej)';
      }
      input.addEventListener('change', async () => {
        try {
          await postAction('updatePlayerField', { puuid: player.puuid, field, value: input.value });
          logEvent(`Zapisano ${field} dla ${player.summonerName || player.puuid}`);
          if (['nick', 'color', 'avatarSource', 'discordAvatarUrl', 'profileIconId'].includes(field)) load();
        } catch (err) {
          logEvent(`Błąd zapisu ${field}: ${err.message}`);
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Usuń z Sheets';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć gracza ${player.nick || player.summonerName || player.puuid} z Arkusza Google?`)) return;
      deleteBtn.disabled = true;
      try {
        await postAction('deletePlayer', { puuid: player.puuid });
        logEvent(`Usunięto gracza ${player.summonerName || player.puuid} z Sheets`);
        load();
      } catch (err) {
        logEvent(`Błąd usuwania gracza: ${err.message}`);
        deleteBtn.disabled = false;
      }
    });
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  }
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
