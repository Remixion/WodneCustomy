const MATCH_FIELDS = [
  'gameCreationDate', 'gameDurationSec', 'gameMode', 'gameType', 'mapId', 'queueId', 'gameVersion',
  'winningTeam', 'blueBans', 'redBans',
  'blueBaronKills', 'blueDragonKills', 'blueHeraldKills', 'blueTowerKills', 'blueInhibKills',
  'redBaronKills', 'redDragonKills', 'redHeraldKills', 'redTowerKills', 'redInhibKills',
  'notes',
];

const PLAYER_FIELDS = [
  'summonerName', 'championName', 'championId', 'teamPosition', 'spell1', 'spell2',
  'primaryRuneStyle', 'subRuneStyle', 'keystone', 'champLevel',
  'kills', 'deaths', 'assists', 'kda', 'cs', 'csPerMin',
  'goldEarned', 'damageDealtToChampions', 'damageTaken', 'damageSelfMitigated', 'totalHeal',
  'visionScore', 'wardsPlaced', 'wardsKilled', 'controlWardsPlaced',
  'item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6',
  'firstBloodKill', 'firstTowerKill', 'doubleKills', 'tripleKills', 'quadraKills', 'pentaKills',
  'win', 'notes',
];

const matchId = qs('matchId');

async function load() {
  const statusEl = document.getElementById('status-message');
  try {
    const data = await fetchData();
    const match = data.matches.find((m) => String(m.matchId) === String(matchId));
    if (!match) {
      statusEl.textContent = 'Nie znaleziono meczu o podanym identyfikatorze.';
      return;
    }
    statusEl.textContent = `Mecz ${match.matchId}`;
    renderMatchFields(match);
    const nickByPuuid = {};
    (data.players || []).forEach((p) => {
      if (p.puuid) nickByPuuid[p.puuid] = p.nick || '';
    });
    const players = data.matchPlayers.filter((p) => String(p.matchId) === String(matchId));
    renderTeamTable('blue-team-table', players.filter((p) => p.team === 'BLUE'), nickByPuuid);
    renderTeamTable('red-team-table', players.filter((p) => p.team === 'RED'), nickByPuuid);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
  }
}

function renderMatchFields(match) {
  const tbody = document.querySelector('#match-fields-table tbody');
  tbody.innerHTML = '';
  MATCH_FIELDS.forEach((field) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = field;
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = match[field] != null ? match[field] : '';
    input.size = 60;
    input.addEventListener('change', async () => {
      try {
        await postAction('updateMatchField', { matchId: match.matchId, field, value: input.value });
        logEvent(`Zapisano ${field}`);
      } catch (err) {
        logEvent(`Błąd zapisu ${field}: ${err.message}`);
      }
    });
    td.appendChild(input);
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });

  const rawTr = document.createElement('tr');
  const rawTh = document.createElement('th');
  rawTh.textContent = 'rawDataJson (surowe dane z LCU, tylko do odczytu)';
  const rawTd = document.createElement('td');
  const textarea = document.createElement('textarea');
  textarea.readOnly = true;
  textarea.rows = 8;
  textarea.cols = 80;
  textarea.value = match.rawDataJson || '';
  rawTd.appendChild(textarea);
  rawTr.appendChild(rawTh);
  rawTr.appendChild(rawTd);
  tbody.appendChild(rawTr);
}

function renderTeamTable(tableId, players, nickByPuuid) {
  const table = document.getElementById(tableId);
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const headRow = document.createElement('tr');
  const nickTh = document.createElement('th');
  nickTh.textContent = 'Nick (z zakładki Gracze)';
  headRow.appendChild(nickTh);
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
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = PLAYER_FIELDS.length + 2;
    td.textContent = 'Brak danych graczy.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  players.forEach((player) => {
    const tr = document.createElement('tr');
    const nickTd = document.createElement('td');
    nickTd.textContent = (nickByPuuid && nickByPuuid[player.puuid]) || '';
    tr.appendChild(nickTd);
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
          await postAction('updateMatchPlayerField', { matchId, puuid: player.puuid, field, value: input.value });
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

load();
