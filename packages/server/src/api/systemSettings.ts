import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  ApiResponse,
  SystemSettingListItem,
  UpdateSystemSettingsInput,
  SystemSettingKeys,
} from '@claude-web/shared';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { asyncHandler } from '../middleware/error.js';
import { systemSettingService } from '../services/SystemSettingService.js';

const router: RouterType = Router();

// 所有路由都需要认证和管理员权限
router.use(authMiddleware);
router.use(asyncHandler(adminMiddleware));

/**
 * GET /api/admin/settings
 * 获取所有系统设置
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await systemSettingService.getAll();

    res.json({
      success: true,
      data: settings,
    } as ApiResponse<SystemSettingListItem[]>);
  })
);

/**
 * GET /api/admin/settings/category/:category
 * 按分类获取系统设置
 */
router.get(
  '/category/:category',
  asyncHandler(async (req, res) => {
    const { category } = req.params;
    const settings = await systemSettingService.getByCategory(category);

    res.json({
      success: true,
      data: settings,
    } as ApiResponse<SystemSettingListItem[]>);
  })
);

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    })
  ),
});

/**
 * PATCH /api/admin/settings
 * 批量更新系统设置
 */
router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const input: UpdateSystemSettingsInput = updateSettingsSchema.parse(req.body);

    // 定义哪些 key 是敏感的
    const secretKeys = new Set<string>([
      // 可以在这里添加需要加密的 key
    ]);

    // 更新每个设置
    for (const setting of input.settings) {
      const isSecret = secretKeys.has(setting.key);
      await systemSettingService.set(setting.key, setting.value, { isSecret });
    }

    // 返回更新后的设置
    const updatedSettings = await systemSettingService.getAll();

    res.json({
      success: true,
      data: updatedSettings,
    } as ApiResponse<SystemSettingListItem[]>);
  })
);

/**
 * GET /api/admin/settings/features
 * 获取功能开关设置
 */
router.get(
  '/features',
  asyncHandler(async (_req, res) => {
    const features = await systemSettingService.getFeatureFlags();

    res.json({
      success: true,
      data: features,
    } as ApiResponse<{ fileSystem: boolean; bash: boolean }>);
  })
);

const updateFeaturesSchema = z.object({
  fileSystem: z.boolean().optional(),
  bash: z.boolean().optional(),
});

/**
 * PATCH /api/admin/settings/features
 * 更新功能开关设置
 */
router.patch(
  '/features',
  asyncHandler(async (req, res) => {
    const input = updateFeaturesSchema.parse(req.body);

    await systemSettingService.setFeatureFlags(input);

    const features = await systemSettingService.getFeatureFlags();

    res.json({
      success: true,
      data: features,
    } as ApiResponse<{ fileSystem: boolean; bash: boolean }>);
  })
);

/**
 * GET /api/admin/settings/cors
 * 获取 CORS 配置
 */
router.get(
  '/cors',
  asyncHandler(async (_req, res) => {
    const clientUrl = await systemSettingService.getClientUrl();

    res.json({
      success: true,
      data: { clientUrl },
    } as ApiResponse<{ clientUrl: string }>);
  })
);

const updateCorsSchema = z.object({
  clientUrl: z.string().url(),
});

/**
 * PATCH /api/admin/settings/cors
 * 更新 CORS 配置
 */
router.patch(
  '/cors',
  asyncHandler(async (req, res) => {
    const { clientUrl } = updateCorsSchema.parse(req.body);

    await systemSettingService.set(
      SystemSettingKeys.CORS_CLIENT_URL,
      clientUrl,
      { category: 'cors' }
    );

    res.json({
      success: true,
      data: { clientUrl },
    } as ApiResponse<{ clientUrl: string }>);
  })
);

export default router;
