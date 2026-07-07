const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];
const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', SUPPORT: 'Support' };
const MAX_SELECTED = 10;

let allPlayers = [];
const selectedPuuids = new Set();

function populateColorOptions() {
  const select = document.getElementById('new-player-color');
  COLOR_PALETTE.forEach((color) => {
    const option = document.createElement('option');
    option.value = color;
    option.textContent = color;
    select.appendChild(option);
  });
}

function normalize(value) {
  return (value || '').toString().toLowerCase();
}

/** Jeden pasek wyszukiwania przeszukuje jednocześnie nick, Riot ID (summonerName) i nick na Discordzie. */
function matchesSearch(player, query) {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(player.nick).includes(q) ||
    normalize(player.summonerName).includes(q) ||
    normalize(player.discordNick).includes(q)
  );
}

function updateSelectedCount() {
  document.getElementById('selected-count').textContent = `Wybrano: ${selectedPuuids.size}/${MAX_SELECTED}`;
  document.getElementById('randomize-btn').disabled = selectedPuuids.size !== MAX_SELECTED;
}

function renderPlayerList() {
  const query = document.getElementById('player-search').value;
  const container = document.getElementById('player-list');
  container.innerHTML = '';
  const filtered = allPlayers.filter((p) => matchesSearch(p, query));

  if (!filtered.length) {
    container.innerHTML = '<p>Brak graczy pasujących do wyszukiwania.</p>';
    return;
  }

  const list = document.createElement('ul');
  filtered.forEach((p) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedPuuids.has(p.puuid);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (selectedPuuids.size >= MAX_SELECTED) {
          checkbox.checked = false;
          logEvent(`Można wybrać maksymalnie ${MAX_SELECTED} graczy.`);
          return;
        }
        selectedPuuids.add(p.puuid);
      } else {
        selectedPuuids.delete(p.puuid);
      }
      updateSelectedCount();
    });
    label.appendChild(checkbox);
    label.insertAdjacentHTML('beforeend', ' ' + colorizeName(displayNameForPlayer(p), getPlayerColor(p)));
    if (p.nick && p.summonerName) {
      label.insertAdjacentText('beforeend', ` (${p.summonerName})`);
    }
    li.appendChild(label);
    list.appendChild(li);
  });
  container.appendChild(list);
}

async function loadPlayers() {
  allPlayers = await window.api.store.refreshPlayersFromSheets();
  renderPlayerList();
}

document.getElementById('player-search').addEventListener('input', renderPlayerList);

document.getElementById('clear-selection-btn').addEventListener('click', () => {
  selectedPuuids.clear();
  updateSelectedCount();
  renderPlayerList();
});

document.getElementById('add-player-btn').addEventListener('click', async () => {
  const nick = document.getElementById('new-player-nick').value.trim();
  const summonerName = document.getElementById('new-player-riotid').value.trim();
  const color = document.getElementById('new-player-color').value;
  if (!nick) {
    logEvent('Podaj nick nowego gracza.');
    return;
  }
  const puuid = `nick:${nick.toLowerCase()}`;
  if (allPlayers.some((p) => p.puuid === puuid)) {
    logEvent(`Gracz o nicku "${nick}" już istnieje.`);
    return;
  }
  const result = await window.api.store.addPlayer({ nick, summonerName, color });
  if (!result.ok) {
    logEvent(`Błąd dodawania gracza: ${result.error}`);
    return;
  }
  logEvent(`Dodano gracza ${nick}.`);
  document.getElementById('new-player-nick').value = '';
  document.getElementById('new-player-riotid').value = '';
  document.getElementById('new-player-color').value = '';
  await loadPlayers();
});

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Nick zawsze pierwszy i kolorowany, Riot ID (jeśli znany) dopisany obok w nawiasie - nigdy samo Riot ID. */
function fillPlayerCell(td, player) {
  td.innerHTML = colorizeName(displayNameForPlayer(player), getPlayerColor(player));
  if (player.nick && player.summonerName) {
    td.insertAdjacentText('beforeend', ` (${player.summonerName})`);
  }
}

function renderResult(leftTeam, rightTeam) {
  const container = document.getElementById('randomizer-result');
  container.innerHTML = '';
  const table = document.createElement('table');
  table.border = '1';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Rola</th><th>Strona lewa</th><th>Strona prawa</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  ROLE_ORDER.forEach((role, i) => {
    const tr = document.createElement('tr');
    const roleTd = document.createElement('td');
    roleTd.textContent = ROLE_LABELS[role];
    tr.appendChild(roleTd);
    const leftTd = document.createElement('td');
    fillPlayerCell(leftTd, leftTeam[i]);
    tr.appendChild(leftTd);
    const rightTd = document.createElement('td');
    fillPlayerCell(rightTd, rightTeam[i]);
    tr.appendChild(rightTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('randomize-btn').addEventListener('click', () => {
  if (selectedPuuids.size !== MAX_SELECTED) {
    logEvent(`Wybierz dokładnie ${MAX_SELECTED} graczy przed losowaniem.`);
    return;
  }
  const selectedPlayers = allPlayers.filter((p) => selectedPuuids.has(p.puuid));
  const shuffled = shuffleArray(selectedPlayers);
  renderResult(shuffled.slice(0, 5), shuffled.slice(5, 10));
  logEvent('Wylosowano skład.');
});

populateColorOptions();
loadPlayers();
