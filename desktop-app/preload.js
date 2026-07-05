const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (partial) => ipcRenderer.invoke('config:set', partial),
  },
  store: {
    listMatches: () => ipcRenderer.invoke('store:list-matches'),
    getMatch: (matchId) => ipcRenderer.invoke('store:get-match', matchId),
    updateMatchField: (matchId, field, value) => ipcRenderer.invoke('store:update-match-field', { matchId, field, value }),
    updateMatchPlayerField: (matchId, puuid, field, value) =>
      ipcRenderer.invoke('store:update-match-player-field', { matchId, puuid, field, value }),
    deleteMatch: (matchId) => ipcRenderer.invoke('store:delete-match', matchId),
    listPlayers: () => ipcRenderer.invoke('store:list-players'),
    updatePlayerField: (puuid, field, value) => ipcRenderer.invoke('store:update-player-field', { puuid, field, value }),
    deletePlayer: (puuid) => ipcRenderer.invoke('store:delete-player', puuid),
  },
  sync: {
    pushMatch: (matchId) => ipcRenderer.invoke('sync:push-match', matchId),
    pushAllMatches: () => ipcRenderer.invoke('sync:push-all-matches'),
    pushAllPlayers: () => ipcRenderer.invoke('sync:push-all-players'),
    testConnection: () => ipcRenderer.invoke('sync:test-connection'),
    deleteMatch: (matchId) => ipcRenderer.invoke('sync:delete-match', matchId),
    deletePlayer: (puuid) => ipcRenderer.invoke('sync:delete-player', puuid),
  },
  lcu: {
    getStatus: () => ipcRenderer.invoke('lcu:get-status'),
    onStatus: (cb) => ipcRenderer.on('lcu:status', (_evt, data) => cb(data)),
  },
  discord: {
    connect: () => ipcRenderer.invoke('discord:connect'),
    syncGuildAvatars: () => ipcRenderer.invoke('discord:sync-guild-avatars'),
  },
  history: {
    listRecentMatches: (count) => ipcRenderer.invoke('history:list-recent-matches', count),
    importMatch: (gameId) => ipcRenderer.invoke('history:import-match', gameId),
  },
  rofl: {
    pickFiles: () => ipcRenderer.invoke('rofl:pick-files'),
    preview: (filePaths) => ipcRenderer.invoke('rofl:preview', filePaths),
    import: (filePaths) => ipcRenderer.invoke('rofl:import', filePaths),
    listFolder: () => ipcRenderer.invoke('rofl:list-folder'),
    detectDefaultFolder: () => ipcRenderer.invoke('rofl:detect-default-folder'),
  },
  legacyJson: {
    pickFiles: () => ipcRenderer.invoke('legacyjson:pick-files'),
    preview: (filePaths) => ipcRenderer.invoke('legacyjson:preview', filePaths),
    import: (filePaths) => ipcRenderer.invoke('legacyjson:import', filePaths),
    listFolder: () => ipcRenderer.invoke('legacyjson:list-folder'),
    detectDefaultFolder: () => ipcRenderer.invoke('legacyjson:detect-default-folder'),
  },
  collector: {
    onStatus: (cb) => ipcRenderer.on('collector:status', (_evt, data) => cb(data)),
    onMatchSaved: (cb) => ipcRenderer.on('collector:match-saved', (_evt, data) => cb(data)),
    onPlayersSaved: (cb) => ipcRenderer.on('collector:players-saved', (_evt, data) => cb(data)),
    onSyncResult: (cb) => ipcRenderer.on('collector:sync-result', (_evt, data) => cb(data)),
  },
});
