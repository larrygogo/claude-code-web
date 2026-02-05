import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getDatabase(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

export async function connectDatabase(): Promise<void> {
  const db = getDatabase();
  await db.$connect();
  console.log('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    console.log('Database disconnected');
  }
}
