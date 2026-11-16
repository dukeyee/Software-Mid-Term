(() => {
  'use strict';
  if (location.hostname.endsWith('github.io')) { location.replace('https://dukeyee-submission-review.familiarboot4.chatgpt.site/'); return; }
  const Core = window.ReviewCore;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let user = null, rows = [], filter = 'all', query = '', blocked = false, timer, pendingConfirm;
  const dialog = $('#article-dialog'), confirmDialog = $('#confirm-dialog');
  async function api(path, payload) {
    const response = await fetch(path, { method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: payload === undefined ? {} : { 'Content-Type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    let data; try { data = await response.json(); } catch { throw new Error('無法連接資料庫服務，請稍後再試'); }
    if (!response.ok) { const error = new Error(data.error || '操作失敗'); error.status = response.status; throw error; }
    return data;
  }
  function applySnapshot(data) {
    user = data.user; rows = data.rows;
    Core.loadAuthors(data.users.filter(item => !Core.demoUsers.some(demo => demo.id === item.id)));
  }
  async function refresh() { const data = await api('/api/session'); applySnapshot(data); render(); }
  function toast(message, error = false) {
    clearTimeout(timer); const element = $('#toast');
    element.textContent = message; element.classList.toggle('error', error); element.hidden = false;
    timer = setTimeout(() => { element.hidden = true; }, 4500);
  }
  async function commit(command, input, success) {
    try {
      const current = rows.find(row => row.id === input.id);
      const endpoint = command === 'create' ? '/api/manuscripts' : '/api/manuscripts/' + encodeURIComponent(input.id) + '/' + command;
      const data = await api(endpoint, { ...input, version: current?.version });
      applySnapshot(data); render(); toast(success); return true;
    } catch (error) {
      if (error.status === 401) { user = null; rows = []; dialog.close(); dirty = false; render(); }
      if (error.status === 409) { try { await refresh(); } catch {} }
      toast(error.message || '儲存失敗，請稍後再試', true); return false;
    }
  }
  const badge = status => `<span class="status ${status}">${Core.statuses[status]}</span>`;
  const date = value => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const author = id => Core.users.find(item => item.id === id).name;
  function returnNotice(row) {
    if (!row?.returnReason) return '';
    return `<section class="return-notice" aria-label="編輯退回原因"><h4>上次退回原因</h4><p>${escape(row.returnReason)}</p><small>${escape(row.returnedBy ? author(row.returnedBy) : '編輯')}${row.returnedAt ? ` · ${date(row.returnedAt)}` : ''}</small></section>`;
  }
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
      <td><button class="article-title" data-action="view" data-id="${escape(row.id)}">${escape(row.title)}</button>${row.returnReason && row.status === 'draft' ? '<span class="returned-label">已退回 · 點標題查看原因</span>' : ''}<div class="article-meta">${escape(row.content.replace(/\s+/g, ' ').slice(0, 26))}…</div></td>
      <td class="category">${escape(row.category)}</td>${user.role === 'editor' ? `<td class="category">${escape(author(row.authorId))}</td>` : ''}
      <td>${badge(row.status)}</td><td class="date">${date(row.updatedAt)}</td>
      <td><div class="row-actions">${user.role === 'author' && row.status === 'draft' ? `<button class="text-button" data-action="edit" data-id="${escape(row.id)}">編輯</button><button class="text-button" data-action="submit" data-id="${escape(row.id)}">送出</button><button class="text-button muted" data-action="delete" data-id="${escape(row.id)}">刪除</button>` : `<button class="text-button" data-action="view" data-id="${escape(row.id)}">${user.role === 'editor' ? '審查 →' : '查看 →'}</button>`}</div></td></tr>`).join('');
    $('#empty').hidden = shown.length > 0;
    $('#empty-title').textContent = query || filter !== 'all' ? '沒有符合條件的稿件' : user.role === 'editor' ? '目前沒有待審查稿件' : '你的第一篇創作，從這裡開始';
    $('#empty-description').textContent = query || filter !== 'all' ? '試試其他關鍵字，或切換稿件狀態' : user.role === 'editor' ? '作者送出投稿後，稿件就會出現在這裡' : '新增一篇稿件，開始記錄你的想法';
    $('#empty-new').hidden = user.role !== 'author' || !!query || filter !== 'all';
    $('#empty-new').disabled = blocked;
    $('#result-count').textContent = `顯示 ${shown.length} 篇，共 ${items.length} 篇稿件`;
  }
  function render() {
    $('#login-page').hidden = !!user;
    $('#app-shell').hidden = $('#app-sidebar').hidden = !user;
    if (!user) return;
    $('#current-identity').textContent = `${user.name} · ${user.role === 'author' ? '作者' : '編輯'}`;
    const editing = user.role === 'author', label = editing ? '我的投稿' : '待審查稿件';
    $('#nav-label').textContent = $('#breadcrumb').textContent = label;
    $('#page-title').textContent = label;
    $('#eyebrow').textContent = editing ? 'YOUR WRITING, IN PROGRESS' : 'A FRESH PERSPECTIVE, EVERY STORY';
    $('#page-description').textContent = editing ? '好好寫作，讓每一個想法找到自己的位置' : '細讀每一份創作，讓好的觀點被看見';
    $('#list-heading').textContent = editing ? '稿件管理' : '審查工作台';
    $('#list-description').textContent = editing ? '每一次修改，都是離完成更近一步' : '查看完整內容，選擇通過或退回給作者';
    $('#workflow-note').textContent = editing ? '編輯中的稿件可隨時修改；送出後將交由編輯審查，退回後可再次編輯' : '此處僅顯示審查中的稿件；通過或退回後，稿件會從待審查清單移除';
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
  function confirmAction(title, message, button, danger = false, needsReason = false) {
    $('#confirm-title').textContent = title; $('#confirm-message').textContent = message;
    $('#confirm-ok').textContent = button; $('#confirm-ok').className = danger ? 'danger' : 'primary';
    $('#return-fields').hidden = !needsReason;
    $('#return-reason').value = '';
    $('#reason-error').hidden = true;
    confirmDialog.showModal();
    (needsReason ? $('#return-reason') : $('#confirm-cancel')).focus();
    return new Promise(resolve => { pendingConfirm = resolve; });
  }
  function resolveConfirm(value) { confirmDialog.close(); pendingConfirm?.(value); pendingConfirm = null; }
  $('#confirm-ok').addEventListener('click', () => {
    if (!$('#return-fields').hidden && !$('#return-reason').value.trim()) {
      $('#reason-error').hidden = false; $('#return-reason').focus(); return;
    }
    resolveConfirm(true);
  });
  $('#confirm-cancel').addEventListener('click', () => resolveConfirm(false));
  $('#confirm-close').addEventListener('click', () => resolveConfirm(false));
  confirmDialog.addEventListener('cancel', event => { event.preventDefault(); resolveConfirm(false); });
  let dirty = false;
  async function closeArticle() {
    if (dirty && !await confirmAction('放棄尚未儲存的修改？', '這次輸入的內容尚未儲存，關閉後將不會保留', '放棄修改', true)) return;
    dirty = false; dialog.close();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeArticle(); });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  function head(title, eyebrow) { return `<div class="dialog-head"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" data-close aria-label="關閉稿件視窗">×</button></div>`; }
  function openEditor(row) {
    if (blocked) return toast('目前無法儲存資料', true);
    if (user.role !== 'author' || row && (row.authorId !== user.id || row.status !== 'draft')) return toast('這篇稿件目前無法編輯', true);
    dirty = false;
    $('#dialog-content').innerHTML = `${head(row ? '編輯投稿' : '寫下新的想法', 'MANUSCRIPT / DRAFT')}<form class="editor-form" id="editor-form">${returnNotice(row)}<div class="form-split"><label class="field"><span>稿件類別 <small>必填</small></span><select name="category" required><option value="">請選擇類別</option>${Core.categories.map(category => `<option ${row?.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label><label class="field"><span>稿件標題 <small>必填 · 最多 100 字</small></span><input name="title" maxlength="100" required placeholder="為這篇創作取個名字" value="${escape(row?.title || '')}"></label></div><label class="field"><span>文章內容 <small>必填</small></span><textarea name="content" required maxlength="20000" placeholder="你的故事，就從這裡開始…">${escape(row?.content || '')}</textarea></label><div class="word-count" id="word-count">${row?.content.length || 0} / 20,000 字</div><p class="form-error" id="form-error" role="alert" hidden></p><div class="dialog-actions"><span class="save-note">儲存後的狀態為「編輯中」</span><button type="button" class="secondary" data-close>取消</button><button type="submit" class="primary">儲存稿件</button></div></form>`;
    $('#editor-form').addEventListener('input', () => { dirty = true; $('#word-count').textContent = `${$('#editor-form textarea').value.length} / 20,000 字`; });
    $('#editor-form').addEventListener('submit', async event => {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(event.currentTarget));
      if (!input.title.trim() || !input.content.trim()) { $('#form-error').hidden = false; $('#form-error').textContent = '標題與文章內容不能只填空白'; return; }
      if (await commit(row ? 'update' : 'create', { ...input, id: row?.id }, '稿件已儲存，可繼續修改或送出投稿')) { dirty = false; dialog.close(); }
    });
    dialog.showModal();
  }
  function openArticle(row) {
    if (!Core.visible(rows, user).some(item => item.id === row.id)) return toast('無法查看這篇稿件', true);
    dirty = false;
    $('#dialog-content').innerHTML = `${head(user.role === 'editor' ? '稿件審查' : '稿件內容', 'MANUSCRIPT / READING')}<article class="article-body">${badge(row.status)}<h3>${escape(row.title)}</h3><div class="article-details"><span>作者 ${escape(author(row.authorId))}</span><span>${escape(row.category)}</span><span>更新於 ${date(row.updatedAt)}</span><span>${row.content.length} 字</span></div>${returnNotice(row)}<div class="article-content">${escape(row.content)}</div></article><div class="dialog-actions"><button class="secondary" data-close>關閉</button>${user.role === 'editor' ? `<button class="secondary" data-action="return" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>退回稿件</button><button class="primary" data-action="approve" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>通過審查</button>` : row.status === 'draft' ? `<button class="primary" data-action="edit" data-id="${escape(row.id)}" ${blocked ? 'disabled' : ''}>編輯稿件</button>` : ''}</div>`;
    dialog.showModal();
  }
  async function action(command, id) {
    const row = rows.find(item => item.id === id);
    if (!row) return toast('找不到這篇稿件', true);
    if (command === 'view') return openArticle(row);
    if (command === 'edit') { dialog.close(); return openEditor(row); }
    const options = {
      submit: ['送出這篇投稿？', `「${row.title}」將進入審查中，送出後暫時無法修改`, '確認送出', '稿件已送出，等待編輯審查'],
      delete: ['刪除這篇稿件？', `「${row.title}」刪除後無法復原`, '確認刪除', '稿件已刪除'],
      approve: ['通過這篇稿件？', `「${row.title}」將標記為已通過，並從待審查清單移除`, '確認通過', '稿件已通過審查'],
      return: ['退回這篇稿件？', `「${row.title}」將回到編輯中，作者可修改後再次送出`, '確認退回', '稿件已退回給作者']
    };
    if (!options[command]) return;
    const [title, message, button, success] = options[command];
    if (await confirmAction(title, message, button, command === 'delete', command === 'return')) {
      if (await commit(command, { id, reason: $('#return-reason').value }, success)) { dirty = false; dialog.close(); }
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
  $('#demo-accounts').innerHTML = Core.demoUsers.map(item => `<button class="demo-account" type="button" data-account="${item.id}"><span><strong>${escape(item.name)}</strong><small>${escape(item.username)}</small></span><span>${item.role === 'author' ? '作者' : '編輯'} <span aria-hidden="true">↗</span></span></button>`).join('');
  $('#demo-accounts').addEventListener('click', event => {
    const button = event.target.closest('[data-account]'); if (!button) return;
    const account = Core.users.find(item => item.id === button.dataset.account);
    $('#login-username').value = account.username; $('#login-password').value = 'demo123';
    $('#login-error').hidden = true; $('#login-form button[type="submit"]').focus();
  });
  let loggingIn = false;
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (loggingIn) return;
    loggingIn = true; const loginButton = $('#login-form button[type="submit"]'); loginButton.disabled = true;
    try {
      const data = await api('/api/login', { username: $('#login-username').value, password: $('#login-password').value });
      applySnapshot(data);
      $('#login-error').hidden = true; $('#login-password').value = '';
      filter = 'all'; query = ''; $('#search').value = ''; render();
      $('#logout').focus(); toast(`歡迎回來，${user.name}`);
    } catch (error) { $('#login-error').textContent = error.message; $('#login-error').hidden = false; }
    finally { loggingIn = false; loginButton.disabled = false; }
  });
  const registerDialog = $('#register-dialog');
  let registering = false;
  function closeRegister() { if (!registering) { $('#register-form').reset(); registerDialog.close(); } }
  $('#open-register').addEventListener('click', () => {
    $('#register-form').reset(); $('#register-error').hidden = true; registerDialog.showModal(); $('#register-name').focus();
  });
  $('#register-close').addEventListener('click', closeRegister);
  $('#register-cancel').addEventListener('click', closeRegister);
  registerDialog.addEventListener('cancel', event => { event.preventDefault(); closeRegister(); });
  $('#register-form').addEventListener('submit', async event => {
    event.preventDefault(); if (registering) return;
    registering = true;
    $('#register-submit').disabled = $('#register-cancel').disabled = $('#register-close').disabled = true;
    $('#register-submit').textContent = '建立中…'; $('#register-error').hidden = true;
    try {
      const input = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api('/api/register', input);
      $('#login-username').value = result.user.username; $('#login-password').value = '';
      $('#login-error').hidden = true;
      $('#register-form').reset(); registerDialog.close(); $('#login-password').focus();
      toast('註冊成功，請使用新帳號與剛設定的密碼登入');
    } catch (error) {
      $('#register-error').textContent = error.message || '無法儲存帳號，請確認瀏覽器允許網站儲存資料';
      $('#register-error').hidden = false;
    } finally {
      registering = false; $('#register-submit').disabled = $('#register-cancel').disabled = $('#register-close').disabled = false;
      $('#register-submit').textContent = '建立帳號';
    }
  });
  $('#logout').addEventListener('click', async () => {
    try { await api('/api/logout', {}); } catch (error) { toast(error.message, true); return; }
    user = null; dirty = false; dialog.close();
    rows = []; Core.loadAuthors([]);
    $('#login-form').reset(); $('#login-error').hidden = true; $('#toast').hidden = true;
    render(); $('#login-username').focus();
  });
  $('#new').addEventListener('click', () => openEditor());
  $('#empty-new').addEventListener('click', () => openEditor());
  $('#workspace').addEventListener('click', () => { filter = 'all'; query = ''; $('#search').value = ''; render(); $('#main').scrollIntoView({ behavior: 'smooth' }); });
  $('#refresh-data').addEventListener('click', async () => { try { await refresh(); toast('資料已更新'); } catch (error) { toast(error.message, true); } });
  window.addEventListener('focus', () => { if (user && !dialog.open && !confirmDialog.open) refresh().catch(() => {}); });
  $('#login-form button[type="submit"]').disabled = true;
  render();
  api('/api/session').then(data => { applySnapshot(data); render(); }).catch(error => {
    if (error.status !== 401) { $('#login-error').textContent = error.message; $('#login-error').hidden = false; }
  }).finally(() => { $('#login-form button[type="submit"]').disabled = false; });
})();
