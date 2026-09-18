import request from 'supertest';
import { app } from '../../src/app.js';
import { initDb, closeDb, resetQueryCount, getQueryCount } from '../../src/config/database.js';
import * as productModel from '../../src/models/productModel.js';
import * as orderModel from '../../src/models/orderModel.js';

describe('Orders Integration & N+1 Query Elimination Tests', () => {
  let p1, p2, p3;

  beforeAll(async () => {
    await initDb();
    p1 = await productModel.createProduct({ name: 'Bulk Item 1', price: 10, stock: 1000 });
    p2 = await productModel.createProduct({ name: 'Bulk Item 2', price: 20, stock: 1000 });
    p3 = await productModel.createProduct({ name: 'Bulk Item 3', price: 30, stock: 1000 });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('should successfully checkout an order via POST /orders', async () => {
    const res = await request(app)
      .post('/orders')
      .send({
        customerName: 'Carol Danvers',
        productId: p1,
        quantity: 2,
        discountRate: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customerName).toBe('Carol Danvers');
    expect(res.body.data.finalAmount).toBe(18); // (10 * 2) - 10% = 18
  });

  test('should fetch 100 orders with items executing at most 3 queries (O(1) database round trips)', async () => {
    // Seed up to 100 orders, each with 3 items
    for (let i = 0; i < 100; i++) {
      await orderModel.createOrder({
        customerName: `Customer #${i + 1}`,
        totalAmount: 60,
        discountRate: 0,
        finalAmount: 60,
        items: [
          { productId: p1, quantity: 1, unitPrice: 10 },
          { productId: p2, quantity: 1, unitPrice: 20 },
          { productId: p3, quantity: 1, unitPrice: 30 },
        ],
      });
    }

    // Reset query counter immediately before calling GET /orders
    resetQueryCount();

    const response = await request(app).get('/orders');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(100);

    // Verify nested items exist on returned orders
    const sampleOrder = response.body.data.find((o) => o.customerName === 'Customer #1');
    expect(sampleOrder).toBeDefined();
    expect(sampleOrder.items.length).toBe(3);

    // Contract Specification: Query logs must show a MAXIMUM of 3 queries executed
    const executedQueries = getQueryCount();
    expect(executedQueries).toBeLessThanOrEqual(3);
  });
});
