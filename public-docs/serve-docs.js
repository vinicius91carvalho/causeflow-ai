#!/usr/bin/env node
// CauseFlow public docs — open-source local runtime static server.
//
// This replaces the `serve.js` shipped inside the `mint export` zip so that the
// docker-compose runtime honours:
//   1. `docs.json#redirects` (e.g. `/quickstart` -> `/getting-started/quickstart`)
//      — the source URL resolves to the destination page (HTTP 200, internal
//      rewrite, so a single `GET` lands on the page without a follow-up hop).
//   2. Mintlify's directory-index layout where an `index.mdx` page is exported
//      to `<dir>/index/index.html` (e.g. `/changelog` -> `changelog/index/index.html`).
//
// Pure Node `http`/`fs`/`path` only. No outbound network calls, no SaaS
// dependencies, no account credentials. The only runtime env var is `PORT`
// (default 3000). `docs.json` is copied into the image alongside this script
// (it is not included in the `mint export` zip).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Load redirects from docs.json (best-effort; absent/invalid => none).
let redirects = {};
try {
  const docsPath = path.join(DIR, 'docs.json');
  if (fs.existsSync(docsPath)) {
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
    if (Array.isArray(docs.redirects)) {
      for (const r of docs.redirects) {
        if (r && typeof r.source === 'string' && typeof r.destination === 'string') {
          redirects[r.source] = r.destination;
        }
      }
    }
  }
} catch (err) {
  console.error('serve-docs: could not load docs.json redirects:', err.message);
}

function resolveFile(urlPath) {
  const filePath = path.resolve(DIR, urlPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(DIR + path.sep) && filePath !== DIR) return undefined;
  // Mintlify export layouts:
  //   - `<path>/index.html`            (e.g. getting-started/quickstart/index.html)
  //   - `<path>/index/index.html`      (e.g. changelog/index/index.html for /changelog)
  //   - `<path>.html`
  const candidates = [
    filePath,
    path.join(filePath, 'index.html'),
    path.join(filePath, 'index', 'index.html'),
    filePath + '.html',
  ];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

function normalize(p) {
  // Strip query/hash and collapse a single trailing slash (except root).
  let s = (p || '/').split('?')[0].split('#')[0];
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(normalize(req.url || '/'));
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Honour docs.json#redirects as an internal rewrite so the source URL
    // returns 200 with the destination page (no extra hop required).
    if (Object.prototype.hasOwnProperty.call(redirects, urlPath)) {
      urlPath = normalize(redirects[urlPath]);
    }

    const file = resolveFile(urlPath);

    if (file) {
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  })
  .listen(PORT, () => {
    console.log('Serving docs at http://localhost:' + PORT);
  });
