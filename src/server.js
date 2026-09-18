import dotenv from 'dotenv';
import { app } from './app.js';
import { initDb, closeDb } from './config/database.js';
import * as productModel from './models/productModel.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDb();
    console.log('Database initialized successfully');

    // Seed default product if empty for easy development/testing
    const products = await productModel.getAllProducts();
    if (products.length === 0) {
      await productModel.createProduct({
        name: 'Standard E-Commerce Widget',
        price: 25.0,
        stock: 100,
      });
      console.log('Default product seeded (Stock: 100)');
    }

    const server = app.listen(PORT, () => {
      console.log(`E-Commerce Order Service listening on port ${PORT}`);
    });

    const shutdown = async () => {
      console.log('Gracefully shutting down...');
      server.close(async () => {
        await closeDb();
        console.log('Service shut down gracefully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
