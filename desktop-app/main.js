const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { GameWatcher } = require('./src/collector/gameWatcher');
const { collectMatch, buildMatchFromGameId } = require('./src/collector/matchBuilder');
const { fetchRecentMatchSummaries } = require('./src/collector/matchHistoryList');
const { parseGameIdFromRoflFilename, detectDefaultReplaysFolder, listRoflFilesInFolder } = require('./src/collector/roflParser');
const { enrichPlayer } = require('./src/collector/playerProfile');
const { LocalStore } = require('./src/storage/localStore');
const { ConfigStore } = require('./src/config/configStore');
const { postToAppsScript, getFromAppsScript } = require('./src/sync/sheetsClient');
const { connectDiscordRpc, buildDiscordAvatarUrl } = require('./src/discord/discordRpc');
const { fetchAllGuildMembers, buildDiscordMemberLookup } = require('./src/discord/discordBot');
const { getCurrentSummonerPuuid } = require('./src/lcu/currentSummoner');
const { findLeagueClient } = require('./src/lcu/lockfile');
const { LcuClient } = require('./src/lcu/client');

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

/**
 * Wspólna ścieżka zapisu meczu: zapis lokalny, wzbogacenie profili graczy
 * (best-effort) i synchronizacja z Arkuszem. Używana zarówno przez
 * automatyczne przechwytywanie (handleEndOfGame) jak i ręczny import
 * (z historii klienta albo z pliku .rofl).
 */
async function processCollectedMatch(client, { match, players }, { autoSyncOverride } = {}) {
  store.saveMatchPreservingData(match, players);
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
  const shouldSync = autoSyncOverride !== undefined ? autoSyncOverride : cfg.autoSync;
  let syncResult = null;
  if (shouldSync && cfg.appsScriptUrl) {
    const matchResult = await syncMatchToSheets(match.matchId);
    const playersResult = await syncPlayersToSheets(enriched);
    syncResult = { matchResult, playersResult };
    sendToRenderer('collector:sync-result', syncResult);
  }
  return { match, players, enrichedCount: enriched.length, syncResult };
}

async function handleEndOfGame(client) {
  try {
    sendToRenderer('collector:status', { collecting: true });
    const { match, players } = await collectMatch(client);
    await processCollectedMatch(client, { match, players });
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
ipcMain.handle('store:delete-player', (_evt, puuid) => store.deletePlayer(puuid));

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
ipcMain.handle('sync:delete-match', async (_evt, matchId) => {
  const cfg = configStore.getAll();
  if (!cfg.appsScriptUrl) return { ok: false, error: 'Brak adresu URL Apps Script w ustawieniach.' };
  try {
    return await postToAppsScript(cfg.appsScriptUrl, cfg.sharedSecret, 'deleteMatch', { matchId });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
ipcMain.handle('sync:delete-player', async (_evt, puuid) => {
  const cfg = configStore.getAll();
  if (!cfg.appsScriptUrl) return { ok: false, error: 'Brak adresu URL Apps Script w ustawieniach.' };
  try {
    return await postToAppsScript(cfg.appsScriptUrl, cfg.sharedSecret, 'deletePlayer', { puuid });
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- IPC: status LCU na żądanie (np. po otwarciu okna) ----
ipcMain.handle('lcu:get-status', () => (watcher ? { connected: watcher.lastPhase !== 'DISCONNECTED' && watcher.lastPhase !== null, phase: watcher.lastPhase } : { connected: false }));

// ---- IPC: drugie źródło awatarów - Discord (lokalny klient przez IPC) ----
ipcMain.handle('discord:connect', async () => {
  const cfg = configStore.getAll();
  if (!cfg.discordClientId) {
    return { ok: false, error: 'Brak skonfigurowanego Discord Client ID (zakładka Ustawienia).' };
  }

  let discordUser;
  try {
    discordUser = await connectDiscordRpc(cfg.discordClientId);
  } catch (err) {
    return { ok: false, error: `Nie udało się połączyć z Discordem: ${err.message}` };
  }

  let puuid;
  try {
    const info = findLeagueClient(cfg.customLockfilePath);
    if (!info) throw new Error('Klient League of Legends nie jest uruchomiony.');
    const client = new LcuClient(info);
    puuid = await getCurrentSummonerPuuid(client);
    if (!puuid) throw new Error('Nie udało się odczytać puuid zalogowanego gracza.');
  } catch (err) {
    return { ok: false, error: `Połączono z Discordem (${discordUser.username}), ale nie udało się dopasować do gracza League: ${err.message}` };
  }

  const avatarUrl = buildDiscordAvatarUrl(discordUser);
  const discordFields = {
    puuid,
    discordUserId: discordUser.id,
    discordAvatarHash: discordUser.avatar || '',
    discordAvatarUrl: avatarUrl,
  };
  store.upsertPlayers([discordFields]);

  let syncResult = null;
  const cfgNow = configStore.getAll();
  if (cfgNow.appsScriptUrl) {
    syncResult = await postToAppsScript(cfgNow.appsScriptUrl, cfgNow.sharedSecret, 'syncPlayers', { players: [discordFields] });
  }

  return { ok: true, puuid, discordUser, avatarUrl, syncResult };
});

// ---- IPC: masowe pobranie awatarów dla wszystkich graczy z serwera Discord (przez bota) ----
ipcMain.handle('discord:sync-guild-avatars', async () => {
  const cfg = configStore.getAll();
  if (!cfg.discordBotToken || !cfg.discordGuildId) {
    return { ok: false, error: 'Brak skonfigurowanego tokena bota lub ID serwera Discord (zakładka Ustawienia).' };
  }

  let members;
  try {
    members = await fetchAllGuildMembers(cfg.discordBotToken, cfg.discordGuildId);
  } catch (err) {
    return { ok: false, error: `Nie udało się pobrać listy członków serwera: ${err.message}` };
  }

  const lookup = buildDiscordMemberLookup(cfg.discordGuildId, members, buildDiscordAvatarUrl);

  // Preferuj graczy z Arkusza (współdzielone źródło prawdy), z fallbackiem na dane lokalne.
  let players = store.listPlayers();
  if (cfg.appsScriptUrl) {
    try {
      const remote = await getFromAppsScript(cfg.appsScriptUrl);
      if (remote.ok && remote.data && remote.data.players) players = remote.data.players;
    } catch (err) {
      // brak połączenia z arkuszem - pracuj na danych lokalnych
    }
  }

  const matched = [];
  const unmatched = [];
  players.forEach((player) => {
    const key = (player.discordNick || '').trim().toLowerCase();
    if (!key) return;
    const found = lookup[key];
    if (found) {
      matched.push({ puuid: player.puuid, ...found });
    } else {
      unmatched.push(player.discordNick);
    }
  });

  if (matched.length) {
    store.upsertPlayers(matched);
  }

  let syncResult = null;
  if (matched.length && cfg.appsScriptUrl) {
    syncResult = await postToAppsScript(cfg.appsScriptUrl, cfg.sharedSecret, 'syncPlayers', { players: matched });
  }

  return { ok: true, membersFound: members.length, matchedCount: matched.length, unmatched, syncResult };
});

/** Tworzy klienta LCU do jednorazowego użycia (import), niezależnego od instancji GameWatchera. */
function createOneOffLcuClient() {
  const cfg = configStore.getAll();
  const info = findLeagueClient(cfg.customLockfilePath);
  if (!info) return null;
  return new LcuClient(info);
}

/** Odczytuje eogStatsBlock zachowany z wcześniejszego importu tego meczu (jeśli istnieje). */
function getPreviousEogStatsBlock(gameId) {
  const existing = store.getMatch(gameId);
  if (!existing) return null;
  try {
    return JSON.parse(existing.match.rawDataJson).eogStatsBlock || null;
  } catch (err) {
    return null;
  }
}

// ---- IPC: import z lokalnej historii meczów klienta (mecze sprzed uruchomienia tej apki) ----
ipcMain.handle('history:list-recent-matches', async (_evt, count) => {
  try {
    const client = createOneOffLcuClient();
    if (!client) return { ok: false, error: 'Klient League of Legends nie jest uruchomiony.' };
    const puuid = await getCurrentSummonerPuuid(client);
    if (!puuid) return { ok: false, error: 'Nie udało się odczytać puuid zalogowanego gracza.' };
    const summaries = await fetchRecentMatchSummaries(client, puuid, count || 20);
    const existingIds = new Set(store.listMatches().map((m) => String(m.match.matchId)));
    return { ok: true, matches: summaries.map((s) => ({ ...s, alreadyImported: existingIds.has(s.gameId) })) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('history:import-match', async (_evt, gameId) => {
  try {
    const client = createOneOffLcuClient();
    if (!client) return { ok: false, error: 'Klient League of Legends nie jest uruchomiony.' };
    const previousEogStatsBlock = getPreviousEogStatsBlock(gameId);
    const { match, players } = await buildMatchFromGameId(client, gameId, { includeEogStatsBlock: false, previousEogStatsBlock });
    const result = await processCollectedMatch(client, { match, players });
    return { ok: true, matchId: result.match.matchId, enrichedCount: result.enrichedCount, syncResult: result.syncResult };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- IPC: import z plików .rofl (patrz komentarz w roflParser.js o ograniczeniach) ----
ipcMain.handle('rofl:pick-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz plik .rofl',
    filters: [{ name: 'League of Legends Replay', extensions: ['rofl'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('rofl:detect-default-folder', () => detectDefaultReplaysFolder());

// Lista plików .rofl ze skonfigurowanego folderu (patrz Ustawienia) wraz z informacją,
// czy dany mecz jest już zapisany lokalnie.
ipcMain.handle('rofl:list-folder', () => {
  const cfg = configStore.getAll();
  if (!cfg.roflFolderPath) {
    return { ok: false, error: 'Nie skonfigurowano folderu z plikami .rofl (zakładka Ustawienia).' };
  }
  try {
    const files = listRoflFilesInFolder(cfg.roflFolderPath);
    const existingIds = new Set(store.listMatches().map((m) => String(m.match.matchId)));
    return {
      ok: true,
      files: files.map((f) => ({ ...f, alreadyImported: f.gameId ? existingIds.has(f.gameId) : false })),
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Podgląd danych meczu przed zapisem - wyłącznie odczyt, nic nie zapisuje ani nie synchronizuje.
ipcMain.handle('rofl:preview', async (_evt, filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    const gameId = parseGameIdFromRoflFilename(filePath);
    if (!gameId) {
      results.push({ filePath, ok: false, error: 'Nie udało się odczytać identyfikatora gry z nazwy pliku (oczekiwano np. "EUN1-1234567890.rofl").' });
      continue;
    }
    const client = createOneOffLcuClient();
    if (!client) {
      results.push({ filePath, gameId, ok: false, error: 'Klient League of Legends nie jest uruchomiony - podgląd niedostępny.' });
      continue;
    }
    try {
      const previousEogStatsBlock = getPreviousEogStatsBlock(gameId);
      const { match, players } = await buildMatchFromGameId(client, gameId, { includeEogStatsBlock: false, previousEogStatsBlock });
      results.push({ filePath, gameId, ok: true, match, players });
    } catch (err) {
      results.push({ filePath, gameId, ok: false, error: String(err) });
    }
  }
  return results;
});

ipcMain.handle('rofl:import', async (_evt, filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    const gameId = parseGameIdFromRoflFilename(filePath);
    if (!gameId) {
      results.push({ filePath, ok: false, error: 'Nie udało się odczytać identyfikatora gry z nazwy pliku (oczekiwano np. "EUN1-1234567890.rofl").' });
      continue;
    }

    const client = createOneOffLcuClient();
    if (client) {
      try {
        const previousEogStatsBlock = getPreviousEogStatsBlock(gameId);
        const { match, players } = await buildMatchFromGameId(client, gameId, { includeEogStatsBlock: false, previousEogStatsBlock });
        const result = await processCollectedMatch(client, { match, players });
        results.push({ filePath, ok: true, matchId: result.match.matchId, full: true });
        continue;
      } catch (err) {
        // klient działa, ale nie ma dostępu do historii tej gry - zapisz zapasowo minimalny wpis poniżej
      }
    }

    try {
      // Jeśli ten mecz jest już zapisany (nawet z wcześniejszego importu), nie
      // degraduj go do pustego wpisu tylko dlatego, że akurat teraz klient
      // League nie ma do niego dostępu - zostaw istniejące dane bez zmian.
      if (store.getMatch(gameId)) {
        results.push({
          filePath,
          ok: false,
          error: 'Mecz już istnieje lokalnie, a klient League nie ma teraz dostępu do jego pełnych danych - pozostawiono bez zmian.',
        });
        continue;
      }

      const stat = fs.statSync(filePath);
      const match = {
        matchId: gameId,
        gameCreationDate: stat.mtime.toISOString(),
        gameDurationSec: '',
        gameMode: '',
        gameType: '',
        mapId: '',
        queueId: '',
        gameVersion: '',
        winningTeam: '',
        blueBans: '',
        redBans: '',
        blueBaronKills: 0,
        blueDragonKills: 0,
        blueHeraldKills: 0,
        blueTowerKills: 0,
        blueInhibKills: 0,
        redBaronKills: 0,
        redDragonKills: 0,
        redHeraldKills: 0,
        redTowerKills: 0,
        redInhibKills: 0,
        notes:
          'Import z pliku .rofl bez pełnych danych - klient League nie był uruchomiony albo nie miał dostępu ' +
          'do historii tej gry. Spróbuj ponownie, gdy będzie zalogowane konto, które w niej grało, albo użyj ' +
          '"Import z historii klienta" / uzupełnij dane ręcznie.',
        rawDataJson: '',
      };
      store.saveMatch(match, []);
      results.push({ filePath, ok: true, matchId: gameId, full: false });
    } catch (err) {
      results.push({ filePath, ok: false, error: String(err) });
    }
  }
  return results;
});
