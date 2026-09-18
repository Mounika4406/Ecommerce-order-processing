import dotenv from 'dotenv';
import pg from 'pg';
import initSqlJs from 'sql.js';

dotenv.config();

let dbType = process.env.DB_TYPE || 'sqlite';
let pool = null;
let sqliteDb = null;
let queryLog = [];

export function getQueryCount() {
  return queryLog.length;
}

export function resetQueryCount() {
  queryLog = [];
}

export function getQueryLog() {
  return [...queryLog];
}

export async function initDb() {
  dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          stock INTEGER NOT NULL CHECK (stock >= 0),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          customer_name VARCHAR(255) NOT NULL,
          total_amount NUMERIC(10, 2) NOT NULL,
          discount_rate NUMERIC(5, 2) DEFAULT 0,
          final_amount NUMERIC(10, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          quantity INTEGER NOT NULL,
          unit_price NUMERIC(10, 2) NOT NULL
        );
      `);
    } finally {
      client.release();
    }
  } else {
    // SQLite via sql.js
    const SQL = await initSqlJs();
    sqliteDb = new SQL.Database();

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL CHECK (stock >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        discount_rate REAL DEFAULT 0,
        final_amount REAL NOT NULL,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL
      );
    `);
  }
}

/**
 * Execute a query with parameter binding
 * Normalizes PostgreSQL ($1, $2) and SQLite (?1, ?2)
 */
export async function query(sqlText, params = []) {
  queryLog.push({ sql: sqlText, params, timestamp: Date.now() });

  if (dbType === 'postgres') {
    const res = await pool.query(sqlText, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount,
    };
  }

  // SQLite execution: convert $1, $2 to ?1, ?2 to preserve repeated parameter references
  const convertedSql = sqlText.replace(/\$(\d+)/g, '?$1');

  try {
    const stmt = sqliteDb.prepare(convertedSql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }

    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    // Check for rowCount / changes
    const changesRes = sqliteDb.exec("SELECT changes() AS affected, last_insert_rowid() AS last_id");
    let rowCount = rows.length;
    let lastInsertId = null;

    if (changesRes && changesRes.length > 0 && changesRes[0].values.length > 0) {
      const affected = changesRes[0].values[0][0];
      lastInsertId = changesRes[0].values[0][1];
      if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sqlText)) {
        rowCount = affected;
      }
    }

    return {
      rows,
      rowCount,
      insertId: lastInsertId,
    };
  } catch (err) {
    throw err;
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end();
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
