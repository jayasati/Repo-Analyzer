/**
 * server.js — Minimal static file server for the frontend.
 *
 * Usage:
 *   node server.js           (default port 5173)
 *   PORT=8080 node server.js (custom port)
 *
 * No npm install needed — uses only Node.js built-ins.
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT  = parseInt(process.env.PORT ?? '5173', 10);
const ROOT  = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  const parsed   = url.parse(req.url);
  let   pathname = decodeURIComponent(parsed.pathname ?? '/');

  // Default to index.html
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.join(ROOT, pathname);

  // Security: stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); }
      else                       { res.writeHead(500); res.end('Server error'); }
      return;
    }

    const ext      = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type':  mimeType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ┌─────────────────────────────────────┐`);
  console.log(`  │  Repo Analyzer Frontend              │`);
  console.log(`  │  Local:  http://localhost:${PORT}      │`);
  console.log(`  │  Backend expected at :3000           │`);
  console.log(`  └─────────────────────────────────────┘\n`);
});