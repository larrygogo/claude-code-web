import { Router } from 'express';
import { z } from 'zod';
import { ApiResponse, Plan, PlanListItem } from '@claude-web/shared';
import { planService } from '../services/PlanService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router = Router();

const createPlanSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

const updatePlanSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'approved', 'executing', 'completed', 'cancelled']).optional(),
});

router.get('/', authMiddleware, async (req, res: { json: (data: ApiResponse<PlanListItem[]>) => void }) => {
  const { userId } = requireUser(req);
  const sessionId = req.query.sessionId as string | undefined;
  const plans = await planService.listPlans(userId, sessionId);
  res.json({ success: true, data: plans });
});

router.post('/', authMiddleware, async (req, res: { json: (data: ApiResponse<Plan>) => void }) => {
  const { userId } = requireUser(req);
  const input = createPlanSchema.parse(req.body);
  const plan = await planService.createPlan(userId, input);
  res.json({ success: true, data: plan });
});

router.get('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse<Plan>) => void }) => {
  const { userId } = requireUser(req);
  const plan = await planService.getPlan(userId, req.params.id);
  res.json({ success: true, data: plan });
});

router.patch('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse<Plan>) => void }) => {
  const { userId } = requireUser(req);
  const input = updatePlanSchema.parse(req.body);
  const plan = await planService.updatePlan(userId, req.params.id, input);
  res.json({ success: true, data: plan });
});

router.delete('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse) => void }) => {
  const { userId } = requireUser(req);
  await planService.deletePlan(userId, req.params.id);
  res.json({ success: true });
});

router.post('/:id/execute', authMiddleware, async (req, res: { json: (data: ApiResponse<Plan>) => void }) => {
  const { userId } = requireUser(req);
  const plan = await planService.executePlan(userId, req.params.id);
  res.json({ success: true, data: plan });
});

router.post('/:id/complete', authMiddleware, async (req, res: { json: (data: ApiResponse<Plan>) => void }) => {
  const { userId } = requireUser(req);
  const plan = await planService.completePlan(userId, req.params.id);
  res.json({ success: true, data: plan });
});

export default router;
