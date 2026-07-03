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
  },
  sync: {
    pushMatch: (matchId) => ipcRenderer.invoke('sync:push-match', matchId),
    pushAllMatches: () => ipcRenderer.invoke('sync:push-all-matches'),
    pushAllPlayers: () => ipcRenderer.invoke('sync:push-all-players'),
    testConnection: () => ipcRenderer.invoke('sync:test-connection'),
  },
  lcu: {
    getStatus: () => ipcRenderer.invoke('lcu:get-status'),
    onStatus: (cb) => ipcRenderer.on('lcu:status', (_evt, data) => cb(data)),
  },
  discord: {
    connect: () => ipcRenderer.invoke('discord:connect'),
  },
  collector: {
    onStatus: (cb) => ipcRenderer.on('collector:status', (_evt, data) => cb(data)),
    onMatchSaved: (cb) => ipcRenderer.on('collector:match-saved', (_evt, data) => cb(data)),
    onPlayersSaved: (cb) => ipcRenderer.on('collector:players-saved', (_evt, data) => cb(data)),
    onSyncResult: (cb) => ipcRenderer.on('collector:sync-result', (_evt, data) => cb(data)),
  },
});
