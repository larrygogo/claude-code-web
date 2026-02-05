export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SSEEventType =
  | 'init'
  | 'text_delta'
  | 'thinking_delta'
  | 'tool_use'
  | 'tool_result'
  | 'permission_request'
  | 'title_update'
  | 'error'
  | 'done';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: number;
}

export interface SSEInitData {
  sessionId: string;
  messageId: string;
  title?: string;
}

export interface SSETextDelta {
  content: string;
}

export interface SSEThinkingDelta {
  content: string;
}

export interface SSEToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SSEToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface SSEPermissionRequest {
  id: string;
  toolName: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface SSEError {
  code: string;
  message: string;
}

export interface SSETitleUpdate {
  sessionId: string;
  title: string;
}

export interface SSEDone {
  messageId: string;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ChatAttachment {
  name: string;       // 文件名
  mediaType: string;  // MIME 类型
  data: string;       // base64 编码数据（不含 data:... 前缀）
  size: number;       // 原始文件大小（字节）
}

export interface ChatRequest {
  sessionId?: string;
  projectId?: string;
  message: string;
  attachments?: ChatAttachment[];  // 附件列表
  permissionMode?: 'plan' | 'acceptEdits' | 'default';
}
