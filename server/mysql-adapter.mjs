import mysql from 'mysql2/promise';

export function mysqlSql(sql) {
  return sql.replace(/INSERT OR IGNORE INTO/g, 'INSERT IGNORE INTO')
    .replace(/\bkey\b/g, '`key`')
    .replace('ON CONFLICT(`key`) DO UPDATE SET', 'ON DUPLICATE KEY UPDATE');
}
export function openMySQL(config) {
  const pool = mysql.createPool({ ...config, charset: 'utf8mb4', waitForConnections: true, connectionLimit: 5, decimalNumbers: true });
  const prepare = sql => {
    let values = [];
    const statement = {
      sql: mysqlSql(sql),
      bind(...args) { values = args; return statement; },
      async execute(connection = pool) { return (await connection.execute(statement.sql, values))[0]; },
      async first() { return (await statement.execute())[0] || null; },
      async all() { return { results: await statement.execute() }; },
      async run() { const result = await statement.execute(); return { success: true, meta: { changes: result.affectedRows } }; }
    };
    return statement;
  };
  return {
    label: 'MariaDB / MySQL（電腦本機）', pool, prepare,
    async batch(statements) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const results = [];
        for (const statement of statements) {
          const result = await statement.execute(connection);
          results.push({ success: true, meta: { changes: result.affectedRows } });
        }
        await connection.commit(); return results;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async close() { await pool.end(); }
  };
}
