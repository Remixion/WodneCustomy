function logEvent(message) {
  const list = document.getElementById('log-list');
  if (!list) return;
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString('pl-PL');
  item.textContent = `[${time}] ${message}`;
  list.prepend(item);
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
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
