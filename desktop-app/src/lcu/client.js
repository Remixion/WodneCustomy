const https = require('https');

const DEFAULT_TIMEOUT_MS = 10000;

/** Klient HTTPS do lokalnego LCU API (certyfikat self-signed, autoryzacja Basic riot:<password>). */
class LcuClient {
  constructor({ port, password, protocol = 'https' }, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.port = port;
    this.protocol = protocol;
    this.timeoutMs = timeoutMs;
    this.authHeader = 'Basic ' + Buffer.from('riot:' + password).toString('base64');
  }

  request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
      const data = body !== undefined ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: urlPath,
        method,
        rejectUnauthorized: false,
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      };
      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`LCU ${method} ${urlPath} -> ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          if (res.statusCode === 204 || !raw) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            resolve(raw);
          }
        });
      });
      // Bez limitu czasu pojedyncze zawieszone żądanie (np. do niedostępnego
      // gracza w starym meczu) blokowałoby całą operację w nieskończoność.
      req.setTimeout(this.timeoutMs, () => {
        req.destroy(new Error(`LCU ${method} ${urlPath} -> przekroczono limit czasu (${this.timeoutMs} ms)`));
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  get(urlPath) {
    return this.request('GET', urlPath);
  }

  post(urlPath, body) {
    return this.request('POST', urlPath, body);
  }
}

module.exports = { LcuClient };
