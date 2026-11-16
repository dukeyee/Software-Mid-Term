const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('本機與雲端共用 MySQL：跨入口投稿、退回與資料隔離', async () => {
  process.loadEnvFile(path.join(__dirname, '../.env.shared'));
  const cloud = new URL(process.env.STUDIO_SHARED_API).origin;
  const local = 'http://127.0.0.1:4173';
  const sessions = [];
  const call = async (origin, route, input, cookie, source = origin) => {
    const r = await fetch(origin + route, { method: input === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(input === undefined ? {} : { Origin: source, 'Content-Type': 'application/json' }) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    const token = r.headers.get('set-cookie')?.split(';')[0];
    if (token && /^studio_session=[a-f0-9]{64}$/.test(token)) sessions.push({ origin, token });
    return { status: r.status, data, cookie: token };
  };
  let article;
  let author;
  try {
    author = await call(local, '/api/login', { username: 'naiwa', password: 'demo123' });
    assert.equal(author.status, 200);
    const onlineAuthor = await call(cloud, '/api/login', { username: 'naiwa', password: 'demo123' });
    const editor = await call(cloud, '/api/login', { username: 'editor', password: 'demo123' });
    assert.equal(onlineAuthor.status, 200);
    assert.equal(editor.status, 200);
    const title = '共用資料庫驗證 ' + crypto.randomUUID();
    const created = await call(local, '/api/manuscripts', { category: '其他', title, content: '此稿件只供跨入口整合測試，結束後清理' }, author.cookie);
    article = created.data.rows.find(row => row.title === title);
    assert.equal(created.status, 201);
    assert.ok(article);
    const online = await call(cloud, '/api/session', undefined, onlineAuthor.cookie);
    assert.ok(online.data.rows.some(row => row.id === article.id));
    assert.equal((await call(local, `/api/manuscripts/${article.id}/submit`, { version: article.version }, author.cookie, 'https://evil.test')).status, 403);
    const submitted = await call(local, `/api/manuscripts/${article.id}/submit`, { version: article.version }, author.cookie);
    assert.equal(submitted.status, 200);
    article = submitted.data.rows.find(row => row.id === article.id);
    assert.equal((await call(cloud, `/api/manuscripts/${article.id}/return`, { version: article.version, reason: '跨入口退回原因驗證' }, editor.cookie)).status, 200);
    const refreshed = await call(local, '/api/session', undefined, author.cookie);
    article = refreshed.data.rows.find(row => row.id === article.id);
    assert.equal(article.status, 'draft');
    assert.equal(article.returnReason, '跨入口退回原因驗證');
    const forged = await fetch(cloud + '/api/health', { headers: { 'X-Studio-Proxy-Origin': local, 'X-Studio-Proxy-Key': 'invalid' } });
    assert.equal(forged.status, 403);
  } finally {
    if (article && author?.cookie) {
      const latest = await call(local, '/api/session', undefined, author.cookie);
      const row = latest.data.rows?.find(row => row.id === article.id);
      if (row?.status === 'draft') assert.equal((await call(local, `/api/manuscripts/${row.id}/delete`, { version: row.version }, author.cookie)).status, 200);
    }
    for (const { origin, token } of sessions) await call(origin, '/api/logout', {}, token);
  }
});
