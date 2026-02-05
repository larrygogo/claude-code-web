import { PrismaClient } from '@prisma/client';

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
  console.log('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    console.log('Database disconnected');
  }
}
