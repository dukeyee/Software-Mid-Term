import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env.shared'))) process.loadEnvFile(path.join(root, '.env.shared'));
const shared = process.env.STUDIO_SHARED_API;
const xampp = process.env.XAMPP_ROOT || 'C:/xampp';
const data = path.join(root, 'data'); fs.mkdirSync(data, { recursive: true });
const listening = port => new Promise(resolve => {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(500);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => { socket.destroy(); resolve(false); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
});
function background(executable, args, name) {
  const stdout = fs.openSync(path.join(data, name + '.log'), 'a');
  const stderr = fs.openSync(path.join(data, name + '.error.log'), 'a');
  try {
    const child = spawn(executable, args, { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] });
    child.once('error', error => { console.error(name + ': ' + error.message); process.exitCode = 1; });
    if (child.pid) fs.writeFileSync(path.join(data, name + '.pid'), String(child.pid));
    child.unref();
  }
  finally { fs.closeSync(stdout); fs.closeSync(stderr); }
}
async function wait(port) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await listening(port)) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Port ' + port + ' did not start; inspect data/*.error.log');
}
if (!shared && !await listening(3306)) {
  background(path.join(xampp, 'mysql/bin/mysqld.exe'), ['--defaults-file=' + path.join(xampp, 'mysql/bin/my.ini'), '--standalone', '--bind-address=127.0.0.1'], 'mysql');
  await wait(3306);
}
if (!shared && !fs.existsSync(path.join(root, '.env.local'))) {
  console.error('Run node scripts/init-mysql.mjs first to configure the project database'); process.exitCode = 1;
} else {
  {
    let config = fs.readFileSync(path.join(xampp, 'apache/conf/httpd.conf'), 'utf8');
    config = config.replace(/^Listen\s+\S+.*$/gm, 'Listen 127.0.0.1:8080')
      .replace(/^ServerName\s+.*$/gm, 'ServerName localhost:8080')
      .replace(/^Include\s+.*httpd-(ssl|ajp)\.conf.*$/gm, '# Disabled in project-local Apache config');
    config += '\nPidFile "' + path.join(data, 'apache.pid').replaceAll('\\', '/') + '"\n';
    if (shared && process.env.STUDIO_SHARED_ADMIN) {
      const adminOrigin = new URL(process.env.STUDIO_SHARED_ADMIN);
      if (adminOrigin.protocol !== 'https:' || adminOrigin.pathname !== '/') throw new Error('Invalid shared database manager URL');
      config += '\nRedirectMatch 302 ^/phpmyadmin(?:/.*)?$ ' + adminOrigin.href + '\n';
    }
    const configFile = path.join(data, 'httpd-local.conf'); fs.writeFileSync(configFile, config);
    if (!await listening(8080)) {
    background(path.join(xampp, 'apache/bin/httpd.exe'), ['-f', configFile], 'apache');
    await wait(8080);
    }
  }
  if (!await listening(4173)) { background(process.execPath, [path.join(root, 'scripts/mysql-server.mjs')], 'website'); await wait(4173); }
  const response = await fetch('http://127.0.0.1:4173/api/health');
  const status = await response.json();
  if (!response.ok || !status.database?.includes(shared ? '共用雲端 MySQL' : 'MariaDB')) throw new Error('Port 4173 is occupied by another website or database mode; stop it before retrying');
  const admin = await fetch('http://127.0.0.1:8080/phpmyadmin/');
  if (!admin.ok) throw new Error('phpMyAdmin did not respond successfully');
  console.log('Website: http://127.0.0.1:4173/\nDatabase manager: ' + (shared ? process.env.STUDIO_SHARED_ADMIN : 'http://127.0.0.1:8080/phpmyadmin/') + '\nDatabase: software_mid_term\nMode: ' + (shared ? 'Shared cloud MySQL' : 'Local MariaDB'));
}
