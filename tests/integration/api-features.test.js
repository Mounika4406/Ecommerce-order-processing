import request from 'supertest';
import { app } from '../../src/app.js';
import { initDb, closeDb } from '../../src/config/database.js';
import * as productModel from '../../src/models/productModel.js';

describe('Comprehensive API Endpoints & ACID Transaction Verification', () => {
  let testProductId;

  beforeAll(async () => {
    await initDb();
    testProductId = await productModel.createProduct({
      name: 'Transaction Verification Item',
      price: 100,
      stock: 10,
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Active Health Check', () => {
    test('GET /health should return 200 with database connected status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
    });

    test('GET /api/health should also return 200 with database connected status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Products Endpoint', () => {
    test('GET /api/products should return a JSON array containing available products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);

      const inStockProduct = res.body.find((p) => p.id === 1);
      expect(inStockProduct).toBeDefined();
      expect(inStockProduct.stock).toBeGreaterThan(0);

      const outOfStockProduct = res.body.find((p) => p.id === 5);
      expect(outOfStockProduct).toBeDefined();
      expect(outOfStockProduct.stock).toBe(0);
    });
  });

  describe('Order Details & ACID Transactions', () => {
    let createdOrderId;

    test('POST /api/orders should atomically process checkout with payment simulation', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          userId: 1,
          customerName: 'Test User',
          productId: testProductId,
          quantity: 2,
          discountRate: 10,
          paymentMethod: 'credit_card',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.finalAmount).toBe(180); // (100 * 2) - 10%
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.payment.status).toBe('success');

      createdOrderId = res.body.data.id;

      // Verify stock was decremented from 10 to 8
      const p = await productModel.findById(testProductId);
      expect(p.stock).toBe(8);
    });

    test('POST /api/orders should roll back entire transaction if payment gateway declines', async () => {
      const stockBefore = (await productModel.findById(testProductId)).stock;

      const res = await request(app)
        .post('/api/orders')
        .send({
          userId: 1,
          customerName: 'Test User',
          productId: testProductId,
          quantity: 2,
          discountRate: 0,
          paymentToken: 'fail_payment', // triggers simulated decline
        });

      expect(res.status).toBe(402);

      // Verify stock was rolled back and NOT decremented
      const stockAfter = (await productModel.findById(testProductId)).stock;
      expect(stockAfter).toBe(stockBefore);
    });

    test('GET /api/orders/:orderId should retrieve full order details with nested items and user', async () => {
      const res = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdOrderId);
      expect(res.body.customerName).toBe('Test User');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(1);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].quantity).toBe(2);
      expect(Array.isArray(res.body.payments)).toBe(true);
    });

    test('GET /api/orders/:orderId should return 404 for non-existent order', async () => {
      const res = await request(app).get('/api/orders/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('Order Cancellation & Idempotency', () => {
    let cancelableOrderId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          userId: 1,
          customerName: 'Cancellation Customer',
          productId: testProductId,
          quantity: 3,
        });
      cancelableOrderId = res.body.data.id;
    });

    test('PUT /api/orders/:orderId/cancel should cancel order and restore stock', async () => {
      const stockBeforeCancel = (await productModel.findById(testProductId)).stock;

      const res = await request(app).put(`/api/orders/${cancelableOrderId}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      // Verify stock was restored by 3
      const stockAfterCancel = (await productModel.findById(testProductId)).stock;
      expect(stockAfterCancel).toBe(stockBeforeCancel + 3);
    });

    test('PUT /api/orders/:orderId/cancel should be idempotent (does not restore stock twice)', async () => {
      const stockBeforeSecondCancel = (await productModel.findById(testProductId)).stock;

      // Second call to cancel the already-cancelled order
      const res = await request(app).put(`/api/orders/${cancelableOrderId}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');

      // Stock must remain unchanged
      const stockAfterSecondCancel = (await productModel.findById(testProductId)).stock;
      expect(stockAfterSecondCancel).toBe(stockBeforeSecondCancel);
    });

    test('PUT /api/orders/:orderId/cancel should return 404 for non-existent order', async () => {
      const res = await request(app).put('/api/orders/88888/cancel');
      expect(res.status).toBe(404);
    });
  });
});
