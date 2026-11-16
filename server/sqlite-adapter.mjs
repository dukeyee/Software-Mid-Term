import { DatabaseSync } from 'node:sqlite';
export function openDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const prepare = sql => {
    let values = [];
    const statement = {
      bind(...args) { values = args; return statement; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() {
        const before = Number(sqlite.prepare('SELECT total_changes() AS n').get().n);
        sqlite.prepare(sql).run(...values);
        const after = Number(sqlite.prepare('SELECT total_changes() AS n').get().n);
        return { success: true, meta: { changes: after - before } };
      }
    };
    return statement;
  };
  return {
    sqlite, prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); }
  };
}
