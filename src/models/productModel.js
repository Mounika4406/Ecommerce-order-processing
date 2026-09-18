import { query } from '../config/database.js';

export async function findById(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function createProduct({ name, price, stock }) {
  const result = await query(
    'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3)',
    [name, price, stock]
  );
  return result.insertId || (result.rows[0] && result.rows[0].id);
}

/**
 * Atomic stock decrement to prevent race conditions.
 * Updates stock if and only if available stock is sufficient.
 * @param {number} productId
 * @param {number} quantity
 * @returns {Promise<boolean>} true if decremented successfully, false if insufficient stock
 */
export async function decrementStockAtomically(productId, quantity) {
  const result = await query(
    'UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stock >= $1',
    [quantity, productId]
  );
  return result.rowCount > 0;
}

/**
 * Non-atomic stock update (legacy flaw simulation if flag enabled)
 */
export async function updateStockDirectly(productId, newStock) {
  const result = await query(
    'UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newStock, productId]
  );
  return result.rowCount > 0;
}

export async function getAllProducts() {
  const result = await query('SELECT * FROM products ORDER BY id ASC');
  return result.rows;
}
