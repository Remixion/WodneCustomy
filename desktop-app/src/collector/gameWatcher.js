const EventEmitter = require('events');
const { findLeagueClient } = require('../lcu/lockfile');
const { LcuClient } = require('../lcu/client');

/**
 * Odpytuje LCU o fazę gry (gameflow-phase) i emituje zdarzenie 'end-of-game',
 * gdy właśnie zakończyła się gra (przejście fazy na 'EndOfGame').
 */
class GameWatcher extends EventEmitter {
  constructor({ pollIntervalMs = 3000, customLockfilePath } = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.customLockfilePath = customLockfilePath;
    this.lastPhase = null;
    this.client = null;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => this.emit('error', err));
    }, this.pollIntervalMs);
    this.tick().catch((err) => this.emit('error', err));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setCustomLockfilePath(customLockfilePath) {
    this.customLockfilePath = customLockfilePath;
    this.client = null;
  }

  async ensureClient() {
    if (this.client) return this.client;
    const info = findLeagueClient(this.customLockfilePath);
    if (!info) return null;
    this.client = new LcuClient(info);
    return this.client;
  }

  async tick() {
    const client = await this.ensureClient();
    if (!client) {
      if (this.lastPhase !== 'DISCONNECTED') {
        this.lastPhase = 'DISCONNECTED';
        this.emit('status', { connected: false });
      }
      return;
    }
    let phase;
    try {
      phase = await client.get('/lol-gameflow/v1/gameflow-phase');
    } catch (err) {
      this.client = null;
      this.lastPhase = 'DISCONNECTED';
      this.emit('status', { connected: false });
      return;
    }
    if (phase !== this.lastPhase) {
      this.emit('status', { connected: true, phase });
      if (phase === 'EndOfGame') {
        this.emit('end-of-game', client);
      }
      this.lastPhase = phase;
    }
  }
}

module.exports = { GameWatcher };
