import { Router, Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { ApiResponse } from '@claude-web/shared';
import { agentService } from '../services/AgentService.js';
import { skillsService } from '../services/SkillsService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router: RouterType = Router();

const attachmentSchema = z.object({
  name: z.string(),
  mediaType: z.string(),
  data: z.string(),
  size: z.number().max(10 * 1024 * 1024),  // 单文件最大 10MB
});

const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  message: z.string().min(1, 'Message is required'),
  attachments: z.array(attachmentSchema).max(10).optional(),  // 最多 10 个附件
  permissionMode: z.enum(['plan', 'acceptEdits', 'default']).optional(),
});

router.post('/stream', authMiddleware, async (req, res: Response) => {
  const { userId } = requireUser(req);
  const request = chatRequestSchema.parse(req.body);

  // 检查是否为 /command 格式
  const { isCommand, command, args } = skillsService.parseCommand(request.message);
  if (isCommand) {
    // 处理 /help 命令特殊情况
    if (command === 'help') {
      const helpMessage = await skillsService.generateHelpMessage(userId);
      request.message = helpMessage;
    } else {
      // 获取命令的提示词
      const skillPrompt = await skillsService.getSkillPrompt(userId, command, args);
      if (skillPrompt) {
        request.message = skillPrompt;
      }
      // 如果找不到命令，保持原消息不变，让 Claude 处理
    }
  }

  let isCompleted = false;
  let activeSessionId: string | undefined = request.sessionId;

  // Use res.on('close') instead of req.on('close')
  // In Node.js >= 18, req 'close' fires when request body is consumed,
  // not when the client disconnects. res 'close' + !writableFinished
  // is the correct way to detect premature client disconnection.
  res.on('close', () => {
    if (!isCompleted && !res.writableFinished && activeSessionId) {
      console.log('[Chat] Client disconnected, aborting session:', activeSessionId);
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
    console.error('[Chat] Stream error:', error);
    throw error;
  }
});

router.post('/abort/:sessionId', authMiddleware, async (req, res: { json: (data: ApiResponse<{ aborted: boolean }>) => void }) => {
  const { sessionId } = req.params;
  const aborted = await agentService.abortSession(sessionId);
  res.json({ success: true, data: { aborted } });
});

export default router;
