import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import {
  ApiResponse,
  SystemStatus,
  SetupModelInput,
  SetupAdminInput,
  SetupFeaturesInput,
  SetupAllInput,
  AuthResponse,
  SystemSettingKeys,
} from '@claude-web/shared';
import { asyncHandler } from '../middleware/error.js';
import { systemSettingService } from '../services/SystemSettingService.js';
import { adminService } from '../services/AdminService.js';
import { authService } from '../services/AuthService.js';
import { getDatabase } from '../storage/Database.js';
import { config } from '../config.js';

const router: RouterType = Router();

const SALT_ROUNDS = 10;

// ==================== 中间件 ====================

/**
 * 检查系统是否已初始化
 * 如果已初始化，则拒绝 setup 请求
 */
async function requireNotInitialized(
  _req: unknown,
  res: { status: (code: number) => { json: (data: ApiResponse) => void } },
  next: () => void
) {
  const initialized = await systemSettingService.isSystemInitialized();
  if (initialized) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ALREADY_INITIALIZED',
        message: 'System has already been initialized',
      },
    });
  }
  next();
}

// ==================== 公开端点 ====================

/**
 * GET /api/system/status
 * 获取系统状态（公开端点）
 */
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const initialized = await systemSettingService.isSystemInitialized();

    // 检查是否有可用的模型配置
    let hasModelConfig = false;
    try {
      const modelConfig = await adminService.getActiveModelConfig();
      hasModelConfig = !!modelConfig;
    } catch {
      hasModelConfig = false;
    }

    const status: SystemStatus = {
      initialized,
      version: '1.0.0',
      hasModelConfig,
    };

    res.json({
      success: true,
      data: status,
    } as ApiResponse<SystemStatus>);
  })
);

// ==================== 初始化端点（仅未初始化时可用） ====================

const setupModelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.literal('anthropic'),
  modelId: z.string().min(1),
  apiEndpoint: z.string().url(),
  apiKey: z.string().min(1),
});

/**
 * POST /api/setup/model
 * 配置模型（初始化步骤 1）
 */
router.post(
  '/model',
  asyncHandler(requireNotInitialized),
  asyncHandler(async (req, res) => {
    const input: SetupModelInput = setupModelSchema.parse(req.body);

    // 创建模型配置
    await adminService.createModelConfig({
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      apiEndpoint: input.apiEndpoint,
      apiKey: input.apiKey,
      isDefault: true,
      isEnabled: true,
    });

    res.json({
      success: true,
      data: { message: 'Model configured successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

const setupAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(2, 'Username must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/setup/admin
 * 创建管理员账号（初始化步骤 2）
 */
router.post(
  '/admin',
  asyncHandler(requireNotInitialized),
  asyncHandler(async (req, res) => {
    const input: SetupAdminInput = setupAdminSchema.parse(req.body);
    const db = getDatabase();

    // 检查是否已有管理员
    const existingAdmin = await db.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ADMIN_EXISTS',
          message: 'An admin user already exists',
        },
      });
    }

    // 检查邮箱是否已存在
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      });
    }

    // 创建管理员账号
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    await db.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    res.json({
      success: true,
      data: { message: 'Admin account created successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

const setupFeaturesSchema = z.object({
  enableFileSystem: z.boolean(),
  enableBash: z.boolean(),
  clientUrl: z.string().url().optional(),
});

/**
 * POST /api/setup/features
 * 配置功能开关（初始化步骤 3）
 */
router.post(
  '/features',
  asyncHandler(requireNotInitialized),
  asyncHandler(async (req, res) => {
    const input: SetupFeaturesInput = setupFeaturesSchema.parse(req.body);

    // 保存功能开关
    await systemSettingService.setFeatureFlags({
      fileSystem: input.enableFileSystem,
      bash: input.enableBash,
    });

    // 保存客户端 URL（如果提供）
    if (input.clientUrl) {
      await systemSettingService.set(
        SystemSettingKeys.CORS_CLIENT_URL,
        input.clientUrl,
        { category: 'cors' }
      );
    }

    res.json({
      success: true,
      data: { message: 'Features configured successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

/**
 * POST /api/setup/all
 * 一次性完成所有初始化配置并自动登录
 */
const setupAllSchema = z.object({
  model: setupModelSchema,
  admin: setupAdminSchema,
  features: setupFeaturesSchema,
});

router.post(
  '/all',
  asyncHandler(requireNotInitialized),
  asyncHandler(async (req, res) => {
    const input: SetupAllInput = setupAllSchema.parse(req.body);
    const db = getDatabase();

    // 在事务外预先计算哈希和加密（CPU 密集型，不涉及 DB）
    const passwordHash = await bcrypt.hash(input.admin.password, SALT_ROUNDS);
    const encryptionKey = crypto.createHash('sha256').update(config.jwt.secret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encryptedApiKey = cipher.update(input.model.apiKey, 'utf8', 'hex');
    encryptedApiKey = iv.toString('hex') + ':' + (encryptedApiKey + cipher.final('hex'));

    // 用事务包裹所有 DB 写操作，任何一步失败都会自动回滚
    let adminUser;
    try {
    adminUser = await db.$transaction(async (tx) => {
      // 1. 创建模型配置
      await tx.modelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      await tx.modelConfig.create({
        data: {
          name: input.model.name,
          provider: input.model.provider,
          modelId: input.model.modelId,
          apiEndpoint: input.model.apiEndpoint,
          apiKey: encryptedApiKey,
          isDefault: true,
          isEnabled: true,
          settings: '{}',
        },
      });

      // 2. 创建管理员账号
      const existingAdmin = await tx.user.findFirst({
        where: { role: 'admin' },
      });
      if (existingAdmin) {
        throw new Error('ADMIN_EXISTS');
      }

      const existingUser = await tx.user.findUnique({
        where: { email: input.admin.email },
      });
      if (existingUser) {
        throw new Error('EMAIL_EXISTS');
      }

      const user = await tx.user.create({
        data: {
          email: input.admin.email,
          username: input.admin.username,
          passwordHash,
          role: 'admin',
          status: 'active',
        },
      });

      // 3. 保存功能开关
      const settingsToUpsert: Array<{ key: string; value: string; category: string }> = [
        { key: SystemSettingKeys.FEATURES_ENABLE_FILE_SYSTEM, value: String(input.features.enableFileSystem), category: 'features' },
        { key: SystemSettingKeys.FEATURES_ENABLE_BASH, value: String(input.features.enableBash), category: 'features' },
        { key: SystemSettingKeys.SYSTEM_INITIALIZED, value: 'true', category: 'general' },
      ];

      if (input.features.clientUrl) {
        settingsToUpsert.push({
          key: SystemSettingKeys.CORS_CLIENT_URL,
          value: input.features.clientUrl,
          category: 'cors',
        });
      }

      for (const s of settingsToUpsert) {
        await tx.systemSetting.upsert({
          where: { key: s.key },
          create: { key: s.key, value: s.value, category: s.category, isSecret: false },
          update: { value: s.value, category: s.category },
        });
      }

      return user;
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'ADMIN_EXISTS') {
        return res.status(400).json({
          success: false,
          error: { code: 'ADMIN_EXISTS', message: 'An admin user already exists' },
        });
      }
      if (message === 'EMAIL_EXISTS') {
        return res.status(400).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
        });
      }
      throw error;
    }

    // 清除 systemSettingService 缓存，使后续读取能拿到最新值
    systemSettingService.clearCache();

    // 事务成功后，自动登录管理员
    try {
      const tokens = await authService.generateTokens({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
      const authResponse: AuthResponse = {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          username: adminUser.username,
          role: adminUser.role as 'user' | 'admin',
          status: adminUser.status as 'active' | 'disabled',
          settings: JSON.parse(adminUser.settings),
          createdAt: adminUser.createdAt,
          updatedAt: adminUser.updatedAt,
        },
        tokens,
      };

      return res.json({
        success: true,
        data: authResponse,
      } as ApiResponse<AuthResponse>);
    } catch (error) {
      console.warn('[Setup] Auto-login failed:', error);
    }

    res.json({
      success: true,
      data: { message: 'Setup completed successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

/**
 * POST /api/setup/complete
 * 完成初始化并自动登录
 */
router.post(
  '/complete',
  asyncHandler(requireNotInitialized),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    // 验证所有必要配置已完成
    // 1. 检查模型配置
    const modelConfig = await adminService.getActiveModelConfig();
    if (!modelConfig) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MODEL_CONFIG',
          message: 'Please configure a model first',
        },
      });
    }

    // 2. 检查管理员账号
    const admin = await db.user.findFirst({
      where: { role: 'admin' },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADMIN',
          message: 'Please create an admin account first',
        },
      });
    }

    // 标记系统已初始化
    await systemSettingService.markAsInitialized();

    // 自动登录管理员
    const { email } = req.body;
    if (email) {
      try {
        // 使用邮箱获取用户并生成 token
        const user = await db.user.findUnique({
          where: { email },
        });

        if (user) {
          const tokens = await authService.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role,
          });
          const authResponse: AuthResponse = {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              role: user.role as 'user' | 'admin',
              status: user.status as 'active' | 'disabled',
              settings: JSON.parse(user.settings),
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            tokens,
          };

          return res.json({
            success: true,
            data: authResponse,
          } as ApiResponse<AuthResponse>);
        }
      } catch (error) {
        console.warn('[Setup] Auto-login failed:', error);
      }
    }

    res.json({
      success: true,
      data: { message: 'Setup completed successfully' },
    } as ApiResponse<{ message: string }>);
  })
);

export default router;
