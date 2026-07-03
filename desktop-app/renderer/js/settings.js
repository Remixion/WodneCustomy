async function load() {
  const cfg = await window.api.config.get();
  document.getElementById('appsScriptUrl').value = cfg.appsScriptUrl || '';
  document.getElementById('sharedSecret').value = cfg.sharedSecret || '';
  document.getElementById('autoSync').checked = !!cfg.autoSync;
  document.getElementById('dataDir').value = cfg.dataDir || '';
  document.getElementById('customLockfilePath').value = cfg.customLockfilePath || '';
  document.getElementById('discordClientId').value = cfg.discordClientId || '';
}

document.getElementById('settings-form').addEventListener('submit', async (evt) => {
  evt.preventDefault();
  const partial = {
    appsScriptUrl: document.getElementById('appsScriptUrl').value.trim(),
    sharedSecret: document.getElementById('sharedSecret').value.trim(),
    autoSync: document.getElementById('autoSync').checked,
    dataDir: document.getElementById('dataDir').value.trim(),
    customLockfilePath: document.getElementById('customLockfilePath').value.trim(),
    discordClientId: document.getElementById('discordClientId').value.trim(),
  };
  await window.api.config.set(partial);
  logEvent('Zapisano ustawienia');
});

document.getElementById('discord-connect-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('discord-connect-result');
  resultEl.textContent = 'Łączenie z Discordem...';
  const result = await window.api.discord.connect();
  resultEl.textContent = result.ok
    ? `Zapisano avatar Discorda (${result.discordUser.username}) dla gracza puuid ${result.puuid.slice(0, 8)}...`
    : `Błąd: ${result.error}`;
  logEvent(`Discord: ${result.ok ? 'OK - ' + result.discordUser.username : 'błąd - ' + result.error}`);
});

document.getElementById('test-connection-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('test-connection-result');
  resultEl.textContent = 'Testowanie...';
  const result = await window.api.sync.testConnection();
  resultEl.textContent = result.ok
    ? `Połączono. Mecze: ${result.data.matches.length}, Gracze: ${result.data.players.length}`
    : `Błąd: ${result.error}`;
  logEvent(`Test połączenia: ${result.ok ? 'OK' : 'błąd'}`);
});

load();
