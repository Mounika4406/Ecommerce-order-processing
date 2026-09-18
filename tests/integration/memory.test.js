import request from 'supertest';
import { app } from '../../src/app.js';

describe('Data Processing Memory Leak & Stability Tests', () => {
  test('should return 200 OK for POST /process-data without leaking', async () => {
    const res = await request(app)
      .post('/process-data')
      .send({ batchId: 'batch-001', payload: 'sample data stream' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('processed');
  });

  test('should maintain stable memory consumption under sustained request load', async () => {
    // Prime the endpoint
    await request(app).post('/process-data').send({ test: 'warmup' });

    if (global.gc) {
      global.gc();
    }
    const baselineHeap = process.memoryUsage().heapUsed;

    // Send batches of sequential requests
    const ITERATIONS = 100;
    for (let i = 0; i < ITERATIONS; i++) {
      const res = await request(app)
        .post('/process-data')
        .send({ index: i, timestamp: Date.now(), data: 'x'.repeat(64) });
      expect(res.status).toBe(200);
    }

    if (global.gc) {
      global.gc();
    }
    const finalHeap = process.memoryUsage().heapUsed;

    // Contract requirement: memory must stabilize and avoid unbound growth (e.g. OOM or 2x leak)
    expect(finalHeap).toBeLessThan(baselineHeap * 2.0);
  });
});
