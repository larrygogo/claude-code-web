import crypto from 'crypto';
import {
  SystemSettingListItem,
  SystemSettingKeys,
  SystemFeatures,
} from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { config } from '../config.js';

// 缓存条目的有效期（毫秒）
const CACHE_TTL = 60 * 1000; // 1 分钟

// 加密密钥（惰性求值，确保 config 已初始化）
let _encryptionKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    _encryptionKey = crypto.createHash('sha256').update(config.jwt.secret).digest();
  }
  return _encryptionKey;
}

/**
 * 加密敏感数据
 */
function encrypt(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 解密敏感数据
 */
function decrypt(encryptedValue: string): string {
  const [ivHex, encrypted] = encryptedValue.split(':');
  if (!ivHex || !encrypted) {
    return encryptedValue; // 可能是未加密的旧数据
  }
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedValue; // 解密失败，返回原值
  }
}

interface CacheEntry {
  value: string;
  expiry: number;
}

export class SystemSettingService {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * 获取配置值（带缓存）
   */
  async get(key: string, defaultValue?: string): Promise<string | null> {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const db = getDatabase();
    const setting = await db.systemSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return defaultValue ?? null;
    }

    // 解密敏感数据
    const value = setting.isSecret ? decrypt(setting.value) : setting.value;

    // 更新缓存
    this.cache.set(key, {
      value,
      expiry: Date.now() + CACHE_TTL,
    });

    return value;
  }

  /**
   * 获取布尔配置值
   */
  async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
    const value = await this.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  }

  /**
   * 设置配置值
   */
  async set(
    key: string,
    value: string,
    options?: { isSecret?: boolean; category?: string }
  ): Promise<void> {
    const db = getDatabase();
    const isSecret = options?.isSecret ?? false;
    const category = options?.category ?? this.getCategoryFromKey(key);

    // 加密敏感数据
    const storedValue = isSecret ? encrypt(value) : value;

    await db.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: storedValue,
        category,
        isSecret,
      },
      update: {
        value: storedValue,
        category,
        isSecret,
      },
    });

    // 清除缓存
    this.cache.delete(key);
  }

  /**
   * 批量设置配置值
   */
  async setMany(
    settings: Array<{ key: string; value: string; isSecret?: boolean; category?: string }>
  ): Promise<void> {
    const db = getDatabase();

    for (const setting of settings) {
      const isSecret = setting.isSecret ?? false;
      const category = setting.category ?? this.getCategoryFromKey(setting.key);
      const storedValue = isSecret ? encrypt(setting.value) : setting.value;

      await db.systemSetting.upsert({
        where: { key: setting.key },
        create: {
          key: setting.key,
          value: storedValue,
          category,
          isSecret,
        },
        update: {
          value: storedValue,
          category,
          isSecret,
        },
      });

      // 清除缓存
      this.cache.delete(setting.key);
    }
  }

  /**
   * 删除配置
   */
  async delete(key: string): Promise<void> {
    const db = getDatabase();
    await db.systemSetting.deleteMany({
      where: { key },
    });
    this.cache.delete(key);
  }

  /**
   * 获取所有设置（用于管理界面）
   */
  async getAll(): Promise<SystemSettingListItem[]> {
    const db = getDatabase();
    const settings = await db.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: s.isSecret ? '******' : s.value,
      category: s.category,
      isSecret: s.isSecret,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * 按分类获取设置
   */
  async getByCategory(category: string): Promise<SystemSettingListItem[]> {
    const db = getDatabase();
    const settings = await db.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      id: s.id,
      key: s.key,
      value: s.isSecret ? '******' : s.value,
      category: s.category,
      isSecret: s.isSecret,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * 检查系统是否已初始化
   */
  async isSystemInitialized(): Promise<boolean> {
    return this.getBoolean(SystemSettingKeys.SYSTEM_INITIALIZED, false);
  }

  /**
   * 标记系统已初始化
   */
  async markAsInitialized(): Promise<void> {
    await this.set(SystemSettingKeys.SYSTEM_INITIALIZED, 'true', { category: 'general' });
  }

  /**
   * 获取功能开关
   */
  async getFeatureFlags(): Promise<SystemFeatures> {
    const [enableFileSystem, enableBash] = await Promise.all([
      this.getBoolean(SystemSettingKeys.FEATURES_ENABLE_FILE_SYSTEM, true),
      this.getBoolean(SystemSettingKeys.FEATURES_ENABLE_BASH, true),
    ]);

    return {
      fileSystem: enableFileSystem,
      bash: enableBash,
    };
  }

  /**
   * 设置功能开关
   */
  async setFeatureFlags(features: Partial<SystemFeatures>): Promise<void> {
    const settings: Array<{ key: string; value: string; category: string }> = [];

    if (features.fileSystem !== undefined) {
      settings.push({
        key: SystemSettingKeys.FEATURES_ENABLE_FILE_SYSTEM,
        value: String(features.fileSystem),
        category: 'features',
      });
    }

    if (features.bash !== undefined) {
      settings.push({
        key: SystemSettingKeys.FEATURES_ENABLE_BASH,
        value: String(features.bash),
        category: 'features',
      });
    }

    if (settings.length > 0) {
      await this.setMany(settings);
    }
  }

  /**
   * 获取 CORS 客户端 URL
   */
  async getClientUrl(): Promise<string> {
    const url = await this.get(SystemSettingKeys.CORS_CLIENT_URL);
    return url || 'http://localhost:3000';
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 根据 key 推断分类
   */
  private getCategoryFromKey(key: string): string {
    if (key.startsWith('features.')) return 'features';
    if (key.startsWith('cors.')) return 'cors';
    if (key.startsWith('system.')) return 'general';
    return 'general';
  }
}

export const systemSettingService = new SystemSettingService();
