import { initDb, closeDb } from '../../src/config/database.js';
import * as productModel from '../../src/models/productModel.js';

describe('Inventory Concurrency & Atomicity Unit Tests', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  test('should accurately decrement stock when quantity is available', async () => {
    const productId = await productModel.createProduct({
      name: 'Inventory Test Item 1',
      price: 20,
      stock: 10,
    });

    const success = await productModel.decrementStockAtomically(productId, 4);
    expect(success).toBe(true);

    const updated = await productModel.findById(productId);
    expect(updated.stock).toBe(6);
  });

  test('should refuse decrement and return false when stock is insufficient', async () => {
    const productId = await productModel.createProduct({
      name: 'Inventory Test Item 2',
      price: 15,
      stock: 3,
    });

    const success = await productModel.decrementStockAtomically(productId, 5);
    expect(success).toBe(false);

    const unchanged = await productModel.findById(productId);
    expect(unchanged.stock).toBe(3);
  });

  test('should prevent stock from dropping below 0', async () => {
    const productId = await productModel.createProduct({
      name: 'Inventory Test Item 3',
      price: 10,
      stock: 1,
    });

    const first = await productModel.decrementStockAtomically(productId, 1);
    expect(first).toBe(true);

    const second = await productModel.decrementStockAtomically(productId, 1);
    expect(second).toBe(false);

    const final = await productModel.findById(productId);
    expect(final.stock).toBe(0);
  });
});
