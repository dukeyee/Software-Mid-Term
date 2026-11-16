const { test } = require('node:test');
const assert = require('node:assert/strict');
const Auth = require('../web/auth.js');
const Core = require('../web/core.js');
const input = { name: '測試作者', username: 'new_author', password: 'TestPass123', confirmPassword: 'TestPass123' };
test('註冊帳號可序列化且能驗證密碼，不儲存明文', async () => {
  const account = await Auth.register({ ...input, username: ' NEW_AUTHOR ' }, []);
  assert.equal(account.username, 'new_author');
  assert.ok(Auth.valid(JSON.parse(JSON.stringify([account]))));
  assert.equal(JSON.stringify(account).includes(input.password), false);
  assert.ok(await Auth.verify(account, input.password));
  assert.equal(await Auth.verify(account, 'wrongpass'), false);
  assert.equal(await Auth.verify(null, input.password), false);
});
test('拒絕保留帳號、大小寫重複、無效帳號、短密碼和確認密碼不符', async () => {
  const account = await Auth.register(input, []);
  for (const change of [
    { name: '  ' }, { name: '字'.repeat(21) }, { username: 'EDITOR' },
    { username: 'NEW_AUTHOR' }, { username: '12abc' }, { username: 'ab' },
    { username: 'a b c' }, { password: 'short' }, { confirmPassword: 'otherpass' }
  ]) await assert.rejects(Auth.register({ ...input, ...change }, [account]));
  assert.equal(Auth.valid([{ ...account, passwordHash: 'invalid' }]), false);
  assert.equal(Auth.valid([account, account]), false);
});
test('相同密碼使用不同隨機鹽值', async () => {
  const a = await Auth.register(input, []), b = await Auth.register({ ...input, username: 'another_author' }, []);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.passwordHash, b.passwordHash);
});
test('新作者可以投稿，編輯可審查，其他作者不能查看', async () => {
  const account = await Auth.register(input, []);
  Core.loadAuthors([account]);
  const user = Core.users.find(item => item.id === account.id);
  assert.equal(user.role, 'author');
  assert.throws(() => Core.demoLogin(account.username, 'demo123'));
  let rows = Core.transition([], user, 'create', { category: '其他', title: '新作者的投稿', content: '文章內容' });
  assert.equal(Core.visible(rows, Core.demoUsers[0]).length, 0);
  rows = Core.transition(rows, user, 'submit', { id: rows[0].id });
  const editor = Core.demoUsers.find(item => item.role === 'editor');
  assert.equal(Core.visible(rows, editor).length, 1);
  rows = Core.transition(rows, editor, 'return', { id: rows[0].id, reason: '請補充結論' });
  assert.equal(Core.visible(rows, user)[0].returnReason, '請補充結論');
  assert.ok(Core.valid(rows));
  Core.loadAuthors([]);
});
