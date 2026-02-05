import { Plan, PlanCreateInput, PlanUpdateInput, PlanListItem, PlanStatus } from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { fileStorage } from '../storage/FileStorage.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../middleware/error.js';

export class PlanService {
  async createPlan(userId: string, input: PlanCreateInput): Promise<Plan> {
    const db = getDatabase();

    const session = await db.session.findUnique({
      where: { id: input.sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to this session');
    }

    const plan = await db.plan.create({
      data: {
        userId,
        sessionId: input.sessionId,
        projectId: session.projectId,
        title: input.title,
        content: input.content,
        status: 'draft',
      },
    });

    const planPath = await fileStorage.getPlanFilePath(userId, plan.id);
    await fileStorage.writeFile(planPath, input.content);

    return this.mapPlan(plan);
  }

  async getPlan(userId: string, planId: string): Promise<Plan> {
    const db = getDatabase();

    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenError('Access denied to this plan');
    }

    return this.mapPlan(plan);
  }

  async listPlans(userId: string, sessionId?: string): Promise<PlanListItem[]> {
    const db = getDatabase();

    const plans = await db.plan.findMany({
      where: {
        userId,
        ...(sessionId && { sessionId }),
      },
      include: {
        project: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map(p => ({
      id: p.id,
      sessionId: p.sessionId,
      projectName: p.project?.name,
      title: p.title,
      status: p.status as PlanStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async updatePlan(userId: string, planId: string, input: PlanUpdateInput): Promise<Plan> {
    const db = getDatabase();

    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenError('Access denied to this plan');
    }

    if (input.status) {
      this.validateStatusTransition(plan.status as PlanStatus, input.status);
    }

    const updated = await db.plan.update({
      where: { id: planId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.content && { content: input.content }),
        ...(input.status && { status: input.status }),
      },
    });

    if (input.content) {
      const planPath = await fileStorage.getPlanFilePath(userId, planId);
      await fileStorage.writeFile(planPath, input.content);
    }

    return this.mapPlan(updated);
  }

  async deletePlan(userId: string, planId: string): Promise<void> {
    const db = getDatabase();

    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenError('Access denied to this plan');
    }

    const planPath = await fileStorage.getPlanFilePath(userId, planId);
    await fileStorage.deleteFile(planPath);

    await db.plan.delete({ where: { id: planId } });
  }

  async executePlan(userId: string, planId: string): Promise<Plan> {
    const db = getDatabase();

    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenError('Access denied to this plan');
    }

    if (plan.status !== 'approved') {
      throw new ValidationError('Plan must be approved before execution');
    }

    const updated = await db.plan.update({
      where: { id: planId },
      data: { status: 'executing' },
    });

    return this.mapPlan(updated);
  }

  async completePlan(userId: string, planId: string): Promise<Plan> {
    const db = getDatabase();

    const plan = await db.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenError('Access denied to this plan');
    }

    if (plan.status !== 'executing') {
      throw new ValidationError('Plan must be executing to complete');
    }

    const updated = await db.plan.update({
      where: { id: planId },
      data: { status: 'completed' },
    });

    return this.mapPlan(updated);
  }

  private validateStatusTransition(currentStatus: PlanStatus, newStatus: PlanStatus): void {
    const validTransitions: Record<PlanStatus, PlanStatus[]> = {
      draft: ['approved', 'cancelled'],
      approved: ['executing', 'cancelled'],
      executing: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private mapPlan(plan: {
    id: string;
    userId: string;
    sessionId: string;
    projectId: string | null;
    title: string;
    content: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Plan {
    return {
      id: plan.id,
      userId: plan.userId,
      sessionId: plan.sessionId,
      projectId: plan.projectId || undefined,
      title: plan.title,
      content: plan.content,
      status: plan.status as PlanStatus,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}

export const planService = new PlanService();
