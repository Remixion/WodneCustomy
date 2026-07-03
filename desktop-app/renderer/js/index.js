async function loadMatches() {
  const tbody = document.getElementById('matches-tbody');
  const matches = await window.api.store.listMatches();
  tbody.innerHTML = '';
  if (!matches.length) {
    tbody.innerHTML = '<tr><td colspan="9">Brak zarejestrowanych meczów. Rozegraj custom 5v5, a dane pojawią się tu automatycznie po jego zakończeniu.</td></tr>';
    return;
  }
  matches.forEach(({ match }) => {
    const tr = document.createElement('tr');

    const notesCell = document.createElement('td');
    const notesInput = document.createElement('input');
    notesInput.type = 'text';
    notesInput.value = match.notes || '';
    notesInput.addEventListener('change', async () => {
      await window.api.store.updateMatchField(match.matchId, 'notes', notesInput.value);
      logEvent(`Zapisano notatkę meczu ${match.matchId}`);
    });
    notesCell.appendChild(notesInput);

    const actionsCell = document.createElement('td');

    const detailLink = document.createElement('a');
    detailLink.href = `match.html?matchId=${encodeURIComponent(match.matchId)}`;
    detailLink.textContent = 'Szczegóły';
    actionsCell.appendChild(detailLink);
    actionsCell.appendChild(document.createTextNode(' | '));

    const pushBtn = document.createElement('button');
    pushBtn.type = 'button';
    pushBtn.textContent = 'Wyślij do Sheets';
    pushBtn.addEventListener('click', async () => {
      pushBtn.disabled = true;
      const result = await window.api.sync.pushMatch(match.matchId);
      logEvent(`Wysłano mecz ${match.matchId}: ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
      pushBtn.disabled = false;
    });
    actionsCell.appendChild(pushBtn);
    actionsCell.appendChild(document.createTextNode(' | '));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Usuń lokalnie';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć mecz ${match.matchId} z lokalnego magazynu? (nie usuwa danych z arkusza)`)) return;
      await window.api.store.deleteMatch(match.matchId);
      logEvent(`Usunięto mecz ${match.matchId} lokalnie`);
      loadMatches();
    });
    actionsCell.appendChild(deleteBtn);

    tr.innerHTML = `
      <td>${formatDate(match.gameCreationDate)}</td>
      <td>${match.gameMode || ''}</td>
      <td>${match.mapId || ''}</td>
      <td>${formatDuration(match.gameDurationSec)}</td>
      <td>${match.winningTeam || ''}</td>
      <td>${match.blueBans || ''}</td>
      <td>${match.redBans || ''}</td>
    `;
    tr.appendChild(notesCell);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);
  });
}

async function refreshLcuStatus() {
  const status = await window.api.lcu.getStatus();
  applyLcuStatus(status);
}

function applyLcuStatus(status) {
  document.getElementById('lcu-connected').textContent = status.connected ? 'połączono' : 'brak połączenia (uruchom klienta League)';
  document.getElementById('lcu-phase').textContent = status.phase || '-';
  if (status.error) logEvent(`Błąd LCU: ${status.error}`);
}

document.getElementById('refresh-btn').addEventListener('click', loadMatches);
document.getElementById('push-all-btn').addEventListener('click', async () => {
  logEvent('Wysyłanie wszystkich meczów do Google Sheets...');
  const results = await window.api.sync.pushAllMatches();
  const failed = results.filter((r) => !r.result.ok);
  logEvent(`Zakończono wysyłkę: ${results.length - failed.length}/${results.length} OK`);
});

window.api.lcu.onStatus(applyLcuStatus);
window.api.collector.onStatus((s) => {
  document.getElementById('collector-status').textContent = s.collecting ? 'zbieranie danych zakończonego meczu...' : 'bezczynny';
  if (s.error) logEvent(`Błąd zbierania danych: ${s.error}`);
});
window.api.collector.onMatchSaved(({ match }) => {
  logEvent(`Zapisano nowy mecz: ${match.matchId}`);
  loadMatches();
});
window.api.collector.onPlayersSaved(() => logEvent('Zaktualizowano dane graczy'));
window.api.collector.onSyncResult(({ matchResult, playersResult }) => {
  logEvent(`Auto-synchronizacja: mecz ${matchResult.ok ? 'OK' : 'błąd'}, gracze ${playersResult.ok ? 'OK' : 'błąd'}`);
});

refreshLcuStatus();
loadMatches();
