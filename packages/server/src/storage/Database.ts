import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

let prismaInstance: PrismaClient;

export function getDatabase(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

// 导出 prisma 实例供其他服务使用
export const prisma = getDatabase();

export async function connectDatabase(): Promise<void> {
  const db = getDatabase();
  await db.$connect();

  // 检查表结构是否存在，不存在则自动初始化
  try {
    await db.$queryRaw`SELECT 1 FROM system_settings LIMIT 1`;
  } catch {
    console.log('Database tables not found, initializing schema...');
    const schemaPath = path.resolve(
      import.meta.dirname ?? __dirname,
      '../../prisma/schema.prisma'
    );
    execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate`, {
      stdio: 'inherit',
    });
    console.log('Database schema initialized');
  }

  console.log('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    console.log('Database disconnected');
  }
}
