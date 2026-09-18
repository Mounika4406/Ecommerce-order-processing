import { EventEmitter } from 'events';

// Isolated processor instance for controlled lifecycle
const processorEmitter = new EventEmitter();
processorEmitter.setMaxListeners(10);

/**
 * Memory-safe data processor.
 * Guarantees that resources and event listeners are properly detached after every operation.
 *
 * @param {Object|string} payload
 * @returns {Promise<{ status: string, processedAt: string, payloadSize: number }>}
 */
export async function processData(payload) {
  return new Promise((resolve) => {
    // Ephemeral handler using .once() to guarantee immediate detachment after execution
    processorEmitter.once('finish_task', (result) => {
      resolve(result);
    });

    const size = typeof payload === 'string' ? payload.length : JSON.stringify(payload).length;
    const result = {
      status: 'processed',
      processedAt: new Date().toISOString(),
      payloadSize: size,
    };

    processorEmitter.emit('finish_task', result);
  });
}
