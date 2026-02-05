// 用户规则
export interface UserRule {
  id: string;
  userId: string;
  name: string;
  content: string;
  enabled: boolean;
  priority: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateRuleRequest {
  name: string;
  content: string;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateRuleRequest {
  name?: string;
  content?: string;
  enabled?: boolean;
  priority?: number;
}
