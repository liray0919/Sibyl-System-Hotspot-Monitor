const http = require('http');
const https = require('https');

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7'
};

function requestText(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    retries = 1,
    body = null,
    redirectLimit = 3
  } = options;

  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries, remainingRedirects, targetUrl) => {
      const parsed = new URL(targetUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const data = body ? Buffer.from(body) : null;
      const requestOptions = {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          ...DEFAULT_HEADERS,
          ...headers,
          ...(data ? { 'Content-Length': data.length } : {})
        }
      };

      const req = client.request(requestOptions, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const location = res.headers.location;
          if (res.statusCode >= 300 && res.statusCode < 400 && location && remainingRedirects > 0) {
            const nextUrl = new URL(location, targetUrl).toString();
            attempt(remainingRetries, remainingRedirects - 1, nextUrl);
            return;
          }

          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(text);
            return;
          }

          const error = new Error(`HTTP ${res.statusCode}: ${text.slice(0, 120)}`);
          if (remainingRetries > 0) {
            setTimeout(() => attempt(remainingRetries - 1, remainingRedirects, targetUrl), 800);
          } else {
            reject(error);
          }
        });
      });

      req.on('error', (err) => {
        if (remainingRetries > 0) {
          setTimeout(() => attempt(remainingRetries - 1, remainingRedirects, targetUrl), 800);
        } else {
          reject(err);
        }
      });

      req.setTimeout(timeout, () => {
        req.destroy(new Error(`Request timeout after ${timeout}ms`));
      });

      if (data) req.write(data);
      req.end();
    };

    attempt(retries, redirectLimit, url);
  });
}

async function requestJson(url, options = {}) {
  const text = await requestText(url, options);
  return JSON.parse(text);
}

module.exports = {
  requestText,
  requestJson
};
