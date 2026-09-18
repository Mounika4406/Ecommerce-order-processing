import { query } from '../config/database.js';

export async function createOrder({ customerName, totalAmount, discountRate, finalAmount, status = 'completed', items = [] }) {
  const orderRes = await query(
    'INSERT INTO orders (customer_name, total_amount, discount_rate, final_amount, status) VALUES ($1, $2, $3, $4, $5)',
    [customerName, totalAmount, discountRate, finalAmount, status]
  );
  const orderId = orderRes.insertId || (orderRes.rows[0] && orderRes.rows[0].id);

  for (const item of items) {
    await query(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
      [orderId, item.productId, item.quantity, item.unitPrice]
    );
  }

  return { id: orderId, customerName, totalAmount, discountRate, finalAmount, status, items };
}

/**
 * Optimized order retrieval resolving N+1 problem.
 * Executes at most 2 queries:
 * 1. Query for all orders
 * 2. Query for all items matching order IDs
 */
export async function findAllOrdersOptimized() {
  const ordersResult = await query('SELECT * FROM orders ORDER BY id ASC');
  const orders = ordersResult.rows;

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
  const itemsResult = await query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds
  );

  const itemsByOrderId = new Map();
  for (const item of itemsResult.rows) {
    if (!itemsByOrderId.has(item.order_id)) {
      itemsByOrderId.set(item.order_id, []);
    }
    itemsByOrderId.get(item.order_id).push(item);
  }

  return orders.map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    totalAmount: order.total_amount,
    discountRate: order.discount_rate,
    finalAmount: order.final_amount,
    status: order.status,
    createdAt: order.created_at,
    items: itemsByOrderId.get(order.id) || [],
  }));
}

/**
 * Flawed N+1 implementation (executed when NPLUSONE_MODE=true)
 */
export async function findAllOrdersLegacy() {
  const ordersResult = await query('SELECT * FROM orders ORDER BY id ASC');
  const orders = ordersResult.rows;

  for (const order of orders) {
    const itemsResult = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    order.items = itemsResult.rows;
  }

  return orders.map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    totalAmount: order.total_amount,
    discountRate: order.discount_rate,
    finalAmount: order.final_amount,
    status: order.status,
    createdAt: order.created_at,
    items: order.items || [],
  }));
}
