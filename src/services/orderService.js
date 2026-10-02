import * as productModel from '../models/productModel.js';
import * as orderModel from '../models/orderModel.js';
import { calculateDiscount } from './discountService.js';
import { processPayment } from './paymentService.js';
import { beginTransaction, commitTransaction, rollbackTransaction } from '../config/database.js';

/**
 * Main order processing function.
 * ACID Compliant: explicitly wraps all multi-statement operations
 * (stock decrement, order creation, order items insertion, payment processing)
 * inside a database transaction with explicit BEGIN, COMMIT, and ROLLBACK.
 *
 * @param {Object} orderData
 * @returns {Promise<Object>}
 */
export async function processCheckout({
  userId = null,
  customerName,
  productId,
  quantity = 1,
  discountRate = 0,
  paymentMethod = 'credit_card',
  paymentToken = null,
}) {
  if (!customerName || !productId || quantity <= 0) {
    const error = new Error('Invalid order payload: customerName, productId, and positive quantity required');
    error.statusCode = 400;
    throw error;
  }

  const client = await beginTransaction();

  try {
    const product = await productModel.findById(productId, client);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    // Atomic decrement inside transaction: prevents race conditions and overselling
    const decremented = await productModel.decrementStockAtomically(productId, quantity, client);
    if (!decremented) {
      const error = new Error('Insufficient inventory available');
      error.statusCode = 409;
      throw error;
    }

    const rawTotal = Math.round(product.price * quantity * 100) / 100;
    const discountResult = calculateDiscount(rawTotal, discountRate);

    // Multi-statement write 1: Create Order & Order Items
    const order = await orderModel.createOrder(
      {
        userId,
        customerName,
        totalAmount: rawTotal,
        discountRate,
        finalAmount: discountResult.finalAmount,
        status: 'completed',
        items: [{ productId, quantity, unitPrice: product.price }],
      },
      client
    );

    // Multi-statement write 2: Record Payment Transaction
    const payment = await processPayment(
      {
        orderId: order.id,
        amount: order.finalAmount,
        paymentMethod,
        paymentToken,
      },
      client
    );

    // Explicit COMMIT upon successful completion of all writes
    await commitTransaction(client);

    const updatedProduct = await productModel.findById(productId);
    return {
      ...order,
      payment,
      remainingStock: updatedProduct ? updatedProduct.stock : 0,
    };
  } catch (error) {
    // Explicit ROLLBACK on any failure (inventory, calculation, payment)
    await rollbackTransaction(client);
    throw error;
  }
}

/**
 * Cancel an order atomically with idempotency and inventory restoration.
 *
 * @param {number} orderId
 * @returns {Promise<Object>}
 */
export async function cancelOrder(orderId) {
  const client = await beginTransaction();

  try {
    const order = await orderModel.findById(orderId, client);
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }

    // Idempotency: If order is already cancelled, commit and return without modifying stock
    if (order.status === 'cancelled') {
      await commitTransaction(client);
      return { ...order, message: 'Order is already cancelled' };
    }

    // Atomically restore product stock for all order items
    for (const item of order.items) {
      await productModel.incrementStockAtomically(item.productId, item.quantity, client);
    }

    // Update order status to cancelled
    await orderModel.updateOrderStatus(orderId, 'cancelled', client);

    await commitTransaction(client);

    return {
      ...order,
      status: 'cancelled',
      message: 'Order cancelled successfully and stock restored',
    };
  } catch (error) {
    await rollbackTransaction(client);
    throw error;
  }
}

export async function getOrderById(orderId) {
  const order = await orderModel.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }
  return order;
}

export async function getOrders() {
  return await orderModel.findAllOrdersOptimized();
}
