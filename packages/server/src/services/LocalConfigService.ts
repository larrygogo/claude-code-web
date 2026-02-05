import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface LocalCommand {
  name: string;
  description?: string;
  prompt: string;
  source: 'local';
}

export interface LocalMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  source: 'local';
}

export interface LocalConfig {
  commands: LocalCommand[];
  mcpServers: LocalMcpServer[];
}

/**
 * 本地配置服务
 * 从 ~/.claude/ 目录读取 Claude Code CLI 的本地配置
 */
export class LocalConfigService {
  private claudeDir: string;

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  /**
   * 获取所有本地配置
   */
  async getLocalConfig(): Promise<LocalConfig> {
    const [commands, mcpServers] = await Promise.all([
      this.getLocalCommands(),
      this.getLocalMcpServers(),
    ]);

    return { commands, mcpServers };
  }

  /**
   * 从 ~/.claude/commands/*.md 读取本地命令
   */
  async getLocalCommands(): Promise<LocalCommand[]> {
    const commandsDir = path.join(this.claudeDir, 'commands');
    const commands: LocalCommand[] = [];

    try {
      const files = await fs.readdir(commandsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        try {
          const filePath = path.join(commandsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const command = this.parseCommandFile(file, content);
          if (command) {
            commands.push(command);
          }
        } catch (error) {
          console.warn(`[LocalConfigService] Failed to read command file ${file}:`, error);
        }
      }
    } catch (error) {
      // commands 目录不存在是正常的
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[LocalConfigService] Failed to read commands directory:', error);
      }
    }

    return commands;
  }

  /**
   * 解析命令文件
   * 支持 YAML 前言格式
   */
  private parseCommandFile(filename: string, content: string): LocalCommand | null {
    const name = filename.replace(/\.md$/, '');

    // 检查是否有 YAML 前言
    const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (yamlMatch) {
      const yamlPart = yamlMatch[1];
      const promptPart = yamlMatch[2].trim();

      // 简单解析 YAML（只处理 description 字段）
      let description: string | undefined;
      const descMatch = yamlPart.match(/description:\s*(.+)/);
      if (descMatch) {
        description = descMatch[1].trim().replace(/^["']|["']$/g, '');
      }

      return {
        name,
        description,
        prompt: promptPart || content,
        source: 'local',
      };
    }

    // 没有 YAML 前言，整个文件就是提示词
    return {
      name,
      prompt: content.trim(),
      source: 'local',
    };
  }

  /**
   * 验证 MCP 服务器配置
   */
  private isValidMcpServerConfig(name: string, config: unknown): config is { command: string; args?: string[]; env?: Record<string, string> } {
    if (typeof config !== 'object' || config === null) {
      console.warn(`[LocalConfigService] Invalid MCP server config for ${name}: not an object`);
      return false;
    }
    const cfg = config as Record<string, unknown>;
    if (typeof cfg.command !== 'string' || !cfg.command) {
      console.warn(`[LocalConfigService] Invalid MCP server config for ${name}: missing or invalid command`);
      return false;
    }
    if (cfg.args !== undefined && !Array.isArray(cfg.args)) {
      console.warn(`[LocalConfigService] Invalid MCP server config for ${name}: args must be an array`);
      return false;
    }
    if (cfg.env !== undefined && (typeof cfg.env !== 'object' || cfg.env === null)) {
      console.warn(`[LocalConfigService] Invalid MCP server config for ${name}: env must be an object`);
      return false;
    }
    // 验证名称不包含危险字符
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      console.warn(`[LocalConfigService] Invalid MCP server name: ${name}`);
      return false;
    }
    return true;
  }

  /**
   * 从本地配置读取 MCP 服务器配置
   */
  async getLocalMcpServers(): Promise<LocalMcpServer[]> {
    const servers: LocalMcpServer[] = [];

    // 1. 读取 settings.json 中的 MCP 配置
    try {
      const settingsPath = path.join(this.claudeDir, 'settings.json');
      const settingsContent = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent) as Record<string, unknown>;

      if (settings.mcpServers && typeof settings.mcpServers === 'object') {
        for (const [name, config] of Object.entries(settings.mcpServers as Record<string, unknown>)) {
          if (this.isValidMcpServerConfig(name, config)) {
            servers.push({
              name,
              command: config.command,
              args: config.args || [],
              env: config.env,
              source: 'local',
            });
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[LocalConfigService] Failed to read settings.json:', error);
      }
    }

    // 2. 读取 skills 目录中的 .mcp.json 文件
    const skillsDir = path.join(this.claudeDir, 'skills');
    try {
      const skills = await fs.readdir(skillsDir);

      for (const skill of skills) {
        // 验证 skill 目录名不包含路径遍历字符
        if (skill.includes('..') || skill.includes('/') || skill.includes('\\')) {
          console.warn(`[LocalConfigService] Skipping suspicious skill directory: ${skill}`);
          continue;
        }

        const mcpJsonPath = path.join(skillsDir, skill, '.mcp.json');
        try {
          const mcpContent = await fs.readFile(mcpJsonPath, 'utf-8');
          const mcpConfig = JSON.parse(mcpContent) as Record<string, unknown>;

          if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object') {
            for (const [name, config] of Object.entries(mcpConfig.mcpServers as Record<string, unknown>)) {
              // 避免重复
              if (!servers.some(s => s.name === name) && this.isValidMcpServerConfig(name, config)) {
                servers.push({
                  name,
                  command: config.command,
                  args: config.args || [],
                  env: config.env,
                  source: 'local',
                });
              }
            }
          }
        } catch {
          // .mcp.json 不存在是正常的
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[LocalConfigService] Failed to read skills directory:', error);
      }
    }

    return servers;
  }

  /**
   * 检查本地配置目录是否存在
   */
  async checkLocalConfigExists(): Promise<boolean> {
    try {
      await fs.access(this.claudeDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取本地配置目录路径
   */
  getClaudeDir(): string {
    return this.claudeDir;
  }
}

export const localConfigService = new LocalConfigService();
