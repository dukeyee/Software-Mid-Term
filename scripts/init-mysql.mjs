import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const database = process.env.STUDIO_DB_NAME || 'software_mid_term';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
const connection = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: process.env.STUDIO_ADMIN_USER || 'root', password: process.env.STUDIO_ADMIN_PASSWORD || '', charset: 'utf8mb4' });
try {
  const [existing] = await connection.execute('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?', [database]);
  if (existing.length && !fs.existsSync(envFile)) throw new Error('Database name already exists; choose an unused STUDIO_DB_NAME to preserve existing data');
  if (existing.length) {
    const [marker] = await connection.query(`SELECT value FROM \`${database}\`.studio_meta WHERE name='application'`);
    if (marker[0]?.value !== 'submission-review-system') throw new Error('Database is not owned by this project');
  }
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${database}\``);
  for (const sql of fs.readFileSync(path.join(root, 'db/mysql-schema.sql'), 'utf8').split(/;\s*(?:\r?\n|$)/).map(sql => sql.trim()).filter(Boolean)) await connection.query(sql);
  if (!fs.existsSync(envFile)) {
    const user = 'studio_' + crypto.randomUUID().replaceAll('-', '').slice(0, 8);
    const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    for (const host of ['localhost', '127.0.0.1']) {
      await connection.query('CREATE USER ?@? IDENTIFIED BY ?', [user, host, password]);
      await connection.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${database}\`.* TO ?@?`, [user, host]);
    }
    fs.writeFileSync(envFile, `STUDIO_DB_HOST=127.0.0.1\nSTUDIO_DB_PORT=3306\nSTUDIO_DB_NAME=${database}\nSTUDIO_DB_USER=${user}\nSTUDIO_DB_PASSWORD=${password}\n`, { flag: 'wx', mode: 0o600 });
  }
  const [tables] = await connection.query('SHOW TABLES');
  console.log(JSON.stringify({ database, tables: tables.map(row => Object.values(row)[0]), configuration: '.env.local', passwordPrinted: false }));
} finally { await connection.end(); }
