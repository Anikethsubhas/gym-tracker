import { config } from './config';
import { pool } from './db/pool';
import { createApp } from './app';
import { startScheduler } from './services/scheduler';

const server = createApp().listen(config.port, () => {
  console.log(`Gym tracker API listening on http://localhost:${config.port}`);
  console.log(`Messaging mode: ${config.messaging.dryRun ? 'TEST (nothing is sent)' : 'LIVE'}`);
  if (config.runScheduler) startScheduler();
});

const shutdown = () => {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
