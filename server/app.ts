import express from 'express';
import { createCommunicationRouter } from './realtimeServer.ts';
import { createAuthRouter } from './authRouter.ts';
import { createStorageRouter } from './storageRouter.ts';

export function createEverlyApp() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Mount Communication API, Auth API, and Storage API
  // Dual-mounted (/api/* and bare prefix) for resilient path resolution
  app.use('/api/comm', createCommunicationRouter());
  app.use('/comm', createCommunicationRouter());

  app.use('/api/auth', createAuthRouter());
  app.use('/auth', createAuthRouter());

  app.use('/api/storage', createStorageRouter());
  app.use('/storage', createStorageRouter());

  return app;
}
