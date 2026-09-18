import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createOrder, listOrders } from './controllers/orderController.js';
import { handleProcessData } from './controllers/dataController.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Healthcheck endpoint for Docker Compose & monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Order Processing Endpoints
app.post('/orders', createOrder);
app.get('/orders', listOrders);

// Data Processing Endpoint
app.post('/process-data', handleProcessData);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
