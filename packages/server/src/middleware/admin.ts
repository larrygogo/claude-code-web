import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from './error.js';
import { getDatabase } from '../storage/Database.js';

/**
 * 管理员权限中间件
 * 检查用户是否为 admin 角色且状态为 active
 */
export async function adminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const db = getDatabase();
  const user = await db.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true, status: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (user.status !== 'active') {
    throw new ForbiddenError('Account is disabled');
  }

  if (user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }

  next();
}
