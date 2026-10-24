// Serve dist/ at http://localhost:8080 so tools like Lighthouse can audit the page.
// No downloads needed: uses only Node.js itself. Only this computer can reach it (127.0.0.1).
// Usage: node tools/serve.mjs      Stop with Ctrl+C.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

createServer(async (req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  const file = resolve(ROOT, '.' + (path === '/' ? '/index.html' : path));
  const rel = relative(ROOT, file);
  if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403).end('Forbidden'); return; }   // only files inside dist/
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Serving dist/ at http://localhost:${PORT}  (Ctrl+C to stop)`));
