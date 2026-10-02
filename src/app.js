import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { checkDbConnection } from './config/database.js';
import { listProducts } from './controllers/productController.js';
import {
  createOrder,
  listOrders,
  getOrderDetails,
  cancelOrderHandler,
} from './controllers/orderController.js';
import { handleProcessData } from './controllers/dataController.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Active health check verifying database connectivity
async function healthHandler(req, res) {
  try {
    await checkDbConnection();
    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

// Health check endpoints (root & /api)
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Products endpoints
app.get('/products', listProducts);
app.get('/api/products', listProducts);

// Orders endpoints
app.post('/orders', createOrder);
app.post('/api/orders', createOrder);

app.get('/orders', listOrders);
app.get('/api/orders', listOrders);

app.get('/orders/:orderId', getOrderDetails);
app.get('/api/orders/:orderId', getOrderDetails);

app.put('/orders/:orderId/cancel', cancelOrderHandler);
app.put('/api/orders/:orderId/cancel', cancelOrderHandler);

// Data Processing endpoint
app.post('/process-data', handleProcessData);
app.post('/api/process-data', handleProcessData);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
