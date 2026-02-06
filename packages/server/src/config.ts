import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 设置环境变量默认值（在 dotenv 之前，允许 .env 覆盖）
const DEFAULT_DATABASE_URL = 'file:./data/db/claude-web.db';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const dataDir = process.env.DATA_DIR || './data/claude-web';

/**
 * 获取 JWT 密钥
 * - 开发环境：使用固定值
 * - 生产环境：首次启动自动生成随机密钥并持久化到文件
 */
function getJwtSecrets(): { secret: string; refreshSecret: string } {
  if (nodeEnv !== 'production') {
    return {
      secret: 'dev-jwt-secret-fixed-value',
      refreshSecret: 'dev-refresh-secret-fixed-value',
    };
  }

  const secretsPath = path.resolve(dataDir, '.jwt-secrets.json');

  try {
    const data = fs.readFileSync(secretsPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed.secret && parsed.refreshSecret) {
      return parsed;
    }
  } catch {
    // 文件不存在或读取失败，继续生成
  }

  // 首次启动：生成随机密钥并写入文件
  const secrets = {
    secret: crypto.randomBytes(64).toString('base64'),
    refreshSecret: crypto.randomBytes(64).toString('base64'),
  };

  fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
  fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  console.log('[Config] Generated new JWT secrets for production');

  return secrets;
}

const jwtSecrets = getJwtSecrets();

/**
 * 静态配置（启动前读取）
 * 仅包含启动必需的配置项，其他配置通过数据库管理
 */
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,

  jwt: {
    secret: jwtSecrets.secret,
    refreshSecret: jwtSecrets.refreshSecret,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },

  dataDir,

  // 默认客户端 URL（仅用于启动时的 CORS 初始值，运行时从数据库读取）
  defaultClientUrl: process.env.CLIENT_URL || `http://localhost:${process.env.CLIENT_PORT || '3000'}`,

  cors: {
    origin: process.env.CLIENT_URL || `http://localhost:${process.env.CLIENT_PORT || '3000'}`,
    credentials: true,
  },
};

// ============================================================
// 动态配置函数（从数据库读取）
// 注意：不在模块顶层导入 SystemSettingService，避免循环依赖
// ============================================================

async function getSystemSettingService() {
  const { systemSettingService } = await import('./services/SystemSettingService.js');
  return systemSettingService;
}

/**
 * 获取动态配置（从数据库）
 */
export async function getDynamicConfig() {
  const svc = await getSystemSettingService();
  const features = await svc.getFeatureFlags();
  const clientUrl = await svc.getClientUrl();

  return {
    features,
    clientUrl,
    cors: { origin: clientUrl },
  };
}

/**
 * 获取启用的工具列表（从数据库）
 */
export async function getEnabledTools(): Promise<string[]> {
  const svc = await getSystemSettingService();
  const features = await svc.getFeatureFlags();
  // 只读工具：始终启用
  const tools: string[] = [
    'Read', 'Glob', 'Grep', 'WebFetch',
    'Ls', 'FileTree', 'Find', 'Diff',
    'GitStatus', 'GitDiff', 'GitLog',
    'WebSearch',
    'TodoRead',
  ];

  if (features.fileSystem) {
    tools.push('Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'TodoWrite');
  }

  if (features.bash) {
    tools.push('Bash');
  }

  return tools;
}

/**
 * 获取操作模式（从数据库）
 */
export async function getOperationMode(): Promise<'full' | 'restricted'> {
  const svc = await getSystemSettingService();
  const features = await svc.getFeatureFlags();
  return features.fileSystem && features.bash ? 'full' : 'restricted';
}

/**
 * 检查工具是否启用（从数据库）
 */
export async function isToolEnabled(toolName: string): Promise<boolean> {
  const enabledTools = await getEnabledTools();
  return enabledTools.includes(toolName);
}
