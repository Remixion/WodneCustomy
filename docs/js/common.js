function getConfig() {
  return {
    appsScriptUrl: localStorage.getItem('appsScriptUrl') || '',
    sharedSecret: localStorage.getItem('sharedSecret') || '',
  };
}

function setConfig(cfg) {
  localStorage.setItem('appsScriptUrl', cfg.appsScriptUrl || '');
  localStorage.setItem('sharedSecret', cfg.sharedSecret || '');
}

async function fetchData() {
  const { appsScriptUrl } = getConfig();
  if (!appsScriptUrl) throw new Error('Brak skonfigurowanego adresu URL Apps Script. Przejdź do zakładki Ustawienia.');
  const res = await fetch(appsScriptUrl, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Nieznany błąd serwera.');
  return json.data;
}

async function postAction(action, payload) {
  const { appsScriptUrl, sharedSecret } = getConfig();
  if (!appsScriptUrl) throw new Error('Brak skonfigurowanego adresu URL Apps Script. Przejdź do zakładki Ustawienia.');
  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: sharedSecret, action, payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Nieznany błąd serwera.');
  return json;
}

function logEvent(message) {
  const list = document.getElementById('log-list');
  if (!list) return;
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString('pl-PL');
  item.textContent = `[${time}] ${message}`;
  list.prepend(item);
}

function formatDuration(seconds) {
  if (seconds === '' || seconds === null || seconds === undefined) return '';
  const total = Number(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch (err) {
    return iso;
  }
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
