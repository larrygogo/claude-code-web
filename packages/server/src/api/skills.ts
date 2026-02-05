import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authMiddleware, requireUser } from '../middleware/auth.js';
import { skillsService } from '../services/SkillsService.js';

const router: RouterType = Router();

const createSkillSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, '命令名称只能包含小写字母、数字和短横线'),
  description: z.string().max(200).optional(),
  prompt: z.string().min(1),
  enabled: z.boolean().optional(),
});

const updateSkillSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, '命令名称只能包含小写字母、数字和短横线').optional(),
  description: z.string().max(200).optional().nullable(),
  prompt: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

// 获取所有可用 Skills（内置 + 用户自定义）
router.get('/', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const skills = await skillsService.getAvailableSkills(userId);
  res.json({ success: true, data: skills });
});

// 获取用户自定义 Skills
router.get('/custom', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const skills = await skillsService.getUserSkills(userId);
  res.json({ success: true, data: skills });
});

// 创建用户自定义 Skill
router.post('/', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);

  try {
    const data = createSkillSchema.parse(req.body);
    const skill = await skillsService.createSkill(userId, {
      name: data.name,
      description: data.description || undefined,
      prompt: data.prompt,
      enabled: data.enabled,
    });
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: '该命令名称已存在' },
        });
        return;
      }
      if (error.message.includes('builtin')) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_NAME', message: '不能使用内置命令名称' },
        });
        return;
      }
    }
    throw error;
  }
});

// 更新用户自定义 Skill
router.put('/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    const data = updateSkillSchema.parse(req.body);
    const skill = await skillsService.updateSkill(userId, id, {
      name: data.name,
      description: data.description === null ? undefined : data.description,
      prompt: data.prompt,
      enabled: data.enabled,
    });
    res.json({ success: true, data: skill });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Skill not found') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '命令不存在' },
        });
        return;
      }
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: '该命令名称已存在' },
        });
        return;
      }
      if (error.message.includes('builtin')) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_NAME', message: '不能使用内置命令名称' },
        });
        return;
      }
    }
    throw error;
  }
});

// 删除用户自定义 Skill
router.delete('/:id', authMiddleware, async (req, res) => {
  const { userId } = requireUser(req);
  const { id } = req.params;

  try {
    await skillsService.deleteSkill(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Skill not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '命令不存在' },
      });
      return;
    }
    throw error;
  }
});

export default router;
