import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { ApiResponse, AuthResponse, User, UserSettings } from '@claude-web/shared';
import { authService } from '../services/AuthService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router: RouterType = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

router.post('/login', async (req, res: { json: (data: ApiResponse<AuthResponse>) => void }, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res: { json: (data: ApiResponse<{ tokens: import('@claude-web/shared').AuthTokens }>) => void }, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshToken(refreshToken);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res: { json: (data: ApiResponse) => void }, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, async (req, res: { json: (data: ApiResponse<User>) => void }, next) => {
  try {
    const { userId } = requireUser(req);
    const user = await authService.getCurrentUser(userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

router.patch('/settings', authMiddleware, async (req, res: { json: (data: ApiResponse<UserSettings>) => void }, next) => {
  try {
    const { userId } = requireUser(req);
    const input = settingsSchema.parse(req.body);
    const settings = await authService.updateSettings(userId, input);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

export default router;
