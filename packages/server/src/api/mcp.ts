import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authMiddleware, requireUser } from '../middleware/auth.js';
import { mcpService } from '../services/McpService.js';

const router: RouterType = Router();

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional().nullable(),
  enabled: z.boolean().optional(),
});

// 获取所有 MCP 服务器
router.get('/servers', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const servers = await mcpService.getServers(userId);
  res.json({ success: true, data: servers });
});

// 获取单个服务器
router.get('/servers/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const server = await mcpService.getServer(userId, id);
    res.json({ success: true, data: server });
  } catch (error) {
    if (error instanceof Error && error.message === 'MCP server not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
      });
      return;
    }
    throw error;
  }
});

// 创建 MCP 服务器
router.post('/servers', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);

  try {
    const data = createServerSchema.parse(req.body);
    const server = await mcpService.createServer(userId, data);
    res.status(201).json({ success: true, data: server });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: '该名称的服务器已存在' },
      });
      return;
    }
    throw error;
  }
});

// 更新 MCP 服务器
router.put('/servers/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const data = updateServerSchema.parse(req.body);
    const server = await mcpService.updateServer(userId, id, {
      ...data,
      env: data.env === null ? undefined : data.env,
    });
    res.json({ success: true, data: server });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    if (error instanceof Error && error.message === 'MCP server not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
      });
      return;
    }
    throw error;
  }
});

// 删除 MCP 服务器
router.delete('/servers/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    await mcpService.deleteServer(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'MCP server not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
      });
      return;
    }
    throw error;
  }
});

// 启动 MCP 服务器
router.post('/servers/:id/start', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const server = await mcpService.startServer(userId, id);
    res.json({ success: true, data: server });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'MCP server not found') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'START_FAILED', message: `启动失败: ${error.message}` },
      });
      return;
    }
    throw error;
  }
});

// 停止 MCP 服务器
router.post('/servers/:id/stop', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const server = await mcpService.stopServer(userId, id);
    res.json({ success: true, data: server });
  } catch (error) {
    if (error instanceof Error && error.message === 'MCP server not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
      });
      return;
    }
    throw error;
  }
});

// 获取服务器工具列表
router.get('/servers/:id/tools', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const tools = await mcpService.getServerTools(userId, id);
    res.json({ success: true, data: tools });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'MCP server not found') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'MCP 服务器不存在' },
        });
        return;
      }
      if (error.message === 'Server not running') {
        res.status(400).json({
          success: false,
          error: { code: 'NOT_RUNNING', message: '服务器未运行' },
        });
        return;
      }
    }
    throw error;
  }
});

export default router;
