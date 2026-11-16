import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openMySQL } from '../server/mysql-adapter.mjs';
import { handleApi } from '../server/api.mjs';
import { proxySharedApi } from '../server/shared-proxy.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
if (fs.existsSync(path.join(root, '.env.shared'))) process.loadEnvFile(path.join(root, '.env.shared'));
const shared = process.env.STUDIO_SHARED_API;
if (!shared && !fs.existsSync(envFile)) throw new Error('請先設定本機或共用雲端資料庫');
const DB = shared ? null : openMySQL({ host: process.env.STUDIO_DB_HOST, port: Number(process.env.STUDIO_DB_PORT), user: process.env.STUDIO_DB_USER, password: process.env.STUDIO_DB_PASSWORD, database: process.env.STUDIO_DB_NAME });
if (DB) await DB.prepare('SELECT 1 AS ok FROM users LIMIT 1').all();
const port = Number(process.env.PORT || 4173), origin = 'http://127.0.0.1:' + port;
http.createServer(async (req, res) => {
  const host = req.headers.host;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host)) { res.writeHead(403).end('Local access only'); return; }
  const url = new URL(req.url, 'http://' + host);
  try {
    if (url.pathname.startsWith('/api/')) {
      const parts = []; let size = 0;
      for await (const part of req) { size += part.length; if (size > 100000) { res.writeHead(413).end(); return; } parts.push(part); }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Buffer.concat(parts) }) });
      const result = shared ? await proxySharedApi(request, shared, process.env.STUDIO_PROXY_KEY) : await handleApi(request, { DB });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer())); return;
    }
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    if (!['index.html','styles.css','core.js','app.js'].includes(relative)) { res.writeHead(404).end(); return; }
    let content = fs.readFileSync(path.join(root, 'web', relative), 'utf8');
    if (relative === 'index.html') content = content
      .replaceAll('資料庫版 · Cloudflare D1', shared ? '共用雲端資料庫 · MySQL' : '本機資料庫版 · MariaDB / MySQL')
      .replace('資料庫版 · 帳號與稿件跨裝置共用', shared ? '共用雲端資料庫 · 帳號與稿件跨裝置共用' : '本機資料庫版 · MariaDB / MySQL')
      .replace('註冊後可在其他裝置使用相同帳號登入', shared ? '註冊後可在其他裝置使用相同帳號登入' : '可在這台電腦的不同瀏覽器使用相同帳號登入');
    res.writeHead(200, { 'Content-Type': relative.endsWith('.css') ? 'text/css; charset=utf-8' : relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(content);
  } catch (error) { console.error('Local server error', error.message); res.writeHead(500).end('Server error'); }
}).listen(port, '127.0.0.1', () => console.log(`Local site: ${origin}\nDatabase mode: ${shared ? 'shared cloud MySQL via HTTPS' : 'local MariaDB'}`));
