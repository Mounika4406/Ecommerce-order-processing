import { query } from '../config/database.js';

/**
 * Decoupled Payment Gateway Service.
 * Simulates third-party payment processing with deterministic success and failure pathways.
 *
 * @param {Object} paymentData
 * @param {number} paymentData.orderId - Associated order identifier
 * @param {number} paymentData.amount - Charge amount
 * @param {string} [paymentData.paymentMethod='credit_card'] - Payment method
 * @param {string} [paymentData.paymentToken] - Simulated payment gateway token
 * @param {any} [client=null] - Transactional database client
 * @returns {Promise<Object>} Processed payment record
 */
export async function processPayment({ orderId, amount, paymentMethod = 'credit_card', paymentToken }, client = null) {
  if (typeof amount !== 'number' || amount < 0) {
    const error = new Error('Invalid payment amount');
    error.statusCode = 400;
    throw error;
  }

  // Simulate payment gateway decline
  if (paymentToken === 'fail_payment' || paymentMethod === 'invalid') {
    const error = new Error('Payment gateway transaction declined: insufficient funds or invalid card');
    error.statusCode = 402;
    throw error;
  }

  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const status = 'success';

  const res = await query(
    'INSERT INTO payments (order_id, amount, status, payment_method, transaction_id) VALUES ($1, $2, $3, $4, $5)',
    [orderId, amount, status, paymentMethod, transactionId],
    client
  );

  const paymentId = res.insertId || (res.rows[0] && res.rows[0].id) || 1;

  return {
    id: paymentId,
    orderId,
    amount,
    status,
    paymentMethod,
    transactionId,
  };
}
