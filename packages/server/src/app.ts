import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRouter from './api/auth.js';
import chatRouter from './api/chat.js';
import sessionsRouter from './api/sessions.js';
import projectsRouter from './api/projects.js';
import plansRouter from './api/plans.js';
import adminRouter from './api/admin.js';

export function createApp(): express.Application {
  const app = express();

  app.use(cors(config.cors));
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
