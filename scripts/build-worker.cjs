const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assets = {};
for (const name of ['index.html', 'styles.css', 'core.js', 'app.js', 'auth.js']) {
  const previous = path.join(root, 'dist', name);
  if (fs.existsSync(previous)) fs.unlinkSync(previous);
}
for (const name of ['index.html', 'styles.css', 'core.js', 'app.js', 'auth.js']) assets[name] = fs.readFileSync(path.join(root, 'web', name), 'utf8');
const api = fs.readFileSync(path.join(root, 'server/api.mjs'), 'utf8');
const output = `${api}\nconst ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const url=new URL(request.url);if(env.STUDIO_SHARED_SITE){if(url.pathname.startsWith('/api/'))return json({error:'網站已更新，請重新整理後再登入',website:env.STUDIO_SHARED_SITE},410);return Response.redirect(new URL(env.STUDIO_SHARED_SITE).origin+'/',302);}if(url.pathname.startsWith('/api/'))return handleApi(request,env);const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!Object.hasOwn(ASSETS,name))return new Response('Not found',{status:404});return new Response(ASSETS[name],{headers:{'Content-Type':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}})}};`;
fs.mkdirSync(path.join(root, 'dist/server'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/server/index.js'), output);
fs.mkdirSync(path.join(root, 'dist/.openai'), { recursive: true });
fs.copyFileSync(path.join(root, '.openai/hosting.json'), path.join(root, 'dist/.openai/hosting.json'));
console.log('Database Worker built in dist/server/index.js');
