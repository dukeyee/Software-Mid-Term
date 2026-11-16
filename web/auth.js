(function (root) {
  'use strict';
  const RESERVED = ['nailong', 'naiwa', 'editor'];
  const normalize = value => String(value ?? '').trim().toLowerCase();
  const usernamePattern = /^[a-z][a-z0-9_]{2,23}$/;
  function valid(accounts) {
    return Array.isArray(accounts) && new Set(accounts.map(x => x?.id)).size === accounts.length &&
      new Set(accounts.map(x => x?.username)).size === accounts.length && accounts.every(account =>
        account && typeof account.id === 'string' && /^registered-[a-f0-9-]{36}$/.test(account.id) &&
        typeof account.username === 'string' && usernamePattern.test(account.username) && !RESERVED.includes(account.username) &&
        typeof account.name === 'string' && account.name.trim().length > 0 && account.name.length <= 20 &&
        typeof account.salt === 'string' && /^[a-f0-9]{32}$/.test(account.salt) &&
        typeof account.passwordHash === 'string' && /^[a-f0-9]{64}$/.test(account.passwordHash));
  }
  function available(username, accounts) {
    return !RESERVED.includes(normalize(username)) && !accounts.some(account => account.username === normalize(username));
  }
  const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  async function derive(password, salt) {
    if (!root.crypto?.subtle) throw new Error('目前環境不支援帳號註冊，請使用 HTTPS 網站或本機伺服器');
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const saltBytes = Uint8Array.from(salt.match(/../g), pair => parseInt(pair, 16));
    const bits = await root.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256);
    return hex(new Uint8Array(bits));
  }
  async function register(input, accounts) {
    const name = String(input.name ?? '').trim(), username = normalize(input.username);
    const password = String(input.password ?? '');
    if (!name || name.length > 20) throw new Error('請填寫顯示名稱，最多 20 字');
    if (!usernamePattern.test(username)) throw new Error('帳號需為 3–24 個英文字母、數字或底線，並以英文字母開頭');
    if (!available(username, accounts)) throw new Error('這個帳號已有人使用，請更換帳號');
    if (password.length < 8 || password.length > 128 || !password.trim()) throw new Error('密碼需為 8–128 個字元，不能只包含空白');
    if (password !== input.confirmPassword) throw new Error('兩次輸入的密碼不一致');
    const salt = hex(root.crypto.getRandomValues(new Uint8Array(16)));
    return { id: 'registered-' + root.crypto.randomUUID(), username, name, salt, passwordHash: await derive(password, salt) };
  }
  async function verify(account, password) {
    if (!account || typeof password !== 'string' || password.length > 128) return false;
    return await derive(password, account.salt) === account.passwordHash;
  }
  const api = { normalize, valid, available, register, verify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReviewAuth = api;
})(globalThis);
