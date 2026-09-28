import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8080);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8081);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRONTEND_ROOT = path.join(ROOT, 'frontend');
const ADMIN_ROOT = path.join(ROOT, 'admin');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '');
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

function serveFile(res, root, requestPath, fallback) {
  const requested = safePath(root, requestPath);
  if (!requested) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return true;
  }

  let filePath = requested;
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {}

  if (!fs.existsSync(filePath) && fallback) filePath = path.join(root, fallback);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=300'
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function proxy(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` };
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    method: req.method,
    path: req.url,
    headers,
    timeout: 15000
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('Backend request timeout')));
  upstream.on('error', (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Backend unavailable' }));
  });

  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const pathname = String(req.url || '/').split('?')[0];

  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, gateway: 'ok' }));
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxy(req, res);
    return;
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminPath = pathname === '/admin' ? '/index.html' : pathname.slice('/admin'.length) || '/index.html';
    if (serveFile(res, ADMIN_ROOT, adminPath, 'index.html')) return;
  }

  if (serveFile(res, FRONTEND_ROOT, pathname, 'index.html')) return;

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[web-gateway] listening on :${PORT}; backend=127.0.0.1:${BACKEND_PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
