// Skills 快捷命令
export interface Skill {
  name: string;
  description?: string;
  prompt: string;
  isBuiltin: boolean;
}

export interface UserSkill {
  id: string;
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  enabled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  prompt: string;
  enabled?: boolean;
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  prompt?: string;
  enabled?: boolean;
}
