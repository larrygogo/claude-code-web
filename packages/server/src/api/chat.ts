import { Router, Response } from 'express';
import { z } from 'zod';
import { ApiResponse } from '@claude-web/shared';
import { agentService } from '../services/AgentService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router = Router();

const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  message: z.string().min(1, 'Message is required'),
  permissionMode: z.enum(['plan', 'acceptEdits', 'default']).optional(),
});

router.post('/stream', authMiddleware, async (req, res: Response) => {
  const { userId } = requireUser(req);
  const request = chatRequestSchema.parse(req.body);

  let isCompleted = false;
  let activeSessionId: string | undefined = request.sessionId;

  req.on('close', () => {
    if (!isCompleted && activeSessionId) {
      agentService.abortSession(activeSessionId);
    }
  });

  try {
    const result = await agentService.streamChat(userId, request, res, (sessionId) => {
      activeSessionId = sessionId;
    });
    isCompleted = true;
    return result;
  } catch (error) {
    isCompleted = true;
    throw error;
  }
});

router.post('/abort/:sessionId', authMiddleware, async (req, res: { json: (data: ApiResponse<{ aborted: boolean }>) => void }) => {
  const { sessionId } = req.params;
  const aborted = await agentService.abortSession(sessionId);
  res.json({ success: true, data: { aborted } });
});

export default router;
