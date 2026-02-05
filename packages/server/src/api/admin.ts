import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authMiddleware, requireUser } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { asyncHandler } from '../middleware/error.js';
import { adminService } from '../services/AdminService.js';
import { ApiResponse, UserListResponse, UserListItem, ModelConfigListItem, DashboardStats } from '@claude-web/shared';

const router: RouterType = Router();

// 所有 admin 路由都需要认证和管理员权限
router.use(authMiddleware);
router.use(asyncHandler(adminMiddleware));

// ==================== 仪表板 ====================

/**
 * GET /api/admin/dashboard
 * 获取仪表板统计数据
 */
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await adminService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    } as ApiResponse<DashboardStats>);
  })
);

// ==================== 用户管理 ====================

const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

/**
 * GET /api/admin/users
 * 获取用户列表
 */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, search } = listUsersSchema.parse(req.query);
    const result = await adminService.listUsers(page, limit, search);

    res.json({
      success: true,
      data: result,
    } as ApiResponse<UserListResponse>);
  })
);

const updateStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

/**
 * PATCH /api/admin/users/:id/status
 * 更新用户状态
 */
router.patch(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);

    const updatedUser = await adminService.updateUserStatus(id, status, user.userId);

    res.json({
      success: true,
      data: updatedUser,
    } as ApiResponse<UserListItem>);
  })
);

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

/**
 * PATCH /api/admin/users/:id/role
 * 更新用户角色
 */
router.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    const updatedUser = await adminService.updateUserRole(id, role, user.userId);

    res.json({
      success: true,
      data: updatedUser,
    } as ApiResponse<UserListItem>);
  })
);

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

/**
 * POST /api/admin/users/:id/reset-password
 * 重置用户密码
 */
router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = resetPasswordSchema.parse(req.body);

    await adminService.resetUserPassword(id, newPassword);

    res.json({
      success: true,
      data: { message: 'Password reset successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

/**
 * DELETE /api/admin/users/:id
 * 删除用户
 */
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { id } = req.params;

    await adminService.deleteUser(id, user.userId);

    res.json({
      success: true,
      data: { message: 'User deleted successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

// ==================== 模型配置管理 ====================

/**
 * GET /api/admin/models
 * 获取模型配置列表
 */
router.get(
  '/models',
  asyncHandler(async (_req, res) => {
    const models = await adminService.listModelConfigs();

    res.json({
      success: true,
      data: models,
    } as ApiResponse<ModelConfigListItem[]>);
  })
);

const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['anthropic', 'openai', 'custom']),
  modelId: z.string().min(1),
  apiEndpoint: z.string().url(),
  apiKey: z.string().min(1),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * POST /api/admin/models
 * 创建模型配置
 */
router.post(
  '/models',
  asyncHandler(async (req, res) => {
    const input = createModelSchema.parse(req.body);
    const model = await adminService.createModelConfig(input);

    res.status(201).json({
      success: true,
      data: model,
    } as ApiResponse<ModelConfigListItem>);
  })
);

/**
 * GET /api/admin/models/:id
 * 获取单个模型配置
 */
router.get(
  '/models/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const model = await adminService.getModelConfig(id);

    res.json({
      success: true,
      data: model,
    } as ApiResponse<ModelConfigListItem>);
  })
);

const updateModelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.enum(['anthropic', 'openai', 'custom']).optional(),
  modelId: z.string().min(1).optional(),
  apiEndpoint: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/admin/models/:id
 * 更新模型配置
 */
router.patch(
  '/models/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const input = updateModelSchema.parse(req.body);
    const model = await adminService.updateModelConfig(id, input);

    res.json({
      success: true,
      data: model,
    } as ApiResponse<ModelConfigListItem>);
  })
);

/**
 * DELETE /api/admin/models/:id
 * 删除模型配置
 */
router.delete(
  '/models/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await adminService.deleteModelConfig(id);

    res.json({
      success: true,
      data: { message: 'Model config deleted successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

export default router;
