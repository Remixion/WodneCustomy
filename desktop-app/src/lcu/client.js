const https = require('https');

/** Klient HTTPS do lokalnego LCU API (certyfikat self-signed, autoryzacja Basic riot:<password>). */
class LcuClient {
  constructor({ port, password, protocol = 'https' }) {
    this.port = port;
    this.protocol = protocol;
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
