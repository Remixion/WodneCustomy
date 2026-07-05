async function loadMatches() {
  const tbody = document.getElementById('matches-tbody');
  const matches = await window.api.store.listMatches();
  tbody.innerHTML = '';
  if (!matches.length) {
    tbody.innerHTML = '<tr><td colspan="10">Brak zarejestrowanych meczów. Rozegraj custom 5v5, a dane pojawią się tu automatycznie po jego zakończeniu.</td></tr>';
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
    actionsCell.appendChild(document.createTextNode(' | '));

    const deleteSheetsBtn = document.createElement('button');
    deleteSheetsBtn.type = 'button';
    deleteSheetsBtn.textContent = 'Usuń z Sheets';
    deleteSheetsBtn.addEventListener('click', async () => {
      if (!confirm(`Usunąć mecz ${match.matchId} z Arkusza Google? (dane lokalne zostaną)`)) return;
      deleteSheetsBtn.disabled = true;
      const result = await window.api.sync.deleteMatch(match.matchId);
      logEvent(`Usunięto mecz ${match.matchId} z Sheets: ${result.ok ? 'OK' : 'błąd - ' + result.error}`);
      deleteSheetsBtn.disabled = false;
    });
    actionsCell.appendChild(deleteSheetsBtn);

    tr.innerHTML = `
      <td>${match.matchId}</td>
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

async function loadHistoryList() {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '<tr><td colspan="6">Wczytywanie historii z klienta...</td></tr>';
  let result;
  try {
    result = await window.api.history.listRecentMatches(20);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Błąd: ${err.message}</td></tr>`;
    return;
  }
  if (!result.ok) {
    tbody.innerHTML = `<tr><td colspan="6">Błąd: ${result.error}</td></tr>`;
    return;
  }
  tbody.innerHTML = '';
  if (!result.matches.length) {
    tbody.innerHTML = '<tr><td colspan="6">Brak meczów w lokalnej historii klienta.</td></tr>';
    return;
  }
  result.matches.forEach((m) => {
    const tr = document.createElement('tr');
    const actionsTd = document.createElement('td');

    if (m.alreadyImported) {
      const label = document.createElement('span');
      label.textContent = 'już zaimportowany - ';
      actionsTd.appendChild(label);
    }

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.textContent = m.alreadyImported ? 'Importuj ponownie' : 'Importuj';
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importowanie...';
      try {
        const importResult = await window.api.history.importMatch(m.gameId);
        logEvent(`Import meczu ${m.gameId}: ${importResult.ok ? 'OK' : 'błąd - ' + importResult.error}`);
      } catch (err) {
        logEvent(`Import meczu ${m.gameId}: błąd - ${err.message}`);
      } finally {
        loadMatches();
        loadHistoryList();
      }
    });
    actionsTd.appendChild(importBtn);

    tr.innerHTML = `
      <td>${m.gameId}</td>
      <td>${formatDate(m.gameCreationDate)}</td>
      <td>${m.gameMode || ''}</td>
      <td>${m.mapId || ''}</td>
      <td>${formatDuration(m.gameDurationSec)}</td>
    `;
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('history-list-btn').addEventListener('click', loadHistoryList);

function fileBaseName(filePath) {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

function renderRoflImportResults(results) {
  const tbody = document.getElementById('rofl-import-tbody');
  results.forEach((r) => {
    const tr = document.createElement('tr');

    const fileTd = document.createElement('td');
    fileTd.textContent = fileBaseName(r.filePath);
    tr.appendChild(fileTd);

    const matchTd = document.createElement('td');
    matchTd.textContent = r.matchId || '-';
    tr.appendChild(matchTd);

    const statusTd = document.createElement('td');
    statusTd.textContent = r.ok ? (r.full ? 'pełne dane' : 'tylko podstawowy wpis') : `błąd - ${r.error}`;
    tr.appendChild(statusTd);

    const actionsTd = document.createElement('td');
    if (r.ok && r.matchId) {
      const pushBtn = document.createElement('button');
      pushBtn.type = 'button';
      pushBtn.textContent = 'Wyślij do Sheets';
      pushBtn.addEventListener('click', async () => {
        pushBtn.disabled = true;
        const pushResult = await window.api.sync.pushMatch(r.matchId);
        logEvent(`Wysłano mecz ${r.matchId} do Sheets: ${pushResult.ok ? 'OK' : 'błąd - ' + pushResult.error}`);
        pushBtn.disabled = false;
      });
      actionsTd.appendChild(pushBtn);
    }
    tr.appendChild(actionsTd);

    tbody.prepend(tr);
  });
}

async function importOneRoflFile(filePath, card) {
  card.querySelectorAll('button').forEach((b) => (b.disabled = true));
  const results = await window.api.rofl.import([filePath]);
  const r = results[0];
  logEvent(
    r.ok
      ? `Import .rofl (${r.matchId}): ${r.full ? 'pełne dane' : 'tylko podstawowy wpis'}`
      : `Import .rofl błąd (${r.filePath}): ${r.error}`
  );
  renderRoflImportResults(results);
  loadMatches();
  if (document.getElementById('rofl-folder-tbody').children.length) loadRoflFolderList();
  clearRoflPreview();
}

function renderPlayersPreviewTable(players) {
  const table = document.createElement('table');
  table.setAttribute('border', '1');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Drużyna</th><th>Gracz</th><th>Champion</th><th>K/D/A</th><th>KDA</th><th>Wynik</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  (players || []).forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.team || ''}</td>
      <td>${p.summonerName || ''}</td>
      <td>${p.championName || ''}</td>
      <td>${p.kills}/${p.deaths}/${p.assists}</td>
      <td>${p.kda || ''}</td>
      <td>${p.win ? 'Wygrana' : 'Przegrana'}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function clearRoflPreview() {
  const container = document.getElementById('rofl-preview-container');
  container.innerHTML = '<p>Kliknij „Podgląd” przy meczu z listy, aby zobaczyć tutaj jego dane.</p>';
}

/** Pokazuje podgląd JEDNEGO meczu na raz w panelu bocznym - zastępuje poprzedni podgląd. */
function showRoflPreview(r) {
  const container = document.getElementById('rofl-preview-container');
  container.innerHTML = '';

  const card = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = `${fileBaseName(r.filePath)}${r.gameId ? ' (Game ID: ' + r.gameId + ')' : ''}`;
  card.appendChild(title);

  if (r.ok) {
    const dl = document.createElement('dl');
    dl.innerHTML = `
      <dt>Data</dt><dd>${formatDate(r.match.gameCreationDate)}</dd>
      <dt>Tryb</dt><dd>${r.match.gameMode || ''}</dd>
      <dt>Mapa</dt><dd>${r.match.mapId || ''}</dd>
      <dt>Czas trwania</dt><dd>${formatDuration(r.match.gameDurationSec)}</dd>
      <dt>Zwycięska drużyna</dt><dd>${r.match.winningTeam || ''}</dd>
      <dt>Bany (niebiescy)</dt><dd>${r.match.blueBans || ''}</dd>
      <dt>Bany (czerwoni)</dt><dd>${r.match.redBans || ''}</dd>
    `;
    card.appendChild(dl);
    card.appendChild(renderPlayersPreviewTable(r.players));
  } else {
    const p = document.createElement('p');
    p.textContent = `Podgląd niedostępny: ${r.error}`;
    card.appendChild(p);
  }

  const actionsP = document.createElement('p');

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = r.ok ? 'Importuj ten mecz' : 'Importuj mimo to (bez podglądu)';
  importBtn.addEventListener('click', () => importOneRoflFile(r.filePath, card));
  actionsP.appendChild(importBtn);
  actionsP.appendChild(document.createTextNode(' '));

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.textContent = 'Zamknij podgląd';
  skipBtn.addEventListener('click', clearRoflPreview);
  actionsP.appendChild(skipBtn);

  card.appendChild(actionsP);
  container.appendChild(card);
}

async function loadRoflFolderList() {
  const tbody = document.getElementById('rofl-folder-tbody');
  const resultEl = document.getElementById('rofl-folder-result');
  tbody.innerHTML = '<tr><td colspan="4">Wczytywanie listy plików...</td></tr>';
  const result = await window.api.rofl.listFolder();
  if (!result.ok) {
    tbody.innerHTML = '';
    resultEl.textContent = `Błąd: ${result.error}`;
    return;
  }
  resultEl.textContent = `Znaleziono ${result.files.length} plik(ów) .rofl.`;
  tbody.innerHTML = '';
  if (!result.files.length) {
    tbody.innerHTML = '<tr><td colspan="4">Brak plików .rofl w skonfigurowanym folderze.</td></tr>';
    return;
  }
  result.files.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.fileName}</td>
      <td>${f.gameId || '-'}</td>
      <td>${f.alreadyImported ? 'Tak' : 'Nie'}</td>
    `;
    const actionsTd = document.createElement('td');
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.textContent = 'Podgląd';
    previewBtn.addEventListener('click', async () => {
      previewBtn.disabled = true;
      previewBtn.textContent = 'Wczytywanie...';
      try {
        const previewResults = await window.api.rofl.preview([f.filePath]);
        showRoflPreview(previewResults[0]);
      } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = 'Podgląd';
      }
    });
    actionsTd.appendChild(previewBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('rofl-scan-folder-btn').addEventListener('click', loadRoflFolderList);

document.getElementById('rofl-pick-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('rofl-import-result');
  const pickBtn = document.getElementById('rofl-pick-btn');
  const filePaths = await window.api.rofl.pickFiles();
  if (!filePaths.length) return;
  pickBtn.disabled = true;
  resultEl.textContent = 'Wczytywanie podglądu...';
  try {
    const previewResults = await window.api.rofl.preview(filePaths);
    resultEl.textContent = previewResults[0].ok ? 'Podgląd gotowy - sprawdź panel po prawej.' : 'Podgląd niedostępny - sprawdź panel po prawej.';
    showRoflPreview(previewResults[0]);
  } catch (err) {
    resultEl.textContent = `Błąd podglądu: ${err.message}`;
    logEvent(`Podgląd .rofl błąd: ${err.message}`);
  } finally {
    pickBtn.disabled = false;
  }
});

function renderLegacyJsonImportResults(results) {
  const tbody = document.getElementById('legacyjson-import-tbody');
  results.forEach((r) => {
    const tr = document.createElement('tr');

    const fileTd = document.createElement('td');
    fileTd.textContent = fileBaseName(r.filePath);
    tr.appendChild(fileTd);

    const matchTd = document.createElement('td');
    matchTd.textContent = r.matchId || '-';
    tr.appendChild(matchTd);

    const statusTd = document.createElement('td');
    statusTd.textContent = r.ok ? 'zaimportowano' : `błąd - ${r.error}`;
    tr.appendChild(statusTd);

    const actionsTd = document.createElement('td');
    if (r.ok && r.matchId) {
      const pushBtn = document.createElement('button');
      pushBtn.type = 'button';
      pushBtn.textContent = 'Wyślij do Sheets';
      pushBtn.addEventListener('click', async () => {
        pushBtn.disabled = true;
        const pushResult = await window.api.sync.pushMatch(r.matchId);
        logEvent(`Wysłano mecz ${r.matchId} do Sheets: ${pushResult.ok ? 'OK' : 'błąd - ' + pushResult.error}`);
        pushBtn.disabled = false;
      });
      actionsTd.appendChild(pushBtn);
    }
    tr.appendChild(actionsTd);

    tbody.prepend(tr);
  });
}

async function importOneLegacyJsonFile(filePath, card) {
  card.querySelectorAll('button').forEach((b) => (b.disabled = true));
  const results = await window.api.legacyJson.import([filePath]);
  const r = results[0];
  logEvent(
    r.ok
      ? `Import starego JSON (${r.matchId}): OK`
      : `Import starego JSON błąd (${r.filePath}): ${r.error}`
  );
  renderLegacyJsonImportResults(results);
  loadMatches();
  if (document.getElementById('legacyjson-folder-tbody').children.length) loadLegacyJsonFolderList();
  clearLegacyJsonPreview();
}

function clearLegacyJsonPreview() {
  const container = document.getElementById('legacyjson-preview-container');
  container.innerHTML = '<p>Kliknij „Podgląd” przy meczu z listy, aby zobaczyć tutaj jego dane.</p>';
}

/** Pokazuje podgląd JEDNEGO meczu na raz w panelu bocznym - zastępuje poprzedni podgląd. */
function showLegacyJsonPreview(r) {
  const container = document.getElementById('legacyjson-preview-container');
  container.innerHTML = '';

  const card = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = `${fileBaseName(r.filePath)}${r.gameId ? ' (Game ID: ' + r.gameId + ')' : ''}`;
  card.appendChild(title);

  if (r.ok) {
    const dl = document.createElement('dl');
    dl.innerHTML = `
      <dt>Data</dt><dd>${formatDate(r.match.gameCreationDate)}</dd>
      <dt>Tryb</dt><dd>${r.match.gameMode || ''}</dd>
      <dt>Mapa</dt><dd>${r.match.mapId || ''}</dd>
      <dt>Czas trwania</dt><dd>${formatDuration(r.match.gameDurationSec)}</dd>
      <dt>Zwycięska drużyna</dt><dd>${r.match.winningTeam || ''}</dd>
      <dt>Bany (niebiescy)</dt><dd>${r.match.blueBans || ''}</dd>
      <dt>Bany (czerwoni)</dt><dd>${r.match.redBans || ''}</dd>
    `;
    card.appendChild(dl);
    card.appendChild(renderPlayersPreviewTable(r.players));
  } else {
    const p = document.createElement('p');
    p.textContent = `Podgląd niedostępny: ${r.error}`;
    card.appendChild(p);
  }

  const actionsP = document.createElement('p');

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = r.ok ? 'Importuj ten mecz' : 'Importuj mimo to (bez podglądu)';
  importBtn.addEventListener('click', () => importOneLegacyJsonFile(r.filePath, card));
  actionsP.appendChild(importBtn);
  actionsP.appendChild(document.createTextNode(' '));

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.textContent = 'Zamknij podgląd';
  skipBtn.addEventListener('click', clearLegacyJsonPreview);
  actionsP.appendChild(skipBtn);

  card.appendChild(actionsP);
  container.appendChild(card);
}

async function loadLegacyJsonFolderList() {
  const tbody = document.getElementById('legacyjson-folder-tbody');
  const resultEl = document.getElementById('legacyjson-folder-result');
  tbody.innerHTML = '<tr><td colspan="4">Wczytywanie listy plików...</td></tr>';
  const result = await window.api.legacyJson.listFolder();
  if (!result.ok) {
    tbody.innerHTML = '';
    resultEl.textContent = `Błąd: ${result.error}`;
    return;
  }
  resultEl.textContent = `Znaleziono ${result.files.length} plik(ów) .json.`;
  tbody.innerHTML = '';
  if (!result.files.length) {
    tbody.innerHTML = '<tr><td colspan="4">Brak plików .json w skonfigurowanym folderze.</td></tr>';
    return;
  }
  result.files.forEach((f) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.fileName}</td>
      <td>${f.gameId || '-'}</td>
      <td>${f.alreadyImported ? 'Tak' : 'Nie'}</td>
    `;
    const actionsTd = document.createElement('td');
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.textContent = 'Podgląd';
    previewBtn.addEventListener('click', async () => {
      previewBtn.disabled = true;
      previewBtn.textContent = 'Wczytywanie...';
      try {
        const previewResults = await window.api.legacyJson.preview([f.filePath]);
        showLegacyJsonPreview(previewResults[0]);
      } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = 'Podgląd';
      }
    });
    actionsTd.appendChild(previewBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('legacyjson-scan-folder-btn').addEventListener('click', loadLegacyJsonFolderList);

document.getElementById('legacyjson-pick-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('legacyjson-import-result');
  const pickBtn = document.getElementById('legacyjson-pick-btn');
  const filePaths = await window.api.legacyJson.pickFiles();
  if (!filePaths.length) return;
  pickBtn.disabled = true;
  resultEl.textContent = 'Wczytywanie podglądu...';
  try {
    const previewResults = await window.api.legacyJson.preview(filePaths);
    resultEl.textContent = previewResults[0].ok ? 'Podgląd gotowy - sprawdź panel po prawej.' : 'Podgląd niedostępny - sprawdź panel po prawej.';
    showLegacyJsonPreview(previewResults[0]);
  } catch (err) {
    resultEl.textContent = `Błąd podglądu: ${err.message}`;
    logEvent(`Podgląd starego JSON błąd: ${err.message}`);
  } finally {
    pickBtn.disabled = false;
  }
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
