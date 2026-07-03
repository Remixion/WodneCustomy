const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Komunikacja z backendem Google Apps Script.
 * POST wysyłany jest z Content-Type: text/plain (ta sama sztuczka co na stronie
 * GitHub Pages) - Apps Script Web App nie obsługuje CORS-preflight (OPTIONS),
 * a text/plain jest "prostym" żądaniem, które go unika. Node nie podlega CORS,
 * ale zachowujemy spójność formatu z frontendem.
 * Adresy /exec Apps Script odpowiadają przekierowaniem 301/302 do statycznego
 * endpointu script.googleusercontent.com/macros/echo z faktyczną treścią -
 * Node tego nie robi automatycznie, trzeba podążyć ręcznie. WAŻNE: ten
 * endpoint "echo" obsługuje wyłącznie GET - jeśli oryginalne żądanie było
 * POST-em, przekierowanie trzeba wysłać jako GET bez ciała (dokładnie tak,
 * jak robią to przeglądarki po 301/302/303 dla POST-a). Wysłanie tam
 * ponownie POST-a z ciałem kończy się błędem 405 i przeglądarkową stroną
 * błędu zamiast odpowiedzi JSON.
 */

function requestJson(targetUrl, options, body, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const lib = url.protocol === 'http:' ? http : https;
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      method: options.method,
      headers: options.headers,
    };
    const req = lib.request(reqOptions, (res) => {
      if ((res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 303) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const followOptions = { method: 'GET', headers: {} };
        requestJson(res.headers.location, followOptions, null, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          resolve({ ok: false, error: `Nieprawidłowa odpowiedź serwera (HTTP ${res.statusCode}): ${raw.slice(0, 300)}` });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function postToAppsScript(appsScriptUrl, sharedSecret, action, payload) {
  if (!appsScriptUrl) return Promise.reject(new Error('Brak skonfigurowanego adresu URL Apps Script (zakładka Ustawienia).'));
  const body = JSON.stringify({ token: sharedSecret, action, payload });
  return requestJson(appsScriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

function getFromAppsScript(appsScriptUrl) {
  if (!appsScriptUrl) return Promise.reject(new Error('Brak skonfigurowanego adresu URL Apps Script (zakładka Ustawienia).'));
  return requestJson(appsScriptUrl, { method: 'GET', headers: {} }, null);
}

module.exports = { postToAppsScript, getFromAppsScript };
