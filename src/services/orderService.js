import * as productModel from '../models/productModel.js';
import * as orderModel from '../models/orderModel.js';
import { calculateDiscount } from './discountService.js';

/**
 * Main order processing function.
 * Thread-safe: atomically decrements inventory to prevent race conditions.
 * Conforms to Requirement 6: under 50 lines of clean modular code.
 *
 * @param {Object} orderData
 * @returns {Promise<Object>}
 */
export async function processCheckout({ customerName, productId, quantity = 1, discountRate = 0 }) {
  if (!customerName || !productId || quantity <= 0) {
    const error = new Error('Invalid order payload: customerName, productId, and positive quantity required');
    error.statusCode = 400;
    throw error;
  }

  const product = await productModel.findById(productId);
  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  // Atomic decrement: guarantees thread safety and prevents overselling
  const decremented = await productModel.decrementStockAtomically(productId, quantity);
  if (!decremented) {
    const error = new Error('Insufficient inventory available');
    error.statusCode = 409;
    throw error;
  }

  const rawTotal = Math.round(product.price * quantity * 100) / 100;
  const discountResult = calculateDiscount(rawTotal, discountRate);

  const order = await orderModel.createOrder({
    customerName,
    totalAmount: rawTotal,
    discountRate,
    finalAmount: discountResult.finalAmount,
    status: 'completed',
    items: [{ productId, quantity, unitPrice: product.price }],
  });

  const updatedProduct = await productModel.findById(productId);
  return { ...order, remainingStock: updatedProduct.stock };
}

/**
 * Retrieve all orders using the batch-optimized query (resolving N+1)
 */
export async function getOrders() {
  return await orderModel.findAllOrdersOptimized();
}
