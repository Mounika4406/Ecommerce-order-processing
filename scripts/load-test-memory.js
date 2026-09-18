import { app } from '../src/app.js';

async function runMemoryLoadTest() {
  console.log('=== Starting 10,000 Sequential Requests Memory Stability Benchmark ===');

  const server = app.listen(0);
  const port = server.address().port;
  const targetUrl = `http://127.0.0.1:${port}/process-data`;

  // Warmup phase
  for (let i = 0; i < 50; i++) {
    await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmup: true }),
    });
  }

  if (global.gc) {
    global.gc();
  }

  const baselineMemory = process.memoryUsage();
  const baselineHeapUsedMB = (baselineMemory.heapUsed / 1024 / 1024).toFixed(2);
  console.log(`Baseline Heap Used: ${baselineHeapUsedMB} MB`);

  const TOTAL_REQUESTS = 10000;
  const reportInterval = 2500;

  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: `batch-${i}`,
        timestamp: Date.now(),
        payload: 'simulated-payload-chunk-'.repeat(4),
      }),
    });

    if (!res.ok) {
      throw new Error(`Request ${i} failed with status ${res.status}`);
    }

    if (i % reportInterval === 0) {
      const currentHeap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      console.log(`Progress: ${i}/${TOTAL_REQUESTS} requests completed | Current Heap: ${currentHeap} MB`);
    }
  }

  if (global.gc) {
    global.gc();
  }

  const finalMemory = process.memoryUsage();
  const finalHeapUsedMB = (finalMemory.heapUsed / 1024 / 1024).toFixed(2);
  const percentageIncrease = (
    ((finalMemory.heapUsed - baselineMemory.heapUsed) / baselineMemory.heapUsed) * 100
  ).toFixed(2);

  console.log('----------------------------------------------------');
  console.log(`Baseline Heap: ${baselineHeapUsedMB} MB`);
  console.log(`Final Heap (post-GC): ${finalHeapUsedMB} MB`);
  console.log(`Heap Growth: ${percentageIncrease}%`);

  server.close();

  if (parseFloat(percentageIncrease) <= 15.0) {
    console.log('✅ PASS: Memory consumption stabilized within the 15% threshold.');
    process.exit(0);
  } else {
    console.error(`❌ FAIL: Memory increased by ${percentageIncrease}%, exceeding the 15% threshold.`);
    process.exit(1);
  }
}

runMemoryLoadTest().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
