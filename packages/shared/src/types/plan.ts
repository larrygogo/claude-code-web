export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled';

export interface Plan {
  id: string;
  userId: string;
  sessionId: string;
  projectId?: string;
  title: string;
  content: string;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanCreateInput {
  sessionId: string;
  title: string;
  content: string;
}

export interface PlanUpdateInput {
  title?: string;
  content?: string;
  status?: PlanStatus;
}

export interface PlanListItem {
  id: string;
  sessionId: string;
  projectName?: string;
  title: string;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanExecuteInput {
  planId: string;
  sessionId?: string;
}
