import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private config: McpServerConfig;
  private connected = false;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.client = new Client({
      name: 'claude-web-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 创建 stdio 传输 - StdioClientTransport 会自动管理子进程
      // 注意: 不要手动调用 spawn()，StdioClientTransport 内部会处理进程创建
      // 合并环境变量，过滤掉 undefined 值
      const mergedEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          mergedEnv[key] = value;
        }
      }
      if (this.config.env) {
        Object.assign(mergedEnv, this.config.env);
      }

      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: mergedEnv,
      });

      // 连接客户端
      await this.client.connect(this.transport);
      this.connected = true;

      // 验证连接 - 尝试获取服务器信息
      try {
        const serverInfo = this.client.getServerVersion();
        console.log(`[McpClient] Connected to ${this.config.name}`, serverInfo ? `(${serverInfo.name} v${serverInfo.version})` : '');
      } catch {
        console.log(`[McpClient] Connected to ${this.config.name}`);
      }
    } catch (error) {
      console.error(`[McpClient] Failed to connect to ${this.config.name}:`, error);
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn('[McpClient] Error closing transport:', error);
      }
      this.transport = null;
    }

    console.log(`[McpClient] Disconnected from ${this.config.name}`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.client.listTools();
      return (result.tools || []).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    } catch (error) {
      console.error(`[McpClient] Failed to list tools for ${this.config.name}:`, error);
      throw error;
    }
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args as Record<string, unknown>,
      });
      return result;
    } catch (error) {
      console.error(`[McpClient] Failed to call tool ${name} on ${this.config.name}:`, error);
      throw error;
    }
  }

  async listResources(): Promise<McpResource[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.client.listResources();
      return (result.resources || []).map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    } catch (error) {
      console.error(`[McpClient] Failed to list resources for ${this.config.name}:`, error);
      throw error;
    }
  }

  async readResource(uri: string): Promise<string> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.client.readResource({ uri });
      // 处理不同类型的内容
      if (result.contents && result.contents.length > 0) {
        const content = result.contents[0];
        if ('text' in content) {
          return content.text;
        }
        if ('blob' in content) {
          return content.blob;
        }
      }
      return '';
    } catch (error) {
      console.error(`[McpClient] Failed to read resource ${uri} from ${this.config.name}:`, error);
      throw error;
    }
  }

  getServerName(): string {
    return this.config.name;
  }
}
