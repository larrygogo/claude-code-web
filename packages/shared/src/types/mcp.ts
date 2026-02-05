// MCP 服务器配置
export interface McpServer {
  id: string;
  userId?: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateMcpServerRequest {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface UpdateMcpServerRequest {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

// MCP 工具定义
export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

// MCP 资源定义
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverName: string;
}
