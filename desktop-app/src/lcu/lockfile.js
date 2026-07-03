const fs = require('fs');
const { execSync } = require('child_process');

const COMMON_PATHS = {
  win32: [
    'C:/Riot Games/League of Legends/lockfile',
    'C:/Program Files/Riot Games/League of Legends/lockfile',
    'C:/Program Files (x86)/Riot Games/League of Legends/lockfile',
  ],
  darwin: ['/Applications/League of Legends.app/Contents/LoL/lockfile'],
  linux: [],
};

function readLockfile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  const [name, pid, port, password, protocol] = content.split(':');
  return { name, pid: Number(pid), port: Number(port), password, protocol: protocol || 'https' };
}

function findViaCommonPaths() {
  const candidates = COMMON_PATHS[process.platform] || [];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return readLockfile(candidate);
      } catch (err) {
        // spróbuj kolejnej ścieżki
      }
    }
  }
  return null;
}

function findViaProcessList() {
  try {
    let cmd;
    if (process.platform === 'win32') {
      cmd = 'wmic PROCESS WHERE "name=\'LeagueClientUx.exe\'" GET CommandLine';
    } else {
      cmd = 'ps -A -o command | grep LeagueClientUx';
    }
    const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const portMatch = output.match(/--app-port=(\d+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/);
    if (portMatch && tokenMatch) {
      return { port: Number(portMatch[1]), password: tokenMatch[1], protocol: 'https' };
    }
  } catch (err) {
    // klient League nie jest uruchomiony lub polecenie systemowe niedostępne
  }
  return null;
}

/**
 * Próbuje zlokalizować dane uwierzytelniające do lokalnego LCU API.
 * Kolejność: własna ścieżka z ustawień -> typowe ścieżki instalacji -> lista procesów systemowych.
 */
function findLeagueClient(customLockfilePath) {
  if (customLockfilePath && fs.existsSync(customLockfilePath)) {
    try {
      return readLockfile(customLockfilePath);
    } catch (err) {
      // ignoruj i spróbuj innych metod
    }
  }
  return findViaCommonPaths() || findViaProcessList();
}

module.exports = { findLeagueClient, readLockfile };
