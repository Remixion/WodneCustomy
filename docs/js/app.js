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

    const notesTd = document.createElement('td');
    const notesInput = document.createElement('input');
    notesInput.type = 'text';
    notesInput.value = match.notes || '';
    notesInput.addEventListener('change', async () => {
      try {
        await postAction('updateMatchField', { matchId: match.matchId, field: 'notes', value: notesInput.value });
        logEvent(`Zapisano notatkę meczu ${match.matchId}`);
      } catch (err) {
        logEvent(`Błąd zapisu notatki: ${err.message}`);
      }
    });
    notesTd.appendChild(notesInput);

    const actionsTd = document.createElement('td');
    const link = document.createElement('a');
    link.href = `match.html?matchId=${encodeURIComponent(match.matchId)}`;
    link.textContent = 'Szczegóły';
    actionsTd.appendChild(link);
    actionsTd.appendChild(document.createTextNode(' | '));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Usuń z Sheets';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć mecz ${match.matchId} z Arkusza Google?`)) return;
      deleteBtn.disabled = true;
      try {
        await postAction('deleteMatch', { matchId: match.matchId });
        logEvent(`Usunięto mecz ${match.matchId} z Sheets`);
        load();
      } catch (err) {
        logEvent(`Błąd usuwania meczu ${match.matchId}: ${err.message}`);
        deleteBtn.disabled = false;
      }
    });
    actionsTd.appendChild(deleteBtn);

    tr.innerHTML = `
      <td>${match.matchId}</td>
      <td>${match.gid || ''}</td>
      <td>${formatDataSource(match.dataSource)}</td>
      <td>${formatDate(match.gameCreationDate)}</td>
      <td>${match.gameMode || ''}</td>
      <td>${match.mapId || ''}</td>
      <td>${match.queueId || ''}</td>
      <td>${formatDuration(match.gameDurationSec)}</td>
      <td>${match.winningTeam || ''}</td>
      <td>${match.blueBans || ''}</td>
      <td>${match.redBans || ''}</td>
    `;
    tr.appendChild(notesTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('refresh-btn').addEventListener('click', load);

load();
