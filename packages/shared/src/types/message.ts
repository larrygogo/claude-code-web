export type MessageRole = 'user' | 'assistant' | 'system';

export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'Task'
  | 'AskUserQuestion'
  | 'NotebookEdit';

export interface ToolUse {
  id: string;
  name: ToolName | string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface ThinkingBlock {
  type: 'thinking';
  content: string;
}

export interface TextBlock {
  type: 'text';
  content: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  toolUse: ToolUse;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolResult: ToolResult;
}

export interface ImageBlock {
  type: 'image';
  mediaType: string;  // 'image/jpeg', 'image/png', 'image/gif', 'image/webp'
  data: string;       // base64 编码
  name?: string;      // 原始文件名
}

export interface DocumentBlock {
  type: 'document';
  mediaType: string;  // 'application/pdf'
  data: string;       // base64 编码
  name?: string;      // 原始文件名
}

export type ContentBlock = ThinkingBlock | TextBlock | ImageBlock | DocumentBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: ContentBlock[];
  createdAt: Date;
  model?: string;
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface MessageCreateInput {
  sessionId: string;
  content: string;
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface PermissionResponse {
  requestId: string;
  granted: boolean;
  remember?: boolean;
}
