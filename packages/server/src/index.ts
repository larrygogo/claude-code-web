import { createApp } from './app.js';
import { config, validateConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './storage/Database.js';

async function main(): Promise<void> {
  validateConfig();

  await connectDatabase();

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      console.log('HTTP server closed');
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
