async function loadMatches() {
  const tbody = document.getElementById('matches-tbody');
  const matches = await window.api.store.listMatches();
  tbody.innerHTML = '';
  if (!matches.length) {
    tbody.innerHTML = '<tr><td colspan="11">Brak zarejestrowanych meczów. Rozegraj custom 5v5, a dane pojawią się tu automatycznie po jego zakończeniu.</td></tr>';
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
      <td>${formatDataSource(match.dataSource)}</td>
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

let lastHistoryMatches = [];

async function loadHistoryList(fetchPromise, loadingLabel) {
  const tbody = document.getElementById('history-tbody');
  const statusEl = document.getElementById('history-list-status');
  statusEl.textContent = '';
  tbody.innerHTML = `<tr><td colspan="7">${loadingLabel}</td></tr>`;
  let result;
  try {
    result = await fetchPromise;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Błąd: ${err.message}</td></tr>`;
    return;
  }
  if (!result.ok) {
    tbody.innerHTML = `<tr><td colspan="7">Błąd: ${result.error}</td></tr>`;
    return;
  }
  statusEl.textContent = `Znaleziono ${result.matches.length} mecz(ów).`;
  if (result.truncated) {
    statusEl.textContent +=
      ' Uwaga: klient League przestał zwracać nowe wyniki wcześniej, niż wynikałoby to z wybranej daty ' +
      '(niestabilność tego lokalnego API) - lista może nie sięgać aż tak daleko wstecz.';
  }
  lastHistoryMatches = result.matches;
  renderHistoryRows();
}

function renderHistoryRows() {
  const tbody = document.getElementById('history-tbody');
  const onlyCustom = document.getElementById('history-only-custom').checked;
  const matches = onlyCustom ? lastHistoryMatches.filter((m) => m.isCustom) : lastHistoryMatches;

  tbody.innerHTML = '';
  if (!matches.length) {
    tbody.innerHTML = `<tr><td colspan="7">${
      onlyCustom ? 'Brak gier custom na wczytanej liście.' : 'Brak meczów w lokalnej historii klienta.'
    }</td></tr>`;
    return;
  }

  matches.forEach((m) => {
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
        reloadHistoryList();
      }
    });
    actionsTd.appendChild(importBtn);

    tr.innerHTML = `
      <td>${m.gameId}</td>
      <td>${formatDate(m.gameCreationDate)}</td>
      <td>${m.gameMode || ''}</td>
      <td>${m.isCustom ? 'Tak' : 'Nie'}</td>
      <td>${m.mapId || ''}</td>
      <td>${formatDuration(m.gameDurationSec)}</td>
    `;
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

document.getElementById('history-only-custom').addEventListener('change', renderHistoryRows);

/** Zapamiętuje ostatnio użyty sposób wczytania listy (ostatnie N / od daty), żeby odświeżyć nią listę po imporcie. */
let reloadHistoryList = () => {};

function loadRecentHistory() {
  reloadHistoryList = loadRecentHistory;
  loadHistoryList(window.api.history.listRecentMatches(20), 'Wczytywanie ostatnich 20 meczów z klienta...');
}

function loadHistorySince() {
  const dateValue = document.getElementById('history-since-date').value;
  if (!dateValue) {
    document.getElementById('history-list-status').textContent = 'Wybierz najpierw datę.';
    return;
  }
  reloadHistoryList = loadHistorySince;
  loadHistoryList(window.api.history.listMatchesSince(dateValue), `Wczytywanie meczów od ${dateValue}...`);
}

document.getElementById('history-list-btn').addEventListener('click', loadRecentHistory);
document.getElementById('history-since-btn').addEventListener('click', loadHistorySince);

document.getElementById('history-lookup-btn').addEventListener('click', async () => {
  const gameId = document.getElementById('history-lookup-gameid').value.trim();
  const resultEl = document.getElementById('history-lookup-result');
  if (!gameId) {
    resultEl.textContent = 'Wpisz najpierw Game ID.';
    return;
  }
  resultEl.textContent = 'Sprawdzanie...';
  try {
    const result = await window.api.history.lookupGame(gameId);
    resultEl.textContent = result.ok
      ? `${formatDate(result.gameCreationDate)} - ${result.gameMode || result.gameType || 'nieznany tryb'}${
          result.isCustom ? ' (custom)' : ''
        }`
      : `Błąd: ${result.error}`;
  } catch (err) {
    resultEl.textContent = `Błąd: ${err.message}`;
  }
});

// ---- Skaner zakresu Game ID (patrz komentarz w gameIdScanner.js o ograniczeniach) ----

function setScannerRunningUi(running) {
  document.getElementById('scanner-start-btn').disabled = running;
  document.getElementById('scanner-resume-btn').disabled = running;
  document.getElementById('scanner-stop-btn').disabled = !running;
}

async function refreshExistingIdsSet() {
  const stored = await window.api.store.listMatches();
  return new Set(stored.map((m) => String(m.match.matchId)));
}

async function addFoundGamesToHistoryTable(newlyFound) {
  if (!newlyFound || !newlyFound.length) return;
  const existingIds = await refreshExistingIdsSet();
  const withImportedFlag = newlyFound.map((g) => ({ ...g, alreadyImported: existingIds.has(g.gameId) }));
  const knownIds = new Set(lastHistoryMatches.map((m) => m.gameId));
  const merged = lastHistoryMatches.concat(withImportedFlag.filter((g) => !knownIds.has(g.gameId)));
  lastHistoryMatches = merged.sort((a, b) => new Date(b.gameCreationDate) - new Date(a.gameCreationDate));
  renderHistoryRows();
}

function formatScannerStatus({ checked, errors, foundCount, startId, endId, lastId, running, stopped }) {
  const total = endId - startId + 1;
  const done = lastId - startId + 1;
  const pct = total > 0 ? ((done / total) * 100).toFixed(4) : '0';
  return (
    `Sprawdzono ${checked} (do ID ${lastId} z ${total} w zakresie, ${pct}%), ` +
    `błędów: ${errors}, znaleziono Twoich meczów: ${foundCount}` +
    (running ? ' - skanowanie trwa...' : stopped ? ' - zatrzymano.' : ' - zakończono cały zakres.')
  );
}

let scannerLastStats = { checked: 0, errors: 0, foundCount: 0, startId: 0, endId: 0, lastId: 0 };

window.api.scanner.onProgress((p) => {
  scannerLastStats = { ...scannerLastStats, ...p, foundCount: scannerLastStats.foundCount + (p.newlyFound ? p.newlyFound.length : 0) };
  document.getElementById('scanner-status').textContent = formatScannerStatus({ ...scannerLastStats, running: true });
  addFoundGamesToHistoryTable(p.newlyFound);
});

window.api.scanner.onDone((result) => {
  setScannerRunningUi(false);
  if (result.error) {
    document.getElementById('scanner-status').textContent = `Błąd skanowania: ${result.error}`;
    logEvent(`Skanowanie Game ID: błąd - ${result.error}`);
    return;
  }
  scannerLastStats = { ...scannerLastStats, checked: result.checked, errors: result.errors, lastId: result.lastId };
  document.getElementById('scanner-status').textContent = formatScannerStatus({ ...scannerLastStats, running: false, stopped: result.stopped });
  logEvent(
    `Skanowanie Game ID zakończone: sprawdzono ${result.checked}, znaleziono ${scannerLastStats.foundCount} mecz(ów)` +
      (result.stopped ? ' (zatrzymane ręcznie, można wznowić)' : ' (cały zakres sprawdzony)')
  );
});

async function startScanner(resume) {
  const startId = document.getElementById('scanner-start-id').value.trim();
  const endId = document.getElementById('scanner-end-id').value.trim();
  const requestsPerSecond = Number(document.getElementById('scanner-rate').value) || 2;
  if (!startId || !endId) {
    document.getElementById('scanner-status').textContent = 'Podaj Game ID początkowy i końcowy.';
    return;
  }

  if (!resume) {
    const saved = await window.api.scanner.getSavedProgress();
    const sameRange = String(saved.scanStartId) === startId && String(saved.scanEndId) === endId;
    const hasProgress = saved.scanLastId !== '' && Number(saved.scanLastId) < Number(endId);
    if (sameRange && hasProgress) {
      const confirmed = confirm(
        `Ten zakres ma już zapisany postęp (sprawdzono do ID ${saved.scanLastId}). ` +
          'Kliknięcie "Rozpocznij" zacznie od nowa i skasuje ten postęp - czy na pewno? ' +
          '(żeby kontynuować od zapisanego miejsca, użyj zamiast tego "Wznów od zapisanego postępu")'
      );
      if (!confirmed) return;
    }
  }

  scannerLastStats = { checked: 0, errors: 0, foundCount: 0, startId: Number(startId), endId: Number(endId), lastId: Number(startId) - 1 };
  document.getElementById('scanner-status').textContent = 'Uruchamianie skanowania...';
  const result = await window.api.scanner.start({ startId, endId, requestsPerSecond, resume });
  if (!result.ok) {
    document.getElementById('scanner-status').textContent = `Błąd: ${result.error}`;
    return;
  }
  scannerLastStats.lastId = result.startFromId - 1;
  setScannerRunningUi(true);
  logEvent(`Rozpoczęto skanowanie Game ID od ${result.startFromId} do ${endId} (${requestsPerSecond} zapytań/s)`);
}

document.getElementById('scanner-start-btn').addEventListener('click', () => startScanner(false));
document.getElementById('scanner-resume-btn').addEventListener('click', () => startScanner(true));
document.getElementById('scanner-stop-btn').addEventListener('click', async () => {
  await window.api.scanner.stop();
  document.getElementById('scanner-status').textContent += ' Zatrzymywanie (dokończy bieżące zapytanie)...';
});

(async function initScannerStatus() {
  const saved = await window.api.scanner.getSavedProgress();
  if (saved.scanStartId !== '' && saved.scanLastId !== '') {
    document.getElementById('scanner-start-id').value = saved.scanStartId;
    document.getElementById('scanner-end-id').value = saved.scanEndId;
    document.getElementById('scanner-rate').value = saved.scanRequestsPerSecond || 2;
    const remaining = Number(saved.scanEndId) - Number(saved.scanLastId);
    document.getElementById('scanner-status').textContent =
      `Zapisany postęp: sprawdzono do ID ${saved.scanLastId} z zakresu ${saved.scanStartId}-${saved.scanEndId} ` +
      `(pozostało ${remaining} ID). Kliknij "Wznów od zapisanego postępu", żeby kontynuować.`;
  }
  setScannerRunningUi(saved.running);
})();

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

// ---- Import arkusza ligi (Lewa/Prawa) - patrz komentarz w leagueSheetParser.js ----

let leagueSheetFilePath = null;
let leagueSheetRows = [];

function sideNickList(players, side) {
  return players
    .filter((p) => p.team === side)
    .map((p) => p.summonerName)
    .join(', ');
}

function renderLeagueSheetTable() {
  const tbody = document.getElementById('leaguesheet-tbody');
  tbody.innerHTML = '';
  if (!leagueSheetRows.length) {
    tbody.innerHTML = '<tr><td colspan="8">Brak wczytanych wierszy.</td></tr>';
    return;
  }
  leagueSheetRows.forEach((r) => {
    const tr = document.createElement('tr');
    const checkTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = r.ok && !r.alreadyImported;
    checkbox.dataset.gid = r.gid;
    checkTd.appendChild(checkbox);
    tr.appendChild(checkTd);

    if (!r.ok) {
      tr.innerHTML += `<td>${r.gid}</td><td colspan="6">Błąd: ${r.error}</td>`;
      tbody.appendChild(tr);
      return;
    }

    tr.innerHTML += `
      <td>${r.gid}</td>
      <td>${formatDate(r.match.gameCreationDate)}</td>
      <td>${formatTeamLabel(r.match.winningTeam)}</td>
      <td>${sideNickList(r.players, 'LEFT')}</td>
      <td>${sideNickList(r.players, 'RIGHT')}</td>
      <td>${r.match.matchId}</td>
      <td>${r.alreadyImported ? 'Tak' : 'Nie'}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('leaguesheet-pick-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('leaguesheet-pick-result');
  const filePath = await window.api.leagueSheet.pickFile();
  if (!filePath) return;
  leagueSheetFilePath = filePath;
  resultEl.textContent = 'Wczytywanie...';
  const preview = await window.api.leagueSheet.preview(filePath);
  if (!preview.ok) {
    resultEl.textContent = `Błąd: ${preview.error}`;
    return;
  }
  leagueSheetRows = preview.rows;
  resultEl.textContent = `Wczytano ${fileBaseName(filePath)} - ${leagueSheetRows.length} wiersz(y).`;
  renderLeagueSheetTable();
});

document.getElementById('leaguesheet-select-all-btn').addEventListener('click', () => {
  document.querySelectorAll('#leaguesheet-tbody input[type="checkbox"]').forEach((cb) => (cb.checked = true));
});
document.getElementById('leaguesheet-select-none-btn').addEventListener('click', () => {
  document.querySelectorAll('#leaguesheet-tbody input[type="checkbox"]').forEach((cb) => (cb.checked = false));
});

document.getElementById('leaguesheet-import-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('leaguesheet-status');
  if (!leagueSheetFilePath) {
    statusEl.textContent = 'Wybierz najpierw plik arkusza.';
    return;
  }
  const gids = Array.from(document.querySelectorAll('#leaguesheet-tbody input[type="checkbox"]:checked')).map(
    (cb) => cb.dataset.gid
  );
  if (!gids.length) {
    statusEl.textContent = 'Nie zaznaczono żadnego wiersza do importu.';
    return;
  }
  statusEl.textContent = `Importowanie ${gids.length} mecz(ów)...`;
  const importBtn = document.getElementById('leaguesheet-import-btn');
  importBtn.disabled = true;
  try {
    const outcome = await window.api.leagueSheet.import(leagueSheetFilePath, gids);
    if (!outcome.ok) {
      statusEl.textContent = `Błąd: ${outcome.error}`;
      return;
    }
    const failed = outcome.results.filter((r) => !r.ok);
    statusEl.textContent = `Zaimportowano ${outcome.results.length - failed.length}/${outcome.results.length} mecz(ów).`;
    failed.forEach((r) => logEvent(`Import arkusza ligi - GID ${r.gid}: błąd - ${r.error}`));
    const preview = await window.api.leagueSheet.preview(leagueSheetFilePath);
    if (preview.ok) {
      leagueSheetRows = preview.rows;
      renderLeagueSheetTable();
    }
    loadMatches();
  } finally {
    importBtn.disabled = false;
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
