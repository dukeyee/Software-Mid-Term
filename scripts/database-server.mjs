import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/sqlite-adapter.mjs';
import { handleApi } from '../server/api.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
const DB = openDatabase(path.join(root, 'data/studio.sqlite'));
DB.sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for (const name of fs.readdirSync(path.join(root, 'drizzle')).filter(name => name.endsWith('.sql')).sort()) {
  if (DB.sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)) continue;
  DB.sqlite.exec('BEGIN');
  try { DB.sqlite.exec(fs.readFileSync(path.join(root, 'drizzle', name), 'utf8')); DB.sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name); DB.sqlite.exec('COMMIT'); }
  catch (error) { DB.sqlite.exec('ROLLBACK'); throw error; }
}
// Local-only fixture initialization; hosted setup is protected by a secret.
const localKey = crypto.randomUUID(), origin = 'http://127.0.0.1:' + (process.env.PORT || 4173);
const setup = new Request(origin + '/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ setupKey: localKey }) });
await handleApi(setup, { DB, BOOTSTRAP_KEY: localKey });
http.createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  try {
    if (url.pathname.startsWith('/api/')) {
      const parts = []; for await (const part of req) { parts.push(part); if (Buffer.concat(parts).length > 100000) { res.writeHead(413).end(); return; } }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Buffer.concat(parts) }) });
      const result = await handleApi(request, { DB });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
    }
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    if (!['index.html', 'styles.css', 'core.js', 'app.js', 'auth.js'].includes(relative)) { res.writeHead(404).end(); return; }
    const data = fs.readFileSync(path.join(root, 'web', relative));
    res.writeHead(200, { 'Content-Type': relative.endsWith('.css') ? 'text/css; charset=utf-8' : relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data);
  } catch (error) { console.error(error); res.writeHead(500).end('Server error'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Database site: ${origin}`));
