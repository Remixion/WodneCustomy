const PLAYER_FIELDS = [
  'summonerName', 'summonerId', 'accountId', 'profileIconId', 'summonerLevel',
  'soloTier', 'soloRank', 'soloLP', 'soloWins', 'soloLosses', 'soloWinRatePct',
  'flexTier', 'flexRank', 'flexLP', 'flexWins', 'flexLosses', 'flexWinRatePct',
  'top1ChampionName', 'top1ChampionPoints', 'top2ChampionName', 'top2ChampionPoints',
  'top3ChampionName', 'top3ChampionPoints', 'totalMasteryScore',
  'customGamesPlayed', 'customGamesWon', 'customGamesLost',
  'notes',
];

async function loadPlayers() {
  const players = await window.api.store.listPlayers();
  const thead = document.querySelector('#players-table thead');
  const tbody = document.querySelector('#players-table tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headRow = document.createElement('tr');
  const cornerTh = document.createElement('th');
  cornerTh.textContent = 'puuid';
  headRow.appendChild(cornerTh);
  PLAYER_FIELDS.forEach((f) => {
    const th = document.createElement('th');
    th.textContent = f;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="${PLAYER_FIELDS.length + 1}">Brak zapisanych graczy - dane pojawią się po zebraniu pierwszego meczu.</td></tr>`;
    return;
  }

  players.forEach((player) => {
    const tr = document.createElement('tr');
    const puuidTd = document.createElement('td');
    puuidTd.textContent = player.puuid ? player.puuid.slice(0, 8) + '...' : '';
    tr.appendChild(puuidTd);

    PLAYER_FIELDS.forEach((field) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = player[field] != null ? player[field] : '';
      input.size = field === 'summonerName' ? 20 : 8;
      input.addEventListener('change', async () => {
        await window.api.store.updatePlayerField(player.puuid, field, input.value);
        logEvent(`Zapisano ${field} dla ${player.summonerName || player.puuid}`);
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

document.getElementById('refresh-btn').addEventListener('click', loadPlayers);
document.getElementById('push-all-btn').addEventListener('click', async () => {
  const result = await window.api.sync.pushAllPlayers();
  logEvent(`Wysłano graczy do Google Sheets: ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
});

loadPlayers();
