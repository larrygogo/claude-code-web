/**
 * 操作模式类型
 */
export type OperationMode = 'full' | 'restricted';

/**
 * 系统功能配置
 */
export interface SystemFeatures {
  /** 文件系统读写是否启用 */
  fileSystem: boolean;
  /** 命令执行是否启用 */
  bash: boolean;
}

/**
 * 系统配置
 */
export interface SystemConfig {
  /** 当前操作模式 */
  operationMode: OperationMode;
  /** 启用的工具列表 */
  enabledTools: string[];
  /** 功能配置详情 */
  features: SystemFeatures;
}

/**
 * 系统状态
 */
export interface SystemStatus {
  /** 系统是否已初始化 */
  initialized: boolean;
  /** 系统版本 */
  version: string;
  /** 是否有可用的模型配置 */
  hasModelConfig: boolean;
}

/**
 * 初始化步骤 - 模型配置
 */
export interface SetupModelInput {
  name: string;
  provider: 'anthropic';
  modelId: string;
  apiEndpoint: string;
  apiKey: string;
}

/**
 * 初始化步骤 - 管理员账号
 */
export interface SetupAdminInput {
  email: string;
  username: string;
  password: string;
}

/**
 * 初始化步骤 - 功能配置
 */
export interface SetupFeaturesInput {
  enableFileSystem: boolean;
  enableBash: boolean;
  clientUrl?: string;
}

/**
 * 初始化 - 一次性提交所有配置
 */
export interface SetupAllInput {
  model: SetupModelInput;
  admin: SetupAdminInput;
  features: SetupFeaturesInput;
}

/**
 * 系统设置项
 */
export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 系统设置列表项（用于前端展示，隐藏敏感值）
 */
export interface SystemSettingListItem {
  id: string;
  key: string;
  value: string;  // 敏感数据显示为 "******"
  category: string;
  isSecret: boolean;
  updatedAt: Date;
}

/**
 * 更新系统设置的输入
 */
export interface UpdateSystemSettingsInput {
  settings: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * 系统设置分类
 */
export type SystemSettingCategory = 'general' | 'features' | 'cors';

/**
 * 预定义的系统设置键名
 */
export const SystemSettingKeys = {
  // 系统状态
  SYSTEM_INITIALIZED: 'system.initialized',
  SYSTEM_VERSION: 'system.version',

  // 功能开关
  FEATURES_ENABLE_FILE_SYSTEM: 'features.enableFileSystem',
  FEATURES_ENABLE_BASH: 'features.enableBash',

  // CORS 配置
  CORS_CLIENT_URL: 'cors.clientUrl',
} as const;
