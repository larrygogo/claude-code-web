/**
 * 工具相关类型定义
 */

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface PathValidation {
  valid: boolean;
  error?: string;
}
