const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const origin = 'https://studio.test';
async function fixture(filename) {
  const { openDatabase } = await import('../server/sqlite-adapter.mjs');
  const { handleApi } = await import('../server/api.mjs');
  const db = openDatabase(filename);
  for (const name of fs.readdirSync(path.join(__dirname, '../drizzle')).filter(x => x.endsWith('.sql')).sort()) db.sqlite.exec(fs.readFileSync(path.join(__dirname, '../drizzle', name), 'utf8'));
  async function call(route, data, cookie, requestOrigin = origin) {
    const response = await handleApi(new Request(origin + route, { method: data === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json', Origin: requestOrigin }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), { DB: db, BOOTSTRAP_KEY: 'fixture-secret' });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  assert.equal((await call('/api/setup', { setupKey: 'fixture-secret' })).status, 200);
  return { db, call };
}
test('真實 SQL：註冊、跨工作階段登入、投稿、權限、退回原因及通過', async () => {
  const { db, call } = await fixture(':memory:');
  try {
    assert.equal((await call('/api/session')).status, 401);
    const signup = { username: 'database_author', name: '資料庫作者', password: 'AuthorPass123', confirmPassword: 'AuthorPass123' };
    assert.equal((await call('/api/register', signup)).status, 201);
    assert.equal((await call('/api/register', signup)).status, 409);
    assert.equal((await call('/api/register', { ...signup, username: 'editor' })).status, 409);
    const login = await call('/api/login', signup);
    assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.match(login.headers.get('set-cookie'), /Secure/);
    const a = login.cookie;
    assert.equal((await call('/api/login', { ...signup, password: 'wrong' })).status, 401);
    assert.equal((await call('/api/manuscripts', { category: '其他', title: '共享稿件', content: '資料庫內容' }, a, 'https://evil.test')).status, 403);
    let created = await call('/api/manuscripts', { category: '其他', title: '共享稿件', content: '資料庫內容' }, a);
    assert.equal(created.status, 201); let row = created.data.rows[0];
    assert.equal((await call('/api/session', undefined, (await call('/api/login', signup)).cookie)).data.rows[0].id, row.id);
    const b = (await call('/api/login', { username: 'nailong', password: 'demo123' })).cookie;
    assert.equal((await call('/api/session', undefined, b)).data.rows.length, 0);
    assert.equal((await call(`/api/manuscripts/${row.id}/delete`, { version: row.version }, b)).status, 404);
    const e = (await call('/api/login', { username: 'editor', password: 'demo123' })).cookie;
    assert.equal((await call('/api/manuscripts', { category: '其他', title: '編輯不可新增', content: '內容' }, e)).status, 403);
    const stale = row.version;
    row = (await call(`/api/manuscripts/${row.id}/submit`, { version: row.version }, a)).data.rows[0];
    assert.equal((await call(`/api/manuscripts/${row.id}/update`, { version: stale, title: '覆寫' }, a)).status, 409);
    assert.equal((await call(`/api/manuscripts/${row.id}/return`, { version: row.version, reason: '作者不可審查' }, a)).status, 403);
    assert.equal((await call(`/api/manuscripts/${row.id}/return`, { version: row.version, reason: ' ' }, e)).status, 400);
    assert.equal((await call(`/api/manuscripts/${row.id}/return`, { version: row.version, reason: '請補充來源' }, e)).status, 200);
    row = (await call('/api/session', undefined, a)).data.rows[0];
    assert.equal(row.returnReason, '請補充來源'); assert.equal(row.status, 'draft');
    row = (await call(`/api/manuscripts/${row.id}/submit`, { version: row.version }, a)).data.rows[0];
    assert.equal((await call(`/api/manuscripts/${row.id}/approve`, { version: row.version }, e)).status, 200);
    row = (await call('/api/session', undefined, a)).data.rows[0];
    assert.equal(row.status, 'approved'); assert.equal(row.returnReason, '請補充來源');
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 2);
    assert.equal((await call('/api/logout', {}, a)).status, 200);
    assert.equal((await call('/api/session', undefined, a)).status, 401);
    const stored = db.sqlite.prepare('SELECT password_hash FROM users WHERE username=?').get(signup.username);
    assert.notEqual(stored.password_hash, signup.password);
    assert.equal((await call('/api/login', { username: "' OR 1=1 --", password: 'demo123' })).status, 401);
  } finally { db.close(); }
});
test('資料寫入 SQLite 檔案，關閉並重開資料庫後仍存在', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-db-test-'));
  const filename = path.join(directory, 'test.sqlite');
  const { db, call } = await fixture(filename);
  await call('/api/register', { username: 'persistent_author', name: '持久化作者', password: 'Persistence123', confirmPassword: 'Persistence123' });
  db.close();
  const { openDatabase } = await import('../server/sqlite-adapter.mjs');
  const reopened = openDatabase(filename);
  try { assert.equal(reopened.sqlite.prepare('SELECT name FROM users WHERE username=?').get('persistent_author').name, '持久化作者'); }
  finally {
    reopened.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('studio-db-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
