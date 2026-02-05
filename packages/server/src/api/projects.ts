import { Router } from 'express';
import { z } from 'zod';
import { ApiResponse, Project, ProjectListItem, ProjectContext } from '@claude-web/shared';
import { projectService } from '../services/ProjectService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required'),
});

router.get('/', authMiddleware, async (req, res: { json: (data: ApiResponse<ProjectListItem[]>) => void }) => {
  const { userId } = requireUser(req);
  const projects = await projectService.listProjects(userId);
  res.json({ success: true, data: projects });
});

router.post('/', authMiddleware, async (req, res: { json: (data: ApiResponse<Project>) => void }) => {
  const { userId } = requireUser(req);
  const input = createProjectSchema.parse(req.body);
  const project = await projectService.createProject(userId, input);
  res.json({ success: true, data: project });
});

router.get('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse<Project>) => void }) => {
  const { userId } = requireUser(req);
  const project = await projectService.getProject(userId, req.params.id);
  res.json({ success: true, data: project });
});

router.get('/:id/context', authMiddleware, async (req, res: { json: (data: ApiResponse<ProjectContext>) => void }) => {
  const { userId } = requireUser(req);
  const context = await projectService.getProjectContext(userId, req.params.id);
  res.json({ success: true, data: context });
});

router.post('/:id/refresh-claude-md', authMiddleware, async (req, res: { json: (data: ApiResponse<{ claudeMd: string | null }>) => void }) => {
  const { userId } = requireUser(req);
  const claudeMd = await projectService.refreshClaudeMd(userId, req.params.id);
  res.json({ success: true, data: { claudeMd } });
});

router.delete('/:id', authMiddleware, async (req, res: { json: (data: ApiResponse) => void }) => {
  const { userId } = requireUser(req);
  await projectService.deleteProject(userId, req.params.id);
  res.json({ success: true });
});

export default router;
