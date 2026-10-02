import { query } from '../config/database.js';

export async function findById(id, client = null) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id], client);
  return result.rows[0] || null;
}

export async function createProduct({ name, price, stock }, client = null) {
  const result = await query(
    'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3)',
    [name, price, stock],
    client
  );
  return result.insertId || (result.rows[0] && result.rows[0].id);
}

/**
 * Atomic stock decrement to prevent race conditions.
 * Updates stock if and only if available stock is sufficient.
 * @param {number} productId
 * @param {number} quantity
 * @param {any} [client=null] - Optional transaction client
 * @returns {Promise<boolean>} true if decremented successfully, false if insufficient stock
 */
export async function decrementStockAtomically(productId, quantity, client = null) {
  const result = await query(
    'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stock >= $1',
    [quantity, productId],
    client
  );
  return result.rowCount > 0;
}

/**
 * Atomic stock increment to restore inventory upon order cancellation.
 * @param {number} productId
 * @param {number} quantity
 * @param {any} [client=null] - Optional transaction client
 * @returns {Promise<boolean>}
 */
export async function incrementStockAtomically(productId, quantity, client = null) {
  const result = await query(
    'UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [quantity, productId],
    client
  );
  return result.rowCount > 0;
}

/**
 * Non-atomic stock update (legacy simulation)
 */
export async function updateStockDirectly(productId, newStock, client = null) {
  const result = await query(
    'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newStock, productId],
    client
  );
  return result.rowCount > 0;
}

export async function getAllProducts(client = null) {
  const result = await query('SELECT * FROM products ORDER BY id ASC', [], client);
  return result.rows;
}
