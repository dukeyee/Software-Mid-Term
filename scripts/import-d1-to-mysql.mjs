import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env.local'));
process.stderr.write('Ready for database import JSON on stdin (input hidden)\n');
const tty = process.stdin.isTTY;
if (tty) process.stdin.setRawMode(true);
const data = await new Promise((resolve, reject) => {
  let value = '';
  function finish() { process.stdin.off('data', receive); if (tty) process.stdin.setRawMode(false); process.stdin.pause(); }
  function receive(chunk) {
    value += chunk;
    if (value.includes('\u0003')) { finish(); reject(new Error('Import cancelled')); }
    else if (/[\r\n]/.test(value)) { finish(); try { resolve(JSON.parse(value)); } catch { reject(new Error('Invalid import JSON')); } }
  }
  process.stdin.setEncoding('utf8'); process.stdin.on('data', receive); process.stdin.resume();
});
const connection = await mysql.createConnection({ host: process.env.STUDIO_DB_HOST, port: Number(process.env.STUDIO_DB_PORT), database: process.env.STUDIO_DB_NAME, user: process.env.STUDIO_DB_USER, password: process.env.STUDIO_DB_PASSWORD, charset: 'utf8mb4' });
const columns = {
  users: ['id','username','name','role','password_hash','salt','iterations','created_at'],
  manuscripts: ['id','author_id','category','title','content','status','version','created_at','updated_at'],
  reviews: ['id','manuscript_id','editor_id','action','reason','manuscript_version','created_at']
};
try {
  await connection.beginTransaction();
  for (const [table, fields] of Object.entries(columns)) {
    if (!Array.isArray(data[table])) throw new Error('Missing import table ' + table);
    const [count] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    if (Number(count[0].total) !== 0) throw new Error('Target table is not empty; existing data was preserved');
    for (const row of data[table]) {
      const values = fields.map(field => row[field] === undefined ? null : row[field]);
      await connection.execute(`INSERT INTO \`${table}\` (${fields.map(field => '\x60' + field + '\x60').join(',')}) VALUES (${fields.map(() => '?').join(',')})`, values);
    }
  }
  await connection.execute('INSERT INTO studio_meta (name,value) VALUES (?,?)', ['imported_from','Cloudflare D1']);
  await connection.commit();
  console.log(JSON.stringify({ imported: Object.fromEntries(Object.keys(columns).map(table => [table, data[table].length])), loginSessionsImported: false }));
} catch (error) { await connection.rollback(); console.error('Import failed: ' + (error.code || error.message)); process.exitCode = 1; }
finally { await connection.end(); }
