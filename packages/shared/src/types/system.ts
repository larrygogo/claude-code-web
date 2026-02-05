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
