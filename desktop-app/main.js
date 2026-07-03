const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { GameWatcher } = require('./src/collector/gameWatcher');
const { collectMatch } = require('./src/collector/matchBuilder');
const { enrichPlayer } = require('./src/collector/playerProfile');
const { LocalStore } = require('./src/storage/localStore');
const { ConfigStore } = require('./src/config/configStore');
const { postToAppsScript, getFromAppsScript } = require('./src/sync/sheetsClient');

let mainWindow;
let configStore;
let store;
let watcher;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function syncMatchToSheets(matchId) {
  const cfg = configStore.getAll();
  if (!cfg.appsScriptUrl) return { ok: false, error: 'Brak adresu URL Apps Script w ustawieniach.' };
  const data = store.getMatch(matchId);
  if (!data) return { ok: false, error: 'Nie znaleziono meczu lokalnie.' };
  return postToAppsScript(cfg.appsScriptUrl, cfg.sharedSecret, 'syncMatch', {
    match: data.match,
    players: data.players,
  });
}

async function syncPlayersToSheets(players) {
  const cfg = configStore.getAll();
  if (!cfg.appsScriptUrl) return { ok: false, error: 'Brak adresu URL Apps Script w ustawieniach.' };
  return postToAppsScript(cfg.appsScriptUrl, cfg.sharedSecret, 'syncPlayers', { players });
}

async function handleEndOfGame(client) {
  try {
    sendToRenderer('collector:status', { collecting: true });
    const { match, players } = await collectMatch(client);
    store.saveMatch(match, players);
    sendToRenderer('collector:match-saved', { match, players });

    const enriched = [];
    for (const p of players) {
      if (!p.puuid) continue;
      try {
        const profile = await enrichPlayer(client, p);
        enriched.push(profile);
      } catch (err) {
        // pomiń wzbogacenie tego gracza, nie przerywaj reszty
      }
    }
    const merged = store.upsertPlayers(enriched);
    sendToRenderer('collector:players-saved', { players: merged });

    const cfg = configStore.getAll();
    if (cfg.autoSync && cfg.appsScriptUrl) {
      const matchResult = await syncMatchToSheets(match.matchId);
      const playersResult = await syncPlayersToSheets(enriched);
      sendToRenderer('collector:sync-result', { matchResult, playersResult });
    }
    sendToRenderer('collector:status', { collecting: false });
  } catch (err) {
    sendToRenderer('collector:status', { collecting: false, error: String(err) });
  }
}

function startWatcher() {
  const cfg = configStore.getAll();
  watcher = new GameWatcher({ customLockfilePath: cfg.customLockfilePath });
  watcher.on('status', (status) => sendToRenderer('lcu:status', status));
  watcher.on('error', (err) => sendToRenderer('lcu:status', { connected: false, error: String(err) }));
  watcher.on('end-of-game', (client) => handleEndOfGame(client));
  watcher.start();
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  configStore = new ConfigStore(path.join(userDataPath, 'config.json'), path.join(userDataPath, 'data'));
  const cfg = configStore.getAll();
  store = new LocalStore(cfg.dataDir || path.join(userDataPath, 'data'));

  createWindow();
  startWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (watcher) watcher.stop();
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: konfiguracja ----
ipcMain.handle('config:get', () => configStore.getAll());
ipcMain.handle('config:set', (_evt, partial) => {
  const updated = configStore.setAll(partial);
  if (partial.dataDir) store.setBaseDir(partial.dataDir);
  if (Object.prototype.hasOwnProperty.call(partial, 'customLockfilePath') && watcher) {
    watcher.setCustomLockfilePath(partial.customLockfilePath);
  }
  return updated;
});

// ---- IPC: lokalny magazyn danych ----
ipcMain.handle('store:list-matches', () => store.listMatches());
ipcMain.handle('store:get-match', (_evt, matchId) => store.getMatch(matchId));
ipcMain.handle('store:update-match-field', (_evt, { matchId, field, value }) => store.updateMatchField(matchId, field, value));
ipcMain.handle('store:update-match-player-field', (_evt, { matchId, puuid, field, value }) =>
  store.updateMatchPlayerField(matchId, puuid, field, value)
);
ipcMain.handle('store:delete-match', (_evt, matchId) => store.deleteMatch(matchId));
ipcMain.handle('store:list-players', () => store.listPlayers());
ipcMain.handle('store:update-player-field', (_evt, { puuid, field, value }) => store.updatePlayerField(puuid, field, value));

// ---- IPC: synchronizacja z Google Sheets ----
ipcMain.handle('sync:push-match', (_evt, matchId) => syncMatchToSheets(matchId));
ipcMain.handle('sync:push-all-players', () => syncPlayersToSheets(store.listPlayers()));
ipcMain.handle('sync:push-all-matches', async () => {
  const results = [];
  for (const { match } of store.listMatches()) {
    results.push({ matchId: match.matchId, result: await syncMatchToSheets(match.matchId) });
  }
  return results;
});
ipcMain.handle('sync:test-connection', async () => {
  try {
    const cfg = configStore.getAll();
    const res = await getFromAppsScript(cfg.appsScriptUrl);
    return res;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- IPC: status LCU na żądanie (np. po otwarciu okna) ----
ipcMain.handle('lcu:get-status', () => (watcher ? { connected: watcher.lastPhase !== 'DISCONNECTED' && watcher.lastPhase !== null, phase: watcher.lastPhase } : { connected: false }));
