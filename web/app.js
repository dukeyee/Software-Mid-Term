(() => {
  'use strict';
  const Core = window.ReviewCore;
  const $ = selector => document.querySelector(selector);
  const KEY = 'manuscript-studio:v1';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let user = Core.users[0], filter = 'all', query = '', blocked = false, timer, pendingConfirm;
  const dialog = $('#article-dialog');
  const confirmDialog = $('#confirm-dialog');
  function notice(message) { $('#storage-notice').textContent = message; $('#storage-notice').hidden = false; }
  function read() {
    const saved = localStorage.getItem(KEY);
    if (saved === null) return null;
    const rows = JSON.parse(saved);
    if (!Core.valid(rows)) throw new Error('無效的稿件資料');
    return rows;
  }
  let rows;
  try {
    rows = read();
    if (rows === null) { rows = Core.seed(); localStorage.setItem(KEY, JSON.stringify(rows)); }
  } catch {
    rows = []; blocked = true;
    notice('無法讀取或儲存瀏覽器資料，為保留原有資料，已暫停新增與修改。請允許網站儲存資料；若問題持續，請先備份瀏覽器中的網站資料再處理。');
  }
  function toast(message, error = false) {
    clearTimeout(timer); const element = $('#toast');
    element.textContent = message; element.classList.toggle('error', error); element.hidden = false;
    timer = setTimeout(() => { element.hidden = true; }, 4500);
  }
  function commit(command, input, success) {
    try {
      if (blocked) throw new Error('目前無法儲存資料，請先處理頁面上方的提示。');
      // Re-read before every operation so an old view cannot overwrite a newer tab's work.
      const latest = read();
      if (latest === null) throw new Error('網站資料已變更，請重新整理頁面後再操作。');
      const next = Core.transition(latest, user, command, input);
      localStorage.setItem(KEY, JSON.stringify(next));
      rows = next; render(); toast(success); return true;
    } catch (error) { toast(error.message || '儲存失敗，請稍後再試。', true); return false; }
  }
  const badge = status => `<span class="status ${status}">${Core.statuses[status]}</span>`;
  const date = value => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const author = id => Core.users.find(item => item.id === id).name;
  function renderStats(items) {
    const counts = { all: items.length, draft: items.filter(x => x.status === 'draft').length, review: items.filter(x => x.status === 'review').length, approved: items.filter(x => x.status === 'approved').length };
    const data = user.role === 'author' ? [
      ['全部稿件', counts.all, '每一份創作的累積', '▤'], ['編輯中', counts.draft, '讓靈感繼續成形', '✎'], ['審查中', counts.review, '等待編輯的回應', '◷'], ['已通過', counts.approved, '被肯定的好作品', '✓']
    ] : [
      ['待審查稿件', counts.all, '等待你的專業回應', '▤'], ['投稿作者', new Set(items.map(x => x.authorId)).size, '來自不同的創作聲音', '✎'], ['投稿類別', new Set(items.map(x => x.category)).size, '探索多元的觀點', '◷'], ['今日待審稿件', items.filter(x => new Date(x.updatedAt).toDateString() === new Date().toDateString()).length, '今天送達的投稿', '✓']
    ];
    $('#stats').innerHTML = data.map(([label, count, note, symbol]) => `<div class="stat"><div class="stat-label">${label}<span class="stat-symbol" aria-hidden="true">${symbol}</span></div><strong class="stat-value">${count}<span class="sr-only">${label === '投稿作者' ? '位' : label === '投稿類別' ? '類' : '篇'}</span></strong><span class="stat-note">${note}</span></div>`).join('');
    const options = user.role === 'author' ? [['all', '全部稿件'], ['draft', '編輯中'], ['review', '審查中'], ['approved', '已通過']] : [['all', '待審查稿件']];
    $('#filters').innerHTML = options.map(([key, title]) => `<button class="tab" data-filter="${key}" aria-pressed="${filter === key}">${title}<span>${counts[key]}</span></button>`).join('');
  }
  function renderRows(items) {
    const term = query.trim().toLocaleLowerCase();
    const shown = items.filter(row => (filter === 'all' || row.status === filter) && (!term || `${row.title} ${row.category} ${user.role === 'editor' ? author(row.authorId) : ''}`.toLocaleLowerCase().includes(term))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    $('#rows').innerHTML = shown.map(row => `<tr>
      <td><button class="article-title" data-action="view" data-id="${escape(row.id)}">${escape(row.title)}</button><div class="article-meta">${escape(row.content.replace(/\s+/g, ' ').slice(0, 26))}…</div></td>
      <td class="category">${escape(row.category)}</td>${user.role === 'editor' ? `<td class="category">${escape(author(row.authorId))}</td>` : ''}
      <td>${badge(row.status)}</td><td class="date">${date(row.updatedAt)}</td>
      <td><div class="row-actions">${user.role === 'author' && row.status === 'draft' ? `<button class="text-button" data-action="edit" data-id="${escape(row.id)}">編輯</button><button class="text-button" data-action="submit" data-id="${escape(row.id)}">送出</button><button class="text-button muted" data-action="delete" data-id="${escape(row.id)}">刪除</button>` : `<button class="text-button" data-action="view" data-id="${escape(row.id)}">${user.role === 'editor' ? '審查 →' : '查看 →'}</button>`}</div></td></tr>`).join('');
    $('#empty').hidden = shown.length > 0;
    $('#empty-title').textContent = query || filter !== 'all' ? '沒有符合條件的稿件' : user.role === 'editor' ? '目前沒有待審查稿件' : '你的第一篇創作，從這裡開始';
    $('#empty-description').textContent = query || filter !== 'all' ? '試試其他關鍵字，或切換稿件狀態。' : user.role === 'editor' ? '作者送出投稿後，稿件就會出現在這裡。' : '新增一篇稿件，開始記錄你的想法。';
    $('#empty-new').hidden = user.role !== 'author' || !!query || filter !== 'all';
    $('#empty-new').disabled = blocked;
    $('#result-count').textContent = `顯示 ${shown.length} 篇，共 ${items.length} 篇稿件`;
  }
  function render() {
    const editing = user.role === 'author', label = editing ? '我的投稿' : '待審查稿件';
    $('#nav-label').textContent = $('#breadcrumb').textContent = label;
    $('#page-title').innerHTML = `${label}<span class="title-period">。</span>`;
    $('#eyebrow').textContent = editing ? 'YOUR WRITING, IN PROGRESS' : 'A FRESH PERSPECTIVE, EVERY STORY';
    $('#page-description').textContent = editing ? '好好寫作，讓每一個想法找到自己的位置。' : '細讀每一份創作，讓好的觀點被看見。';
    $('#list-heading').textContent = editing ? '稿件管理' : '審查工作台';
    $('#list-description').textContent = editing ? '每一次修改，都是離完成更近一步。' : '查看完整內容，選擇通過或退回給作者。';
    $('#workflow-note').textContent = editing ? '編輯中的稿件可隨時修改；送出後將交由編輯審查，退回後可再次編輯。' : '此處僅顯示審查中的稿件；通過或退回後，稿件會從待審查清單移除。';
    $('#avatar').textContent = user.role === 'editor' ? '報' : user.name.slice(-1);
    $('#new').hidden = !editing; $('#new').disabled = blocked;
    $('#author-heading').hidden = editing;
    $('#table-caption').textContent = editing ? '我的投稿清單' : '待審查稿件清單';
    $('#search').placeholder = editing ? '搜尋標題或類別…' : '搜尋標題、類別或作者…';
    const items = Core.visible(rows, user);
    $('#nav-count').textContent = items.length;
    $('#list-total').textContent = `${items.length} 篇稿件`;
    renderStats(items); renderRows(items);
  }
  function confirmAction(title, message, button, danger = false) {
    $('#confirm-title').textContent = title; $('#confirm-message').textContent = message;
    $('#confirm-ok').textContent = button; $('#confirm-ok').className = danger ? 'danger' : 'primary';
    confirmDialog.showModal(); $('#confirm-cancel').focus();
    return new Promise(resolve => { pendingConfirm = resolve; });
  }
  function resolveConfirm(value) { confirmDialog.close(); pendingConfirm?.(value); pendingConfirm = null; }
  $('#confirm-ok').addEventListener('click', () => resolveConfirm(true));
  $('#confirm-cancel').addEventListener('click', () => resolveConfirm(false));
  $('#confirm-close').addEventListener('click', () => resolveConfirm(false));
  confirmDialog.addEventListener('cancel', event => { event.preventDefault(); resolveConfirm(false); });
  let dirty = false;
  async function closeArticle() {
    if (dirty && !await confirmAction('放棄尚未儲存的修改？', '這次輸入的內容尚未儲存，關閉後將不會保留。', '放棄修改', true)) return;
    dirty = false; dialog.close();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeArticle(); });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  function head(title, eyebrow) { return `<div class="dialog-head"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-close aria-label="關閉稿件視窗">×</button></div>`; }
  function openEditor(row) {
    if (blocked) return toast('目前無法儲存資料。', true);
    if (user.role !== 'author' || row && (row.authorId !== user.id || row.status !== 'draft')) return toast('這篇稿件目前無法編輯。', true);
    dirty = false;
    $('#dialog-content').innerHTML = `${head(row ? '編輯投稿' : '寫下新的想法', 'MANUSCRIPT / DRAFT')}<form class="editor-form" id="editor-form"><div class="form-split"><label class="field"><span>稿件類別 <small>必填</small></span><select name="category" required><option value="">請選擇類別</option>${Core.categories.map(category => `<option ${row?.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label><label class="field"><span>稿件標題 <small>必填 · 最多 100 字</small></span><input name="title" maxlength="100" required placeholder="為這篇創作取個名字" value="${escape(row?.title || '')}"></label></div><label class="field"><span>文章內容 <small>必填</small></span><textarea name="content" required maxlength="20000" placeholder="你的故事，就從這裡開始…">${escape(row?.content || '')}</textarea></label><div class="word-count" id="word-count">${row?.content.length || 0} / 20,000 字</div><p class="form-error" id="form-error" role="alert" hidden></p><div class="dialog-actions"><span class="save-note">儲存後的狀態為「編輯中」</span><button type="button" class="secondary" data-close>取消</button><button type="submit" class="primary">儲存稿件</button></div></form>`;
    $('#editor-form').addEventListener('input', () => { dirty = true; $('#word-count').textContent = `${$('#editor-form textarea').value.length} / 20,000 字`; });
    $('#editor-form').addEventListener('submit', event => {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(event.currentTarget));
      if (!input.title.trim() || !input.content.trim()) { $('#form-error').hidden = false; $('#form-error').textContent = '標題與文章內容不能只填空白。'; return; }
      if (commit(row ? 'update' : 'create', { ...input, id: row?.id }, '稿件已儲存，可繼續修改或送出投稿。')) { dirty = false; dialog.close(); }
    });
    dialog.showModal();
  }
  function openArticle(row) {
    if (!Core.visible(rows, user).some(item => item.id === row.id)) return toast('無法查看這篇稿件。', true);
    dirty = false;
    $('#dialog-content').innerHTML = `${head(user.role === 'editor' ? '稿件審查' : '稿件內容', 'MANUSCRIPT / READING')}<article class="article-body">${badge(row.status)}<h3>${escape(row.title)}</h3><div class="article-details"><span>作者 ${escape(author(row.authorId))}</span><span>${escape(row.category)}</span><span>更新於 ${date(row.updatedAt)}</span><span>${row.content.length} 字</span></div><div class="article-content">${escape(row.content)}</div></article><div class="dialog-actions"><button class="secondary" data-close>關閉</button>${user.role === 'editor' ? `<button class="secondary" data-action="return" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>退回稿件</button><button class="primary" data-action="approve" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>通過審查</button>` : row.status === 'draft' ? `<button class="primary" data-action="edit" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>編輯稿件</button>` : ''}</div>`;
    dialog.showModal();
  }
  async function action(command, id) {
    const row = rows.find(item => item.id === id);
    if (!row) return toast('找不到這篇稿件。', true);
    if (command === 'view') return openArticle(row);
    if (command === 'edit') { dialog.close(); return openEditor(row); }
    const options = {
      submit: ['送出這篇投稿？', `「${row.title}」將進入審查中，送出後暫時無法修改。`, '確認送出', '稿件已送出，等待編輯審查。'],
      delete: ['刪除這篇稿件？', `「${row.title}」刪除後無法復原。`, '確認刪除', '稿件已刪除。'],
      approve: ['通過這篇稿件？', `「${row.title}」將標記為已通過，並從待審查清單移除。`, '確認通過', '稿件已通過審查。'],
      return: ['退回這篇稿件？', `「${row.title}」將回到編輯中，作者可修改後再次送出。`, '確認退回', '稿件已退回給作者。']
    };
    if (!options[command]) return;
    const [title, message, button, success] = options[command];
    if (await confirmAction(title, message, button, command === 'delete')) {
      if (commit(command, { id }, success)) { dirty = false; dialog.close(); }
    }
  }
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]'); if (close) return closeArticle();
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action, button.dataset.id);
  });
  $('#filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) { filter = button.dataset.filter; render(); $('#filters').querySelector(`[data-filter="${filter}"]`).focus(); }
  });
  $('#search').addEventListener('input', event => { query = event.target.value; renderRows(Core.visible(rows, user)); });
  $('#identity').addEventListener('change', event => {
    user = Core.users.find(item => item.id === event.target.value); filter = 'all'; query = ''; $('#search').value = ''; render();
    toast(`已切換為${user.name}（${user.role === 'author' ? '作者' : '編輯'}）。`);
  });
  $('#new').addEventListener('click', () => openEditor());
  $('#empty-new').addEventListener('click', () => openEditor());
  $('#workspace').addEventListener('click', () => { filter = 'all'; query = ''; $('#search').value = ''; render(); $('#main').scrollIntoView({ behavior: 'smooth' }); });
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try {
      const current = read(); if (current === null) throw new Error('missing'); rows = current; render();
      toast('另一個分頁已更新稿件；若正在編輯，請重新開啟以取得最新內容。');
    } catch { blocked = true; notice('瀏覽器資料已移除或格式有誤，請重新整理頁面後再操作。'); render(); }
  });
  render();
})();
