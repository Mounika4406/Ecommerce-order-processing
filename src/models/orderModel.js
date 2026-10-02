import { query } from '../config/database.js';

export async function createOrder(
  { userId = null, customerName, totalAmount, discountRate, finalAmount, status = 'completed', items = [] },
  client = null
) {
  const orderRes = await query(
    'INSERT INTO orders (user_id, customer_name, total_amount, discount_rate, final_amount, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, customerName, totalAmount, discountRate, finalAmount, status],
    client
  );
  const orderId = orderRes.insertId || (orderRes.rows[0] && orderRes.rows[0].id);

  for (const item of items) {
    await query(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
      [orderId, item.productId, item.quantity, item.unitPrice],
      client
    );
  }

  return { id: orderId, userId, customerName, totalAmount, discountRate, finalAmount, status, items };
}

export async function findById(orderId, client = null) {
  const orderRes = await query(
    'SELECT o.*, u.name as user_name, u.email as user_email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1',
    [orderId],
    client
  );

  const order = orderRes.rows[0];
  if (!order) {
    return null;
  }

  const itemsRes = await query(
    'SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1 ORDER BY oi.id ASC',
    [orderId],
    client
  );

  const paymentsRes = await query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY id ASC',
    [orderId],
    client
  );

  return {
    id: order.id,
    userId: order.user_id,
    customerName: order.customer_name,
    totalAmount: order.total_amount,
    discountRate: order.discount_rate,
    finalAmount: order.final_amount,
    status: order.status,
    createdAt: order.created_at,
    user: order.user_id
      ? { id: order.user_id, name: order.user_name, email: order.user_email }
      : null,
    items: itemsRes.rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
    payments: paymentsRes.rows,
  };
}

export async function updateOrderStatus(orderId, status, client = null) {
  const result = await query(
    'UPDATE orders SET status = $1 WHERE id = $2',
    [status, orderId],
    client
  );
  return result.rowCount > 0;
}

/**
 * Optimized order retrieval resolving N+1 problem.
 * Executes at most 2 queries:
 * 1. Query for all orders
 * 2. Query for all items matching order IDs
 */
export async function findAllOrdersOptimized(client = null) {
  const ordersResult = await query('SELECT * FROM orders ORDER BY id ASC', [], client);
  const orders = ordersResult.rows;

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
  const itemsResult = await query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds,
    client
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
    userId: order.user_id,
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
 * Flawed N+1 implementation (for legacy baseline)
 */
export async function findAllOrdersLegacy(client = null) {
  const ordersResult = await query('SELECT * FROM orders ORDER BY id ASC', [], client);
  const orders = ordersResult.rows;

  for (const order of orders) {
    const itemsResult = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id], client);
    order.items = itemsResult.rows;
  }

  return orders.map((order) => ({
    id: order.id,
    userId: order.user_id,
    customerName: order.customer_name,
    totalAmount: order.total_amount,
    discountRate: order.discount_rate,
    finalAmount: order.final_amount,
    status: order.status,
    createdAt: order.created_at,
    items: order.items || [],
  }));
}
