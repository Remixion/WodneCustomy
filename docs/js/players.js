const PLAYER_FIELDS = [
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
    renderPlayers(data.players);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

function renderPlayers(players) {
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
    tbody.innerHTML = `<tr><td colspan="${PLAYER_FIELDS.length + 1}">Brak zapisanych graczy.</td></tr>`;
    return;
  }

  players.forEach((player) => {
    const tr = document.createElement('tr');
    const puuidTd = document.createElement('td');
    puuidTd.textContent = player.puuid ? String(player.puuid).slice(0, 8) + '...' : '';
    tr.appendChild(puuidTd);

    PLAYER_FIELDS.forEach((field) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = player[field] != null ? player[field] : '';
      input.size = field === 'summonerName' ? 20 : 8;
      input.addEventListener('change', async () => {
        try {
          await postAction('updatePlayerField', { puuid: player.puuid, field, value: input.value });
          logEvent(`Zapisano ${field} dla ${player.summonerName || player.puuid}`);
        } catch (err) {
          logEvent(`Błąd zapisu ${field}: ${err.message}`);
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
