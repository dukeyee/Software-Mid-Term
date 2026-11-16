const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../web/core.js');
const [a, b, editor] = Core.users;
const input = { category: '生活散文', title: '測試稿件', content: '這是一篇測試文章。' };
test('完整投稿流程：新增、修改、送出、退回、再送出、通過', () => {
  let rows = Core.transition([], a, 'create', input);
  const id = rows[0].id;
  assert.equal(rows[0].status, 'draft');
  rows = Core.transition(rows, a, 'update', { ...input, id, title: '更新標題' });
  assert.equal(rows[0].title, '更新標題');
  rows = Core.transition(rows, a, 'submit', { id });
  assert.equal(Core.visible(rows, editor).length, 1);
  rows = Core.transition(rows, editor, 'return', { id, reason: '請補充文章結論' });
  assert.equal(rows[0].status, 'draft');
  assert.equal(rows[0].returnReason, '請補充文章結論');
  assert.equal(Core.visible(rows, editor).length, 0);
  rows = Core.transition(rows, a, 'update', { ...input, id });
  rows = Core.transition(rows, a, 'submit', { id });
  rows = Core.transition(rows, editor, 'approve', { id });
  assert.equal(rows[0].status, 'approved');
  assert.equal(Core.visible(rows, editor).length, 0);
  assert.equal(Core.visible(rows, a).length, 1);
});
test('退回原因必填、限制長度，修改與重新送出仍保留編輯意見', () => {
  let rows = Core.transition([], a, 'create', input), id = rows[0].id;
  rows = Core.transition(rows, a, 'submit', { id });
  for (const reason of [undefined, '', '  ', '字'.repeat(1001)]) assert.throws(() => Core.transition(rows, editor, 'return', { id, reason }));
  rows = Core.transition(rows, editor, 'return', { id, reason: ' 請補充來源\n並調整結論 ' });
  assert.equal(Core.visible(rows, a)[0].returnReason, '請補充來源\n並調整結論');
  assert.equal(rows[0].returnedBy, editor.id);
  assert.ok(Core.valid(JSON.parse(JSON.stringify(rows))));
  rows = Core.transition(rows, a, 'update', { ...input, id });
  rows = Core.transition(rows, a, 'submit', { id });
  assert.equal(rows[0].returnReason, '請補充來源\n並調整結論');
  assert.throws(() => Core.transition(rows, a, 'return', { id, reason: '作者不能審核' }));
});
test('示範登入驗證三個帳號，拒絕錯誤帳號密碼', () => {
  for (const user of Core.users) assert.equal(Core.demoLogin(user.username, 'demo123').id, user.id);
  assert.throws(() => Core.demoLogin('unknown', 'demo123'));
  assert.throws(() => Core.demoLogin(a.username, 'wrong'));
});
test('作者只能操作自己的稿件，編輯不能新增或修改', () => {
  const rows = Core.transition([], a, 'create', input), id = rows[0].id;
  assert.equal(Core.visible(rows, b).length, 0);
  for (const command of ['update', 'delete', 'submit']) {
    assert.throws(() => Core.transition(rows, b, command, { ...input, id }));
    assert.throws(() => Core.transition(rows, editor, command, { ...input, id }));
  }
  assert.throws(() => Core.transition(rows, editor, 'create', input));
  assert.throws(() => Core.transition(rows, a, 'approve', { id }));
  assert.throws(() => Core.transition(rows, editor, 'approve', { id }));
});
test('審查中與已通過稿件不可被作者修改、刪除或再次送出', () => {
  let rows = Core.transition([], a, 'create', input), id = rows[0].id;
  rows = Core.transition(rows, a, 'submit', { id });
  for (const status of ['review', 'approved']) {
    for (const command of ['update', 'delete', 'submit']) assert.throws(() => Core.transition(rows, a, command, { ...input, id }));
    if (status === 'review') rows = Core.transition(rows, editor, 'approve', { id });
  }
  assert.throws(() => Core.transition(rows, editor, 'return', { id }));
});
test('刪除編輯中稿件且不修改傳入資料', () => {
  const rows = Core.transition([], a, 'create', input);
  assert.equal(Core.transition(rows, a, 'delete', { id: rows[0].id }).length, 0);
  assert.equal(rows.length, 1);
});
test('拒絕空白、未知類別、過長文字與未知身分', () => {
  for (const change of [{ title: '  ' }, { content: '\n ' }, { category: '未知' }, { title: '字'.repeat(101) }, { content: '字'.repeat(20001) }]) assert.throws(() => Core.transition([], a, 'create', { ...input, ...change }));
  assert.throws(() => Core.transition([], { id: 'unknown', role: 'author' }, 'create', input));
});
test('資料可序列化，空清單有效，損壞或重複資料被拒絕', () => {
  const rows = Core.seed();
  assert.ok(Core.valid(JSON.parse(JSON.stringify(rows))));
  assert.ok(Core.valid([]));
  assert.equal(Core.valid([...rows, rows[0]]), false);
  assert.equal(Core.valid([{ ...rows[0], status: 'other' }]), false);
  assert.equal(Core.valid([{ ...rows[0], title: ' ' }]), false);
  assert.equal(Core.valid(null), false);
});
