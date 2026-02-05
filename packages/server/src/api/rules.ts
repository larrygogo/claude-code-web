import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authMiddleware, requireUser } from '../middleware/auth.js';
import { rulesService } from '../services/RulesService.js';

const router: RouterType = Router();

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

// 获取所有规则
router.get('/', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const rules = await rulesService.getUserRules(userId);
  res.json({ success: true, data: rules });
});

// 获取单个规则
router.get('/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const rule = await rulesService.getRule(userId, id);
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '规则不存在' },
    });
  }
});

// 创建规则
router.post('/', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);

  try {
    const data = createRuleSchema.parse(req.body);
    const rule = await rulesService.createRule(userId, data);
    res.status(201).json({ success: true, data: rule });
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
        error: { code: 'CONFLICT', message: '该名称的规则已存在' },
      });
      return;
    }
    throw error;
  }
});

// 更新规则
router.put('/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const data = updateRuleSchema.parse(req.body);
    const rule = await rulesService.updateRule(userId, id, data);
    res.json({ success: true, data: rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Rule not found') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '规则不存在' },
        });
        return;
      }
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: '该名称的规则已存在' },
        });
        return;
      }
    }
    throw error;
  }
});

// 删除规则
router.delete('/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    await rulesService.deleteRule(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Rule not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '规则不存在' },
      });
      return;
    }
    throw error;
  }
});

// 启用/禁用规则
router.put('/:id/toggle', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const rule = await rulesService.toggleRule(userId, id);
    res.json({ success: true, data: rule });
  } catch (error) {
    if (error instanceof Error && error.message === 'Rule not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '规则不存在' },
      });
      return;
    }
    throw error;
  }
});

export default router;
