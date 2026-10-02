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

/**
 * Actively verify database connectivity for health check
 */
export async function checkDbConnection() {
  if (dbType === 'postgres') {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  } else {
    if (!sqliteDb) {
      throw new Error('SQLite database not initialized');
    }
    sqliteDb.exec('SELECT 1');
  }
  return true;
}

export async function initDb() {
  dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgrespassword'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'ecommerce_db'}`;

    pool = new pg.Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          amount NUMERIC(10, 2) NOT NULL,
          status VARCHAR(50) NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'credit_card',
          transaction_id VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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
        user_id INTEGER REFERENCES users(id),
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

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        payment_method TEXT DEFAULT 'credit_card',
        transaction_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO users (id, name, email) VALUES
        (1, 'Test User', 'testuser@example.com'),
        (2, 'Second User', 'seconduser@example.com');

      INSERT OR IGNORE INTO products (id, name, price, stock) VALUES
        (1, 'Wireless Noise-Canceling Headphones', 199.99, 100),
        (2, 'Mechanical Gaming Keyboard', 89.50, 50),
        (3, 'Ergonomic Wireless Mouse', 35.00, 75),
        (4, 'Ultra-Clear 4K Monitor', 349.99, 20),
        (5, 'Limited Edition Collector Figurine', 49.99, 0);
    `);
  }
}

/**
 * Begin an explicit ACID database transaction
 * @returns {Promise<any>} Transaction handle/client
 */
export async function beginTransaction() {
  if (dbType === 'postgres') {
    const client = await pool.connect();
    await client.query('BEGIN');
    return client;
  }
  sqliteDb.exec('BEGIN TRANSACTION');
  return { isSqlite: true };
}

/**
 * Commit an active database transaction
 * @param {any} client
 */
export async function commitTransaction(client) {
  if (dbType === 'postgres') {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  } else {
    sqliteDb.exec('COMMIT');
  }
}

/**
 * Roll back an active database transaction
 * @param {any} client
 */
export async function rollbackTransaction(client) {
  if (dbType === 'postgres') {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if transaction already aborted
    } finally {
      client.release();
    }
  } else {
    try {
      sqliteDb.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
  }
}

/**
 * Execute a query with parameter binding
 * Normalizes PostgreSQL ($1, $2) and SQLite (?1, ?2)
 * Supports running within an explicit transaction client
 */
export async function query(sqlText, params = [], client = null) {
  queryLog.push({ sql: sqlText, params, timestamp: Date.now() });

  if (dbType === 'postgres') {
    const executor = client && typeof client.query === 'function' ? client : pool;
    const res = await executor.query(sqlText, params);
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
