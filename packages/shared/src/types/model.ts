export type ModelProvider = 'anthropic' | 'openai' | 'custom';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  apiEndpoint: string;
  apiKey?: string; // 列表查询时不返回
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelConfigListItem {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  apiEndpoint: string;
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelConfigInput {
  name: string;
  provider: ModelProvider;
  modelId: string;
  apiEndpoint: string;
  apiKey: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  priority?: number;
  settings?: Record<string, unknown>;
}

export interface ModelConfigUpdateInput {
  name?: string;
  provider?: ModelProvider;
  modelId?: string;
  apiEndpoint?: string;
  apiKey?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  priority?: number;
  settings?: Record<string, unknown>;
}

// 仪表板统计
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalSessions: number;
  totalProjects: number;
  totalModels: number;
  enabledModels: number;
}
