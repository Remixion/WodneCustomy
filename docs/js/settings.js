function load() {
  const cfg = getConfig();
  document.getElementById('appsScriptUrl').value = cfg.appsScriptUrl;
  document.getElementById('sharedSecret').value = cfg.sharedSecret;
}

document.getElementById('settings-form').addEventListener('submit', (evt) => {
  evt.preventDefault();
  setConfig({
    appsScriptUrl: document.getElementById('appsScriptUrl').value.trim(),
    sharedSecret: document.getElementById('sharedSecret').value.trim(),
  });
  logEvent('Zapisano ustawienia');
});

document.getElementById('test-connection-btn').addEventListener('click', async () => {
  const resultEl = document.getElementById('test-connection-result');
  resultEl.textContent = 'Testowanie...';
  try {
    const data = await fetchData();
    resultEl.textContent = `Połączono. Mecze: ${data.matches.length}, Gracze: ${data.players.length}`;
    logEvent('Test połączenia: OK');
  } catch (err) {
    resultEl.textContent = `Błąd: ${err.message}`;
    logEvent(`Test połączenia: błąd - ${err.message}`);
  }
});

load();
