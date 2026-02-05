import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  UserRole,
  UserStatus,
  UserListItem,
  UserListResponse,
  ModelConfigListItem,
  ModelConfig,
  ModelConfigInput,
  ModelConfigUpdateInput,
  DashboardStats,
  ModelProvider,
} from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/error.js';
import { config } from '../config.js';

const SALT_ROUNDS = 10;

// 加密密钥（从环境变量获取，或使用 JWT secret 派生）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  crypto.createHash('sha256').update(config.jwt.secret).digest();

/**
 * 加密 API Key
 */
function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密 API Key
 */
function decryptApiKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(':');
  if (!ivHex || !encrypted) {
    return encryptedKey; // 可能是未加密的旧数据
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class AdminService {
  // ==================== 用户管理 ====================

  /**
   * 分页查询用户列表
   */
  async listUsers(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<UserListResponse> {
    const db = getDatabase();
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { sessions: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role as UserRole,
        status: u.status as UserStatus,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        sessionCount: u._count.sessions,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
    currentUserId: string
  ): Promise<UserListItem> {
    if (userId === currentUserId) {
      throw new ValidationError('Cannot change your own status');
    }

    const db = getDatabase();
    const user = await db.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      sessionCount: user._count.sessions,
    };
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(
    userId: string,
    role: UserRole,
    currentUserId: string
  ): Promise<UserListItem> {
    if (userId === currentUserId) {
      throw new ValidationError('Cannot change your own role');
    }

    const db = getDatabase();
    const user = await db.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sessions: true },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      sessionCount: user._count.sessions,
    };
  }

  /**
   * 重置用户密码
   */
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    const db = getDatabase();
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: string, currentUserId: string): Promise<void> {
    if (userId === currentUserId) {
      throw new ValidationError('Cannot delete your own account');
    }

    const db = getDatabase();
    await db.user.delete({
      where: { id: userId },
    });
  }

  // ==================== 模型配置管理 ====================

  /**
   * 获取模型配置列表（不返回 API Key）
   */
  async listModelConfigs(): Promise<ModelConfigListItem[]> {
    const db = getDatabase();
    const configs = await db.modelConfig.findMany({
      orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        provider: true,
        modelId: true,
        apiEndpoint: true,
        isEnabled: true,
        isDefault: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return configs.map((c) => ({
      ...c,
      provider: c.provider as ModelProvider,
    }));
  }

  /**
   * 获取单个模型配置（不返回 API Key）
   */
  async getModelConfig(id: string): Promise<ModelConfigListItem> {
    const db = getDatabase();
    const config = await db.modelConfig.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        provider: true,
        modelId: true,
        apiEndpoint: true,
        isEnabled: true,
        isDefault: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      throw new NotFoundError('Model config');
    }

    return {
      ...config,
      provider: config.provider as ModelProvider,
    };
  }

  /**
   * 创建模型配置
   */
  async createModelConfig(input: ModelConfigInput): Promise<ModelConfigListItem> {
    const db = getDatabase();

    // 检查名称是否已存在
    const existing = await db.modelConfig.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new ConflictError('Model config name already exists');
    }

    // 如果设为默认，取消其他默认
    if (input.isDefault) {
      await db.modelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await db.modelConfig.create({
      data: {
        name: input.name,
        provider: input.provider,
        modelId: input.modelId,
        apiEndpoint: input.apiEndpoint,
        apiKey: encryptApiKey(input.apiKey),
        isEnabled: input.isEnabled ?? true,
        isDefault: input.isDefault ?? false,
        priority: input.priority ?? 0,
        settings: JSON.stringify(input.settings || {}),
      },
      select: {
        id: true,
        name: true,
        provider: true,
        modelId: true,
        apiEndpoint: true,
        isEnabled: true,
        isDefault: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...config,
      provider: config.provider as ModelProvider,
    };
  }

  /**
   * 更新模型配置
   */
  async updateModelConfig(
    id: string,
    input: ModelConfigUpdateInput
  ): Promise<ModelConfigListItem> {
    const db = getDatabase();

    // 检查是否存在
    const existing = await db.modelConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Model config');
    }

    // 如果修改名称，检查新名称是否已存在
    if (input.name && input.name !== existing.name) {
      const nameExists = await db.modelConfig.findUnique({
        where: { name: input.name },
      });
      if (nameExists) {
        throw new ConflictError('Model config name already exists');
      }
    }

    // 如果设为默认，取消其他默认
    if (input.isDefault) {
      await db.modelConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.provider !== undefined) updateData.provider = input.provider;
    if (input.modelId !== undefined) updateData.modelId = input.modelId;
    if (input.apiEndpoint !== undefined) updateData.apiEndpoint = input.apiEndpoint;
    if (input.apiKey !== undefined) updateData.apiKey = encryptApiKey(input.apiKey);
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.settings !== undefined) updateData.settings = JSON.stringify(input.settings);

    const config = await db.modelConfig.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        provider: true,
        modelId: true,
        apiEndpoint: true,
        isEnabled: true,
        isDefault: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...config,
      provider: config.provider as ModelProvider,
    };
  }

  /**
   * 删除模型配置
   */
  async deleteModelConfig(id: string): Promise<void> {
    const db = getDatabase();

    const config = await db.modelConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundError('Model config');
    }

    await db.modelConfig.delete({
      where: { id },
    });
  }

  /**
   * 获取活跃的模型配置（内部使用，包含解密的 API Key）
   * @param modelId 可选，指定模型 ID；否则返回默认或优先级最高的启用模型
   */
  async getActiveModelConfig(modelId?: string): Promise<ModelConfig | null> {
    const db = getDatabase();

    let config;

    if (modelId) {
      // 查找指定模型
      config = await db.modelConfig.findFirst({
        where: { modelId, isEnabled: true },
      });
    } else {
      // 查找默认模型或优先级最高的启用模型
      config = await db.modelConfig.findFirst({
        where: { isEnabled: true },
        orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
      });
    }

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      name: config.name,
      provider: config.provider as ModelProvider,
      modelId: config.modelId,
      apiEndpoint: config.apiEndpoint,
      apiKey: decryptApiKey(config.apiKey),
      isEnabled: config.isEnabled,
      isDefault: config.isDefault,
      priority: config.priority,
      settings: JSON.parse(config.settings),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  // ==================== 仪表板统计 ====================

  /**
   * 获取仪表板统计数据
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const db = getDatabase();

    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      totalSessions,
      totalProjects,
      totalModels,
      enabledModels,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'active' } }),
      db.user.count({ where: { status: 'disabled' } }),
      db.session.count(),
      db.project.count(),
      db.modelConfig.count(),
      db.modelConfig.count({ where: { isEnabled: true } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      disabledUsers,
      totalSessions,
      totalProjects,
      totalModels,
      enabledModels,
    };
  }
}

export const adminService = new AdminService();
