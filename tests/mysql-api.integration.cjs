const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
test('本機 MariaDB：註冊、登入、投稿、退回、資料隔離與刪除', async () => {
  process.loadEnvFile(path.join(__dirname, '../.env.local'));
  const { openMySQL } = await import('../server/mysql-adapter.mjs');
  const { handleApi } = await import('../server/api.mjs');
  const DB = openMySQL({ host: process.env.STUDIO_DB_HOST, port: Number(process.env.STUDIO_DB_PORT), user: process.env.STUDIO_DB_USER, password: process.env.STUDIO_DB_PASSWORD, database: process.env.STUDIO_DB_NAME });
  const origin = 'http://127.0.0.1:4173';
  const username = 'qa_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const signup = { username, name: '本機資料庫測試作者', password: 'LocalTest1234', confirmPassword: 'LocalTest1234' };
  const cookies = [];
  async function call(route, data, cookie, source = origin) {
    const response = await handleApi(new Request(origin + route, { method: data === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { Origin: source, 'Content-Type': 'application/json' }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), { DB });
    const result = { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    if (result.cookie && /^studio_session=[a-f0-9]{64}$/.test(result.cookie)) cookies.push(result.cookie);
    return result;
  }
  let userId;
  try {
    assert.equal((await call('/api/health')).status, 200);
    assert.equal((await call('/api/session')).status, 401);
    const registration = await call('/api/register', signup);
    assert.equal(registration.status, 201); userId = registration.data.user.id;
    assert.equal((await call('/api/register', signup)).status, 409);
    assert.equal((await call('/api/login', { ...signup, password: 'wrong' })).status, 401);
    const author = (await call('/api/login', signup)).cookie;
    assert.ok(author);
    assert.equal((await call('/api/manuscripts', { category: '其他', title: '阻止跨站', content: '內容' }, author, 'http://evil.test')).status, 403);
    let row = (await call('/api/manuscripts', { category: '其他', title: '本機 MySQL 測試', content: '資料寫入本機資料庫' }, author)).data.rows[0];
    assert.ok(row);
    const second = await call('/api/login', signup);
    assert.equal(second.data.rows[0].id, row.id);
    const editor = (await call('/api/login', { username: 'editor', password: 'demo123' })).cookie;
    assert.ok(editor);
    row = (await call(`/api/manuscripts/${row.id}/submit`, { version: row.version }, author)).data.rows[0];
    assert.equal(row.status, 'review');
    assert.equal((await call(`/api/manuscripts/${row.id}/approve`, { version: row.version }, author)).status, 403);
    assert.equal((await call(`/api/manuscripts/${row.id}/return`, { version: row.version, reason: '請補充資料來源' }, editor)).status, 200);
    row = (await call('/api/session', undefined, second.cookie)).data.rows[0];
    assert.equal(row.returnReason, '請補充資料來源');
    assert.equal(row.status, 'draft');
    assert.equal((await call(`/api/manuscripts/${row.id}/delete`, { version: row.version }, author)).status, 200);
    assert.equal((await call('/api/session', undefined, author)).data.rows.length, 0);
  } finally {
    for (const cookie of [...cookies]) await call('/api/logout', {}, cookie);
    if (userId) {
      await DB.prepare('DELETE FROM manuscripts WHERE author_id=?').bind(userId).run();
      await DB.prepare('DELETE FROM users WHERE id=? AND username=?').bind(userId, username).run();
    }
    await DB.close();
  }
});
