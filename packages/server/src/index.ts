import { createApp } from './app.js';
import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './storage/Database.js';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const host = '0.0.0.0';
  const server = app.listen(config.port, host, () => {
    console.log(`Server running on http://${host}:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  // Increase timeout for SSE connections (10 minutes)
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;
  server.headersTimeout = 610000;

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
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
