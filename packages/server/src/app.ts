import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { systemSettingService } from './services/SystemSettingService.js';
import authRouter from './api/auth.js';
import chatRouter from './api/chat.js';
import sessionsRouter from './api/sessions.js';
import projectsRouter from './api/projects.js';
import plansRouter from './api/plans.js';
import adminRouter from './api/admin.js';
import rulesRouter from './api/rules.js';
import skillsRouter from './api/skills.js';
import mcpRouter from './api/mcp.js';
import configRouter from './api/config.js';
import setupRouter from './api/setup.js';
import systemSettingsRouter from './api/systemSettings.js';

export function createApp(): express.Application {
  const app = express();

  app.use(cors(config.cors));
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 系统配置端点 - 无需认证，从数据库读取
  app.get('/api/system/config', async (_req, res) => {
    try {
      const features = await systemSettingService.getFeatureFlags();

      // 根据功能开关计算操作模式和工具列表
      const operationMode = features.fileSystem && features.bash ? 'full' : 'restricted';
      const enabledTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
      if (features.fileSystem) {
        enabledTools.push('Write', 'Edit');
      }
      if (features.bash) {
        enabledTools.push('Bash');
      }

      res.json({
        success: true,
        data: {
          operationMode,
          enabledTools,
          features: {
            fileSystem: features.fileSystem,
            bash: features.bash,
          },
        },
      });
    } catch (error) {
      console.error('[App] Failed to get config from database:', error);
      // 数据库访问失败时返回默认值（全功能启用）
      res.json({
        success: true,
        data: {
          operationMode: 'full',
          enabledTools: ['Read', 'Glob', 'Grep', 'WebFetch', 'Write', 'Edit', 'Bash'],
          features: {
            fileSystem: true,
            bash: true,
          },
        },
      });
    }
  });

  // 初始化 API（公开端点）
  app.use('/api/setup', setupRouter);
  app.use('/api/system', setupRouter);

  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/settings', systemSettingsRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/mcp', mcpRouter);
  app.use('/api/config', configRouter);

  // 生产环境：托管前端静态文件
  const clientDistPath = path.resolve(process.cwd(), '../../packages/client/dist');
  if (config.nodeEnv === 'production' && fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath, { index: false }));

    // SPA fallback：非 API 路由返回 index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
