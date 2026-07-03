const net = require('net');
const path = require('path');

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;

function getIpcPath(index) {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\discord-ipc-${index}`;
  }
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return path.join(base, `discord-ipc-${index}`);
}

function encodeFrame(opcode, obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

/**
 * Łączy się z lokalnie uruchomionym klientem Discord przez IPC (protokół
 * Rich Presence/RPC) i zwraca dane aktualnie zalogowanego użytkownika
 * Discorda. Nie wymaga ekranu zgody OAuth - podstawowe dane użytkownika
 * (id, username, avatar) są przekazywane od razu w zdarzeniu READY, tak jak
 * przy standardowej integracji Rich Presence w grach.
 */
function connectDiscordRpc(clientId, { timeoutMs = 8000, maxPipeIndex = 9 } = {}) {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('Brak skonfigurowanego Discord Client ID.'));
      return;
    }

    let index = 0;
    let settled = false;
    let socket = null;
    let buffer = Buffer.alloc(0);
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (socket) socket.destroy();
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const succeed = (user) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(user);
    };

    function tryConnect() {
      if (settled) return;
      if (index > maxPipeIndex) {
        fail(new Error('Nie znaleziono uruchomionego klienta Discord (brak potoku IPC). Upewnij się, że desktopowa aplikacja Discord jest uruchomiona i zalogowana.'));
        return;
      }
      const ipcPath = getIpcPath(index);
      socket = net.createConnection({ path: ipcPath });

      socket.on('connect', () => {
        socket.write(encodeFrame(OP_HANDSHAKE, { v: 1, client_id: clientId }));
      });

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 8) {
          const opcode = buffer.readInt32LE(0);
          const length = buffer.readInt32LE(4);
          if (buffer.length < 8 + length) break;
          const payload = buffer.slice(8, 8 + length);
          buffer = buffer.slice(8 + length);

          if (opcode === OP_CLOSE) {
            let reason = 'Discord zamknął połączenie IPC.';
            try {
              const closeMsg = JSON.parse(payload.toString('utf8'));
              if (closeMsg && closeMsg.message) reason = closeMsg.message;
            } catch (err) {
              // brak czytelnego powodu - zostaw domyślny komunikat
            }
            fail(new Error(reason));
            return;
          }
          if (opcode !== OP_FRAME) continue;

          try {
            const msg = JSON.parse(payload.toString('utf8'));
            if (msg.evt === 'READY' && msg.data && msg.data.user) {
              succeed(msg.data.user);
              return;
            }
            if (msg.evt === 'ERROR') {
              fail(new Error((msg.data && msg.data.message) || 'Błąd Discord RPC.'));
              return;
            }
          } catch (err) {
            // zignoruj nieoczekiwaną/niekompletną ramkę
          }
        }
      });

      socket.on('error', () => {
        socket.destroy();
        index += 1;
        tryConnect();
      });
    }

    timer = setTimeout(() => fail(new Error('Przekroczono czas oczekiwania na odpowiedź klienta Discord.')), timeoutMs);
    tryConnect();
  });
}

/** Buduje URL awatara na podstawie danych użytkownika Discorda (własny lub domyślny embed avatar). */
function buildDiscordAvatarUrl(user) {
  if (!user) return '';
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
  }
  let index = 0;
  if (user.discriminator && user.discriminator !== '0') {
    index = Number(user.discriminator) % 5;
  } else {
    try {
      index = Number(BigInt(user.id) >> 22n) % 6;
    } catch (err) {
      index = 0;
    }
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

module.exports = { connectDiscordRpc, buildDiscordAvatarUrl };
