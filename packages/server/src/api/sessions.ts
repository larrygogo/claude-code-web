import { Router } from 'express';
import { z } from 'zod';
import {
  ApiResponse,
  Session,
  SessionWithMessages,
  SessionListItem,
} from '@claude-web/shared';
import { sessionService } from '../services/SessionService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router = Router();

const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

const forkSessionSchema = z.object({
  messageIndex: z.number().int().min(0, 'Message index must be non-negative'),
});

const importSessionSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  title: z.string().optional(),
});

router.get('/', authMiddleware, async (req, res: { json: (data: ApiResponse<SessionListItem[]>) => void }) => {
  const { userId } = requireUser(req);
  const projectId = req.query.projectId as string | undefined;
  const sessions = await sessionService.listSessions(userId, projectId);
  res.json({ success: true, data: sessions });
});

router.post('/', authMiddleware, async (req, res: { json: (data: ApiResponse<Session>) => void }) => {
  const { userId } = requireUser(req);
  const input = createSessionSchema.parse(req.body);
  const session = await sessionService.createSession(userId, input);
  res.json({ success: true, data: session });
});

router.get('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse<SessionWithMessages>) => void }) => {
  const { userId } = requireUser(req);
  const session = await sessionService.getSession(userId, req.params.id);
  res.json({ success: true, data: session });
});

router.patch('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse<Session>) => void }) => {
  const { userId } = requireUser(req);
  const { title } = updateSessionSchema.parse(req.body);
  const session = await sessionService.updateSessionTitle(userId, req.params.id, title);
  res.json({ success: true, data: session });
});

router.delete('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse) => void }) => {
  const { userId } = requireUser(req);
  await sessionService.deleteSession(userId, req.params.id);
  res.json({ success: true });
});

router.post('/:id/fork', authMiddleware, async (req, res: { json: (data: ApiResponse<Session>) => void }) => {
  const { userId } = requireUser(req);
  const { messageIndex } = forkSessionSchema.parse(req.body);
  const session = await sessionService.forkSession(userId, req.params.id, messageIndex);
  res.json({ success: true, data: session });
});

router.post('/import', authMiddleware, async (req, res: { json: (data: ApiResponse<Session>) => void }) => {
  const { userId } = requireUser(req);
  const { filePath, title } = importSessionSchema.parse(req.body);
  const session = await sessionService.importCliSession(userId, filePath, title);
  res.json({ success: true, data: session });
});

export default router;
