import express from 'express';
import cors from 'cors';
import { config, getOperationMode, getEnabledTools } from './config.js';
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
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 系统配置端点 - 无需认证
  app.get('/api/system/config', (_req, res) => {
    res.json({
      success: true,
      data: {
        operationMode: getOperationMode(),
        enabledTools: getEnabledTools(),
        features: {
          fileSystem: config.operationMode.enableFileSystem,
          bash: config.operationMode.enableBash,
        },
      },
    });
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
