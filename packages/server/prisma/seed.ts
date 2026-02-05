import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// 从环境变量或默认 JWT secret 派生加密密钥
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  crypto.createHash('sha256').update(JWT_SECRET).digest();

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

async function main() {
  console.log('Starting seed...');

  // 1. 创建默认管理员账号
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await prisma.user.create({
      data: {
        email: adminEmail,
        username: 'Admin',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    // 确保已有用户是 admin
    if (existingAdmin.role !== 'admin') {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: 'admin' },
      });
      console.log(`Updated existing user ${adminEmail} to admin role`);
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }
  }

  // 2. 从环境变量迁移模型配置（如果有）
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  if (anthropicApiKey) {
    const existingConfig = await prisma.modelConfig.findFirst({
      where: { provider: 'anthropic', modelId: anthropicModel },
    });

    if (!existingConfig) {
      await prisma.modelConfig.create({
        data: {
          name: `Claude (${anthropicModel})`,
          provider: 'anthropic',
          modelId: anthropicModel,
          apiEndpoint: anthropicBaseUrl,
          apiKey: encryptApiKey(anthropicApiKey),
          isEnabled: true,
          isDefault: true,
          priority: 100,
          settings: '{}',
        },
      });
      console.log(`Created model config from environment: ${anthropicModel}`);
    } else {
      console.log(`Model config already exists: ${anthropicModel}`);
    }
  } else {
    console.log('No ANTHROPIC_API_KEY found, skipping model config creation');
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
