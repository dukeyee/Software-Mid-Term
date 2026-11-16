const categories = ['生活散文', '校園觀察', '科技新知', '文化評論', '其他'];
const iterations = 100000;
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = Uint8Array.from(salt.match(/../g), pair => parseInt(pair, 16));
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes, iterations, hash: 'SHA-256' }, key, 256)));
}
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function check(condition, status, message) { if (!condition) throw new HttpError(status, message); }
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const publicUser = row => ({ id: row.id, name: row.name, username: row.username, role: row.role });
const cookie = (request, token, maxAge = 604800) => `studio_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
async function body(request) {
  check(Number(request.headers.get('content-length') || 0) <= 100000, 413, '資料過大');
  const text = await request.text(); check(text.length <= 100000, 413, '資料過大');
  try { const value = JSON.parse(text); check(value && typeof value === 'object' && !Array.isArray(value), 400, '請提供有效資料'); return value; }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, '資料格式錯誤'); }
}
function articleFields(input) {
  const data = Object.fromEntries(['category', 'title', 'content'].map(key => [key, String(input[key] ?? '').trim()]));
  check(categories.includes(data.category), 400, '請選擇稿件類別');
  check(data.title.length > 0 && data.title.length <= 100 && data.content.length > 0 && data.content.length <= 20000, 400, '標題限 1–100 字，內容限 1–20,000 字');
  return data;
}
async function session(request, db) {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token), Date.now()).first();
}
async function snapshot(db, user) {
  const query = `SELECT m.*, u.name AS author_name, r.reason AS return_reason, r.editor_id AS returned_by, r.created_at AS returned_at
    FROM manuscripts m JOIN users u ON u.id=m.author_id
    LEFT JOIN reviews r ON r.id=(SELECT rr.id FROM reviews rr WHERE rr.manuscript_id=m.id AND rr.action='return' ORDER BY rr.manuscript_version DESC LIMIT 1)
    WHERE ${user.role === 'editor' ? "m.status='review'" : 'm.author_id=?'} ORDER BY m.updated_at DESC`;
  const statement = db.prepare(query);
  const result = await (user.role === 'editor' ? statement : statement.bind(user.id)).all();
  const users = user.role === 'editor' ? (await db.prepare('SELECT id,username,name,role FROM users').all()).results : [publicUser(user), ...(await db.prepare("SELECT id,username,name,role FROM users WHERE role='editor'").all()).results];
  return { user: publicUser(user), users, rows: result.results.map(row => ({
    id: row.id, authorId: row.author_id, category: row.category, title: row.title, content: row.content,
    status: row.status, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
    ...(row.return_reason ? { returnReason: row.return_reason, returnedBy: row.returned_by, returnedAt: row.returned_at } : {})
  })) };
}
export async function handleApi(request, env) {
  try {
    const url = new URL(request.url), db = env.DB;
    check(db, 503, '資料庫尚未連接');
    if (!['GET', 'HEAD'].includes(request.method)) {
      check(request.headers.get('Origin') === url.origin, 403, '請從本站操作');
      check(request.headers.get('Content-Type')?.startsWith('application/json'), 415, '請使用 JSON 資料');
    }
    if (url.pathname === '/api/setup' && request.method === 'POST') {
      const input = await body(request);
      check(env.BOOTSTRAP_KEY && input.setupKey === env.BOOTSTRAP_KEY, 403, '無權執行初始化');
      const now = new Date().toISOString();
      for (const demo of [
        { id: 'author-1', username: 'nailong', name: '奶龍', role: 'author' },
        { id: 'author-2', username: 'naiwa', name: '奶蛙', role: 'author' },
        { id: 'editor-1', username: 'editor', name: '自由時報', role: 'editor' }
      ]) {
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        await db.prepare('INSERT OR IGNORE INTO users (id,username,name,role,password_hash,salt,iterations,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(demo.id, demo.username, demo.name, demo.role, await passwordHash('demo123', salt), salt, iterations, now).run();
      }
      const count = await db.prepare('SELECT COUNT(*) AS total FROM manuscripts').first();
      if (count.total === 0 && Array.isArray(input.seedRows)) {
        const statements = input.seedRows.slice(0, 10).map(row => {
          const data = articleFields(row);
          check(['author-1', 'author-2'].includes(row.authorId) && ['draft', 'review', 'approved'].includes(row.status), 400, '示範資料格式錯誤');
          return db.prepare('INSERT OR IGNORE INTO manuscripts (id,author_id,category,title,content,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)').bind(String(row.id), row.authorId, data.category, data.title, data.content, row.status, now, now);
        });
        if (statements.length) await db.batch(statements);
      }
      return json({ ok: true });
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      await db.prepare('SELECT 1 AS ok FROM users LIMIT 1').all();
      return json({ ok: true, database: 'Cloudflare D1 / SQLite' });
    }
    if (url.pathname === '/api/register' && request.method === 'POST') {
      const input = await body(request), name = String(input.name ?? '').trim(), username = String(input.username ?? '').trim().toLowerCase(), password = String(input.password ?? '');
      check(name.length > 0 && name.length <= 20, 400, '名稱需為 1–20 字');
      check(/^[a-z][a-z0-9_]{2,23}$/.test(username), 400, '帳號需為 3–24 個英文字母、數字或底線，並以英文字母開頭');
      check(password.length >= 8 && password.length <= 128 && password.trim(), 400, '密碼需為 8–128 個字元');
      check(password === input.confirmPassword, 400, '兩次輸入的密碼不一致');
      check(!['nailong', 'naiwa', 'editor'].includes(username), 409, '這個帳號已有人使用');
      check(!await db.prepare('SELECT id FROM users WHERE username=?').bind(username).first(), 409, '這個帳號已有人使用');
      const id = crypto.randomUUID(), salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      try { await db.prepare("INSERT INTO users (id,username,name,role,password_hash,salt,iterations,created_at) VALUES (?,?,?,'author',?,?,?,?)").bind(id, username, name, await passwordHash(password, salt), salt, iterations, new Date().toISOString()).run(); }
      catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, '這個帳號已有人使用'); throw error; }
      return json({ user: { id, username, name, role: 'author' } }, 201);
    }
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const input = await body(request), username = String(input.username ?? '').trim().toLowerCase(), password = String(input.password ?? '');
      check(username.length <= 24 && password.length <= 128, 400, '帳號或密碼不正確');
      const attemptKey = await hash(`${request.headers.get('CF-Connecting-IP') || 'local'}:${username}`), now = Date.now();
      const attempt = await db.prepare('SELECT attempts,window_start FROM login_attempts WHERE key=?').bind(attemptKey).first();
      check(!attempt || now - attempt.window_start > 900000 || attempt.attempts < 15, 429, '嘗試次數過多，請 15 分鐘後再試');
      const found = await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
      const salt = found?.salt || '00000000000000000000000000000000';
      const derived = await passwordHash(password, salt);
      if (!found || derived !== found.password_hash) {
        await db.prepare('INSERT INTO login_attempts (key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ?-window_start>900000 THEN 1 ELSE attempts+1 END,window_start=CASE WHEN ?-window_start>900000 THEN ? ELSE window_start END').bind(attemptKey, now, now, now, now).run();
        throw new HttpError(401, '帳號或密碼不正確，請重新輸入');
      }
      const token = random();
      await db.batch([
        db.prepare('DELETE FROM login_attempts WHERE key=?').bind(attemptKey),
        db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),
        db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token), found.id, now + 604800000)
      ]);
      return json(await snapshot(db, found), 200, { 'Set-Cookie': cookie(request, token) });
    }
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    }
    const user = await session(request, db);
    check(user, 401, '請先登入');
    if (url.pathname === '/api/session' && request.method === 'GET') return json(await snapshot(db, user));
    if (url.pathname === '/api/manuscripts' && request.method === 'POST') {
      check(user.role === 'author', 403, '只有作者可以新增稿件');
      const data = articleFields(await body(request)), now = new Date().toISOString();
      await db.prepare("INSERT INTO manuscripts (id,author_id,category,title,content,status,version,created_at,updated_at) VALUES (?,?,?,?,?,'draft',1,?,?)").bind(crypto.randomUUID(), user.id, data.category, data.title, data.content, now, now).run();
      return json(await snapshot(db, user), 201);
    }
    const match = url.pathname.match(/^\/api\/manuscripts\/([a-zA-Z0-9-]+)\/(update|delete|submit|return|approve)$/);
    if (match && request.method === 'POST') {
      const [, id, command] = match, input = await body(request);
      const row = await db.prepare('SELECT * FROM manuscripts WHERE id=?').bind(id).first();
      check(row && (user.role === 'editor' || row.author_id === user.id), 404, '找不到這篇稿件');
      check(Number.isSafeInteger(input.version) && input.version === row.version, 409, '稿件已更新，請重新載入後再操作');
      const now = new Date().toISOString();
      let statement;
      if (['update', 'delete', 'submit'].includes(command)) {
        check(user.role === 'author' && row.author_id === user.id, 403, '只能操作自己的稿件');
        check(row.status === 'draft', 409, '只有編輯中的稿件可以操作');
        if (command === 'delete') statement = db.prepare("DELETE FROM manuscripts WHERE id=? AND version=? AND status='draft' AND author_id=?").bind(id, row.version, user.id);
        else if (command === 'submit') statement = db.prepare("UPDATE manuscripts SET status='review',version=version+1,updated_at=? WHERE id=? AND version=? AND status='draft' AND author_id=?").bind(now, id, row.version, user.id);
        else {
          const data = articleFields(input);
          statement = db.prepare("UPDATE manuscripts SET category=?,title=?,content=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status='draft' AND author_id=?").bind(data.category, data.title, data.content, now, id, row.version, user.id);
        }
        // D1 includes cascading review deletions in its changed-row count.
        const result = await statement.run(); check(result.meta.changes > 0, 409, '稿件已更新，請重新載入');
      } else {
        check(user.role === 'editor', 403, '只有編輯可以審查');
        check(row.status === 'review', 409, '只能審查審查中的稿件');
        const reason = String(input.reason ?? '').trim();
        check(command !== 'return' || reason.length > 0 && reason.length <= 1000, 400, '請填寫退回原因，最多 1,000 字');
        const reviewId = crypto.randomUUID();
        // The conditional INSERT and UPDATE run atomically in D1 batch.
        const results = await db.batch([
          db.prepare("INSERT INTO reviews (id,manuscript_id,editor_id,action,reason,manuscript_version,created_at) SELECT ?,id,?,?,?,?,? FROM manuscripts WHERE id=? AND version=? AND status='review'").bind(reviewId, user.id, command, command === 'return' ? reason : null, row.version, now, id, row.version),
          db.prepare("UPDATE manuscripts SET status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status='review'").bind(command === 'return' ? 'draft' : 'approved', now, id, row.version)
        ]);
        check(results[1].meta.changes === 1, 409, '稿件已更新，請重新載入');
      }
      return json(await snapshot(db, user));
    }
    throw new HttpError(404, '找不到此操作');
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('API failure', error.message);
    return json({ error: error instanceof HttpError ? error.message : '伺服器暫時無法處理，請稍後再試' }, error.status || 500);
  }
}
export { passwordHash };
