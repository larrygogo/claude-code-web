import { prisma } from '../storage/Database.js';
import { McpClient, McpTool } from '../mcp/McpClient.js';
import type { McpServer } from '@prisma/client';

export interface CreateMcpServerInput {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface UpdateMcpServerInput {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface McpServerWithParsed extends Omit<McpServer, 'args' | 'env'> {
  args: string[];
  env?: Record<string, string>;
}

export class McpService {
  // 每个用户的 MCP 客户端实例
  // key: `${userId}_${serverId}`
  private clients: Map<string, McpClient> = new Map();

  /**
   * 获取客户端 key
   */
  private getClientKey(userId: string | null, serverId: string): string {
    return `${userId || 'global'}_${serverId}`;
  }

  /**
   * 获取用户可用的所有 MCP 服务器
   */
  async getServers(userId: string): Promise<McpServerWithParsed[]> {
    // 获取全局服务器和用户服务器
    const servers = await prisma.mcpServer.findMany({
      where: {
        OR: [
          { userId: null },  // 全局
          { userId },        // 用户自己的
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return servers.map((server: McpServer) => ({
      ...server,
      args: JSON.parse(server.args) as string[],
      env: server.env ? JSON.parse(server.env) as Record<string, string> : undefined,
    }));
  }

  /**
   * 获取单个服务器
   */
  async getServer(userId: string, serverId: string) {
    const server = await prisma.mcpServer.findFirst({
      where: {
        id: serverId,
        OR: [
          { userId: null },
          { userId },
        ],
      },
    });

    if (!server) {
      throw new Error('MCP server not found');
    }

    return {
      ...server,
      args: JSON.parse(server.args) as string[],
      env: server.env ? JSON.parse(server.env) as Record<string, string> : undefined,
    };
  }

  /**
   * 创建 MCP 服务器配置
   */
  async createServer(userId: string, data: CreateMcpServerInput) {
    // 检查名称是否已存在
    const existing = await prisma.mcpServer.findFirst({
      where: {
        name: data.name,
        OR: [
          { userId: null },
          { userId },
        ],
      },
    });

    if (existing) {
      throw new Error('Server with this name already exists');
    }

    const server = await prisma.mcpServer.create({
      data: {
        userId,
        name: data.name,
        command: data.command,
        args: JSON.stringify(data.args || []),
        env: data.env ? JSON.stringify(data.env) : null,
        enabled: data.enabled ?? true,
        status: 'stopped',
      },
    });

    return {
      ...server,
      args: data.args || [],
      env: data.env,
    };
  }

  /**
   * 更新 MCP 服务器配置
   */
  async updateServer(userId: string, serverId: string, data: UpdateMcpServerInput) {
    const server = await prisma.mcpServer.findFirst({
      where: { id: serverId, userId },  // 只能更新自己的
    });

    if (!server) {
      throw new Error('MCP server not found');
    }

    // 如果服务器正在运行，先停止
    if (server.status === 'running') {
      await this.stopServer(userId, serverId);
    }

    const updated = await prisma.mcpServer.update({
      where: { id: serverId },
      data: {
        name: data.name,
        command: data.command,
        args: data.args ? JSON.stringify(data.args) : undefined,
        env: data.env !== undefined ? (data.env ? JSON.stringify(data.env) : null) : undefined,
        enabled: data.enabled,
        updatedAt: new Date(),
      },
    });

    return {
      ...updated,
      args: data.args || JSON.parse(server.args) as string[],
      env: data.env !== undefined ? data.env : (server.env ? JSON.parse(server.env) as Record<string, string> : undefined),
    };
  }

  /**
   * 删除 MCP 服务器配置
   */
  async deleteServer(userId: string, serverId: string) {
    const server = await prisma.mcpServer.findFirst({
      where: { id: serverId, userId },  // 只能删除自己的
    });

    if (!server) {
      throw new Error('MCP server not found');
    }

    // 先停止
    await this.stopServer(userId, serverId);

    await prisma.mcpServer.delete({ where: { id: serverId } });
  }

  /**
   * 启动 MCP 服务器
   */
  async startServer(userId: string, serverId: string) {
    const server = await this.getServer(userId, serverId);
    const clientKey = this.getClientKey(server.userId, serverId);

    // 如果已经运行，直接返回
    if (this.clients.has(clientKey)) {
      return server;
    }

    // 更新状态为 starting
    await prisma.mcpServer.update({
      where: { id: serverId },
      data: { status: 'starting', lastError: null },
    });

    try {
      const client = new McpClient({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
      });

      await client.connect();

      this.clients.set(clientKey, client);

      // 更新状态为 running
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: { status: 'running' },
      });

      console.log(`[McpService] Started server ${server.name} for user ${userId}`);

      return await this.getServer(userId, serverId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 更新状态为 error
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: { status: 'error', lastError: errorMessage },
      });

      throw error;
    }
  }

  /**
   * 停止 MCP 服务器
   */
  async stopServer(userId: string, serverId: string) {
    const server = await this.getServer(userId, serverId);
    const clientKey = this.getClientKey(server.userId, serverId);

    const client = this.clients.get(clientKey);
    if (client) {
      await client.disconnect();
      this.clients.delete(clientKey);
    }

    await prisma.mcpServer.update({
      where: { id: serverId },
      data: { status: 'stopped', lastError: null },
    });

    console.log(`[McpService] Stopped server ${server.name}`);

    return await this.getServer(userId, serverId);
  }

  /**
   * 获取服务器的工具列表
   */
  async getServerTools(userId: string, serverId: string): Promise<McpTool[]> {
    const server = await this.getServer(userId, serverId);
    const clientKey = this.getClientKey(server.userId, serverId);

    const client = this.clients.get(clientKey);
    if (!client) {
      throw new Error('Server not running');
    }

    return await client.listTools();
  }

  /**
   * 获取用户所有运行中的服务器的工具（用于注入到 Agent）
   */
  async getAvailableTools(userId: string): Promise<Array<McpTool & { serverName: string }>> {
    const servers = await this.getServers(userId);
    const tools: Array<McpTool & { serverName: string }> = [];

    for (const server of servers) {
      if (!server.enabled) continue;

      const clientKey = this.getClientKey(server.userId, server.id);
      const client = this.clients.get(clientKey);

      if (client && client.isConnected()) {
        try {
          const serverTools = await client.listTools();
          for (const tool of serverTools) {
            tools.push({
              ...tool,
              serverName: server.name,
            });
          }
        } catch (error) {
          console.warn(`[McpService] Failed to get tools from ${server.name}:`, error);
        }
      }
    }

    return tools;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(userId: string, serverName: string, toolName: string, args: unknown): Promise<unknown> {
    const servers = await this.getServers(userId);
    const server = servers.find((s: McpServerWithParsed) => s.name === serverName);

    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    const clientKey = this.getClientKey(server.userId, server.id);
    const client = this.clients.get(clientKey);

    if (!client) {
      throw new Error(`Server ${serverName} not running`);
    }

    return await client.callTool(toolName, args);
  }

  /**
   * 清理所有连接（用于服务关闭时）
   */
  async cleanup() {
    for (const [key, client] of this.clients.entries()) {
      try {
        await client.disconnect();
      } catch (error) {
        console.warn(`[McpService] Error disconnecting ${key}:`, error);
      }
    }
    this.clients.clear();
  }
}

export const mcpService = new McpService();
