import dotenv from 'dotenv';
import { app } from './app.js';
import { initDb, closeDb } from './config/database.js';

dotenv.config();

const PORT = process.env.PORT || process.env.API_PORT || 3000;

async function start() {
  try {
    await initDb();
    console.log('Database initialized successfully');

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
