import request from 'supertest';
import { app } from '../../src/app.js';
import { initDb, closeDb } from '../../src/config/database.js';
import * as productModel from '../../src/models/productModel.js';

describe('Concurrent Checkout Integration Test (Race Condition Verification)', () => {
  let flashSaleProductId;

  beforeAll(async () => {
    await initDb();
    // Create product with exactly 100 stock
    flashSaleProductId = await productModel.createProduct({
      name: 'High-Demand Flash Sale Item',
      price: 50.0,
      stock: 100,
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('50 simultaneous checkout requests purchasing 1 unit of stock 100 must result in exactly 50 remaining stock', async () => {
    // Generate 50 simultaneous asynchronous requests
    const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
      request(app)
        .post('/orders')
        .send({
          customerName: `Concurrent Buyer #${i + 1}`,
          productId: flashSaleProductId,
          quantity: 1,
          discountRate: 0,
        })
    );

    const responses = await Promise.all(concurrentRequests);

    // Verify all 50 requests were accepted
    const successCount = responses.filter((res) => res.status === 201).length;
    expect(successCount).toBe(50);

    // Verify exactly 50 items remain in stock
    const productAfterFirstWave = await productModel.findById(flashSaleProductId);
    expect(productAfterFirstWave.stock).toBe(50);
  });

  test('excess requests exceeding available inventory must be rejected with 409 Conflict or 400 Bad Request without overselling', async () => {
    // Attempt 60 simultaneous checkouts when only 50 units remain
    const excessiveRequests = Array.from({ length: 60 }, (_, i) =>
      request(app)
        .post('/orders')
        .send({
          customerName: `Late Buyer #${i + 1}`,
          productId: flashSaleProductId,
          quantity: 1,
          discountRate: 0,
        })
    );

    const responses = await Promise.all(excessiveRequests);

    const successfulOrders = responses.filter((res) => res.status === 201);
    const rejectedOrders = responses.filter(
      (res) => res.status === 409 || res.status === 400
    );

    // Exactly 50 should succeed and 10 must be rejected
    expect(successfulOrders.length).toBe(50);
    expect(rejectedOrders.length).toBe(10);

    // Under no circumstances should stock drop below 0
    const finalProductState = await productModel.findById(flashSaleProductId);
    expect(finalProductState.stock).toBe(0);
  });
});
