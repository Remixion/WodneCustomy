async function load() {
  const statusEl = document.getElementById('status-message');
  const tbody = document.getElementById('matches-tbody');
  try {
    const cfg = getConfig();
    if (!cfg.appsScriptUrl) {
      statusEl.textContent = 'Brak skonfigurowanego źródła danych. Przejdź do zakładki Ustawienia i wklej adres URL Apps Script.';
      tbody.innerHTML = '';
      return;
    }
    const data = await fetchData();
    statusEl.textContent = `Dane zaktualizowano: ${formatDate(data.generatedAt)} - liczba meczów: ${data.matches.length}`;
    renderMatches(data.matches);
  } catch (err) {
    statusEl.textContent = `Błąd wczytywania danych: ${err.message}`;
    tbody.innerHTML = '';
  }
}

/** Strona GitHub Pages jest tylko do odczytu - edycja danych odbywa się w apce desktopowej. */
function renderMatches(matches) {
  const tbody = document.getElementById('matches-tbody');
  tbody.innerHTML = '';
  if (!matches.length) {
    tbody.innerHTML = '<tr><td colspan="13">Brak zarejestrowanych meczów.</td></tr>';
    return;
  }
  const sorted = matches.slice().sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
  sorted.forEach((match) => {
    const tr = document.createElement('tr');

    const actionsTd = document.createElement('td');
    const link = document.createElement('a');
    link.href = `match.html?matchId=${encodeURIComponent(match.matchId)}`;
    link.textContent = 'Szczegóły';
    actionsTd.appendChild(link);

    tr.innerHTML = `
      <td>${match.matchId}</td>
      <td>${match.gid || ''}</td>
      <td>${formatDataSource(match.dataSource)}</td>
      <td>${formatDate(match.gameCreationDate)}</td>
      <td>${match.mapId || ''}</td>
      <td>${formatDuration(match.gameDurationSec)}</td>
      <td>${match.winningTeam || ''}</td>
      <td>${match.blueBans || ''}</td>
      <td>${match.redBans || ''}</td>
      <td>${match.blueChampions || ''}</td>
      <td>${match.redChampions || ''}</td>
      <td>${match.bluePlayerNames || ''}</td>
      <td>${match.redPlayerNames || ''}</td>
      <td>${match.notes || ''}</td>
    `;
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
