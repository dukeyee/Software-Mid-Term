(function (root) {
  'use strict';
  const users = Object.freeze([
    { id: 'author-1', name: '奶龍', role: 'author' },
    { id: 'author-2', name: '奶蛙', role: 'author' },
    { id: 'editor-1', name: '自由時報', role: 'editor' }
  ]);
  const categories = Object.freeze(['生活散文', '校園觀察', '科技新知', '文化評論', '其他']);
  const statuses = Object.freeze({ draft: '編輯中', review: '審查中', approved: '已通過' });
  function actor(user) {
    const found = users.find(item => item.id === user?.id && item.role === user.role);
    if (!found) throw new Error('請選擇有效的示範身分');
    return found;
  }
  function fields(input) {
    const value = Object.fromEntries(['category', 'title', 'content'].map(k => [k, String(input[k] ?? '').trim()]));
    if (!categories.includes(value.category)) throw new Error('請選擇稿件類別');
    if (!value.title || !value.content) throw new Error('標題與文章內容不能只填空白');
    if (value.title.length > 100 || value.content.length > 20000) throw new Error('標題限 100 字，文章內容限 20,000 字');
    return value;
  }
  function visible(rows, user) {
    const current = actor(user);
    return rows.filter(row => current.role === 'editor' ? row.status === 'review' : row.authorId === current.id);
  }
  function transition(rows, user, command, input = {}) {
    const current = actor(user);
    const now = new Date().toISOString();
    if (command === 'create') {
      if (current.role !== 'author') throw new Error('只有作者可以新增稿件');
      return [...rows, { id: root.crypto.randomUUID(), authorId: current.id, ...fields(input), status: 'draft', createdAt: now, updatedAt: now }];
    }
    const row = rows.find(item => item.id === input.id);
    if (!row) throw new Error('找不到這篇稿件，請重新開啟清單');
    if (['update', 'delete', 'submit'].includes(command)) {
      if (current.role !== 'author' || row.authorId !== current.id) throw new Error('只能操作自己的稿件');
      if (row.status !== 'draft') throw new Error('只有編輯中稿件可以執行此操作');
      if (command === 'delete') return rows.filter(item => item.id !== row.id);
      const changes = command === 'update' ? fields(input) : { ...fields(row), status: 'review' };
      return rows.map(item => item.id === row.id ? { ...item, ...changes, updatedAt: now } : item);
    }
    if (['approve', 'return'].includes(command)) {
      if (current.role !== 'editor' || row.status !== 'review') throw new Error('編輯只能審查審查中的稿件');
      return rows.map(item => item.id === row.id ? { ...item, status: command === 'approve' ? 'approved' : 'draft', updatedAt: now } : item);
    }
    throw new Error('不支援的操作');
  }
  function seed() {
    const day = (days) => new Date(Date.now() - days * 86400000).toISOString();
    return [
      { id: 'sample-1', authorId: 'author-1', category: '生活散文', title: '在城市的縫隙裡，留一點時間給自己', content: '每天的行程總被排得很滿，直到某個午後，我決定提早一站下車\n\n巷口的樹影、老店傳來的招呼聲，讓原本只是通勤的路，成為一段重新認識生活的旅程\n\n也許留白不是浪費，而是讓我們有機會聽見自己的聲音', status: 'draft', createdAt: day(2), updatedAt: day(0) },
      { id: 'sample-2', authorId: 'author-1', category: '校園觀察', title: '圖書館的最後一盞燈', content: '晚上九點，圖書館的走廊漸漸安靜\n\n有人收起筆電，有人仍埋首書頁這些平凡的片刻，拼成了我們共同的校園記憶\n\n我想記錄的不只是讀書的地方，更是每個努力生活的人', status: 'review', createdAt: day(5), updatedAt: day(1) },
      { id: 'sample-3', authorId: 'author-1', category: '文化評論', title: '一間獨立書店，與一座城市的對話', content: '書店的價值，有時不只在架上的書\n\n每一場小型講座、每一次陌生人的交談，都讓這個空間與城市產生新的連結當我們走進書店，也在練習理解不同的生活', status: 'approved', createdAt: day(8), updatedAt: day(3) },
      { id: 'sample-4', authorId: 'author-2', category: '科技新知', title: '當科技走進日常：從一個小習慣開始', content: '我試著記錄自己一週的數位生活，發現許多工具已悄悄融入日常\n\n比起追逐新功能，我更在意這些工具是否真的讓生活變得從容這篇文章分享我的觀察與使用心得', status: 'review', createdAt: day(3), updatedAt: day(1) },
      { id: 'sample-5', authorId: 'author-2', category: '生活散文', title: '週末市場的聲音', content: '清晨的市場有自己的節奏蔬果的顏色和熟悉的叫賣聲，組成了週末的開場', status: 'draft', createdAt: day(1), updatedAt: day(1) }
    ];
  }
  function valid(rows) {
    return Array.isArray(rows) && new Set(rows.map(x => x?.id)).size === rows.length && rows.every(row =>
      row && typeof row.id === 'string' && users.some(u => u.id === row.authorId && u.role === 'author') &&
      Object.hasOwn(statuses, row.status) && categories.includes(row.category) &&
      typeof row.title === 'string' && row.title.trim().length > 0 && row.title.length <= 100 &&
      typeof row.content === 'string' && row.content.trim().length > 0 && row.content.length <= 20000 &&
      Number.isFinite(Date.parse(row.createdAt)) && Number.isFinite(Date.parse(row.updatedAt)));
  }
  const api = { users, categories, statuses, visible, transition, seed, valid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReviewCore = api;
})(globalThis);
