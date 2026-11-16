import mysql from 'mysql2/promise';
import { handleApi } from './api.mjs';
import { openMySQL } from './mysql-adapter.mjs';

export async function createCloudApp(env, assets, schema) {
  const config = { host: env.STUDIO_DB_HOST, port: Number(env.STUDIO_DB_PORT || 3306), database: env.STUDIO_DB_NAME, user: env.STUDIO_DB_USER, password: env.STUDIO_DB_PASSWORD };
  // Administrative credentials are used only during the explicitly enabled first setup
  if (env.STUDIO_INITIALIZE === '1') {
    const admin = await mysql.createConnection({ ...config, user: env.STUDIO_ADMIN_USER, password: env.STUDIO_ADMIN_PASSWORD });
    try {
      for (const sql of schema.split(/;\s*(?:\r?\n|$)/).map(value => value.trim()).filter(Boolean)) await admin.query(sql);
      if (!/^[a-zA-Z0-9_]+$/.test(config.database)) throw new Error('Invalid database name');
      for (const [user, password, grants] of [[config.user, config.password, 'SELECT,INSERT,UPDATE,DELETE'], [env.STUDIO_VIEWER_USER, env.STUDIO_VIEWER_PASSWORD, 'SELECT']]) {
        if (!user || !password) throw new Error('Missing scoped database credentials');
        await admin.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [user, '%', password]);
        await admin.query(`GRANT ${grants} ON \`${config.database}\`.* TO ?@?`, [user, '%']);
      }
      if (env.STUDIO_INITIAL_DATA) {
        const initial = JSON.parse(Buffer.from(env.STUDIO_INITIAL_DATA, 'base64').toString('utf8'));
        const [markers] = await admin.execute("SELECT value FROM studio_meta WHERE name='shared_import'");
        if (!markers.length) {
          await admin.beginTransaction();
          try {
            const [existing] = await admin.query('SELECT (SELECT COUNT(*) FROM users)+(SELECT COUNT(*) FROM manuscripts)+(SELECT COUNT(*) FROM reviews) AS count');
            if (Number(existing[0].count) !== 0) throw new Error('Shared database is not empty; import refused');
            const columns = { users: ['id','username','name','role','password_hash','salt','iterations','created_at'], manuscripts: ['id','author_id','category','title','content','status','version','created_at','updated_at'], reviews: ['id','manuscript_id','editor_id','action','reason','manuscript_version','created_at'] };
            for (const [table, names] of Object.entries(columns)) for (const row of initial[table]) await admin.execute(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`, names.map(name => row[name] ?? null));
            await admin.execute("INSERT INTO studio_meta (name,value) VALUES ('shared_import',?)", [new Date().toISOString()]);
            await admin.commit();
          } catch (error) { await admin.rollback(); throw error; }
        }
      }
    } finally { await admin.end(); }
  }
  const DB = openMySQL(config);
  DB.label = '共用雲端 MySQL';
  await DB.prepare('SELECT 1 AS ok FROM users LIMIT 1').all();
  const proxyOrigins = new Set(['http://127.0.0.1:4173', 'http://localhost:4173']);
  return {
    DB,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        let origin = env.STUDIO_PUBLIC_ORIGIN;
        const proxyOrigin = request.headers.get('X-Studio-Proxy-Origin');
        if (proxyOrigin) {
          if (!env.STUDIO_PROXY_KEY || request.headers.get('X-Studio-Proxy-Key') !== env.STUDIO_PROXY_KEY || !proxyOrigins.has(proxyOrigin)) return new Response('Forbidden', { status: 403 });
          origin = proxyOrigin;
        }
        if (!origin) return new Response('Website origin is not configured', { status: 503 });
        const canonical = new URL(url.pathname + url.search, origin);
        return handleApi(new Request(canonical, request), { DB });
      }
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!Object.hasOwn(assets, name)) return new Response('Not found', { status: 404 });
      let content = assets[name];
      if (name === 'index.html') content = content.replaceAll('資料庫版 · Cloudflare D1', '共用雲端資料庫 · MySQL');
      return new Response(content, { headers: { 'Content-Type': name.endsWith('.css') ? 'text/css; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
    }
  };
}
