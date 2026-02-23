import { agent } from './agent/index.js';
import { createApiServer } from './api/server.js';
import { logger } from './utils/logger.js';

const { server } = createApiServer(agent);

agent.start().catch((error) => {
  logger.error('Failed to start trading agent', error);
  process.exit(1);
});

const shutdown = () => {
  logger.info('Shutting down');
  agent.stop();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
