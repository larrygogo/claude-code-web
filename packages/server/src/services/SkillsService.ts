import { prisma } from '../storage/Database.js';
import { BUILTIN_SKILLS, getBuiltinSkill, isBuiltinSkill } from '../skills/builtins.js';
import { localConfigService } from './LocalConfigService.js';
import type { UserSkill } from '@prisma/client';

export interface Skill {
  name: string;
  description?: string;
  prompt: string;
  isBuiltin: boolean;
  source?: 'builtin' | 'local' | 'custom';
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  prompt: string;
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  prompt?: string;
  enabled?: boolean;
}

export class SkillsService {
  /**
   * 获取用户所有可用的 Skills（内置 + 本地配置 + 自定义）
   * 优先级: 自定义 > 本地配置 > 内置
   */
  async getAvailableSkills(userId: string): Promise<Skill[]> {
    // 1. 内置 Skills
    const builtinSkills: Skill[] = BUILTIN_SKILLS.map(s => ({
      name: s.name,
      description: s.description,
      prompt: s.prompt,
      isBuiltin: true,
      source: 'builtin' as const,
    }));

    // 2. 本地配置 Skills (从 ~/.claude/commands/*.md 读取)
    let localSkills: Skill[] = [];
    try {
      const localCommands = await localConfigService.getLocalCommands();
      localSkills = localCommands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        prompt: cmd.prompt,
        isBuiltin: false,
        source: 'local' as const,
      }));
    } catch (error) {
      console.warn('[SkillsService] Failed to load local commands:', error);
    }

    // 3. 用户自定义 Skills (数据库)
    const userSkills = await prisma.userSkill.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });

    const customSkills: Skill[] = userSkills.map((s: UserSkill) => ({
      name: s.name,
      description: s.description || undefined,
      prompt: s.prompt,
      isBuiltin: false,
      source: 'custom' as const,
    }));

    // 合并，优先级: 自定义 > 本地配置 > 内置
    const skillMap = new Map<string, Skill>();
    for (const skill of builtinSkills) {
      skillMap.set(skill.name, skill);
    }
    for (const skill of localSkills) {
      skillMap.set(skill.name, skill);
    }
    for (const skill of customSkills) {
      skillMap.set(skill.name, skill);
    }

    return Array.from(skillMap.values());
  }

  /**
   * 获取用户自定义 Skills
   */
  async getUserSkills(userId: string) {
    return prisma.userSkill.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 创建用户自定义 Skill
   */
  async createSkill(userId: string, data: CreateSkillInput) {
    // 检查名称是否与内置冲突
    if (isBuiltinSkill(data.name)) {
      throw new Error('Cannot override builtin skill');
    }

    // 检查名称是否已存在
    const existing = await prisma.userSkill.findUnique({
      where: { userId_name: { userId, name: data.name } },
    });
    if (existing) {
      throw new Error('Skill with this name already exists');
    }

    // 验证名称格式
    if (!/^[a-z0-9-]+$/.test(data.name)) {
      throw new Error('Skill name can only contain lowercase letters, numbers, and hyphens');
    }

    return prisma.userSkill.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        enabled: data.enabled ?? true,
      },
    });
  }

  /**
   * 更新用户自定义 Skill
   */
  async updateSkill(userId: string, skillId: string, data: UpdateSkillInput) {
    const skill = await prisma.userSkill.findFirst({
      where: { id: skillId, userId },
    });
    if (!skill) {
      throw new Error('Skill not found');
    }

    // 如果更新名称，检查是否与内置冲突
    if (data.name && data.name !== skill.name) {
      if (isBuiltinSkill(data.name)) {
        throw new Error('Cannot use builtin skill name');
      }
      if (!/^[a-z0-9-]+$/.test(data.name)) {
        throw new Error('Skill name can only contain lowercase letters, numbers, and hyphens');
      }
      const existing = await prisma.userSkill.findUnique({
        where: { userId_name: { userId, name: data.name } },
      });
      if (existing) {
        throw new Error('Skill with this name already exists');
      }
    }

    return prisma.userSkill.update({
      where: { id: skillId },
      data: {
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        enabled: data.enabled,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除用户自定义 Skill
   */
  async deleteSkill(userId: string, skillId: string) {
    const skill = await prisma.userSkill.findFirst({
      where: { id: skillId, userId },
    });
    if (!skill) {
      throw new Error('Skill not found');
    }

    await prisma.userSkill.delete({ where: { id: skillId } });
  }

  /**
   * 获取 Skill 的提示词（支持参数替换）
   * 优先级: 自定义 > 本地配置 > 内置
   */
  async getSkillPrompt(userId: string, skillName: string, args: string = ''): Promise<string | null> {
    // 1. 先检查用户自定义
    const userSkill = await prisma.userSkill.findUnique({
      where: { userId_name: { userId, name: skillName } },
    });

    if (userSkill && userSkill.enabled) {
      return userSkill.prompt.replace(/\{\{args\}\}/g, args);
    }

    // 2. 检查本地配置
    try {
      const localCommands = await localConfigService.getLocalCommands();
      const localCommand = localCommands.find(cmd => cmd.name === skillName);
      if (localCommand) {
        return localCommand.prompt.replace(/\{\{args\}\}/g, args);
      }
    } catch (error) {
      console.warn('[SkillsService] Failed to check local commands:', error);
    }

    // 3. 检查内置
    const builtinSkill = getBuiltinSkill(skillName);
    if (builtinSkill) {
      return builtinSkill.prompt.replace(/\{\{args\}\}/g, args);
    }

    return null;
  }

  /**
   * 解析消息，检查是否为 /command 格式
   */
  parseCommand(message: string): { isCommand: boolean; command: string; args: string } {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/')) {
      return { isCommand: false, command: '', args: '' };
    }

    const match = trimmed.match(/^\/([a-z0-9-]+)(?:\s+(.*))?$/i);
    if (!match) {
      return { isCommand: false, command: '', args: '' };
    }

    return {
      isCommand: true,
      command: match[1].toLowerCase(),
      args: match[2]?.trim() || '',
    };
  }

  /**
   * 生成帮助信息
   */
  async generateHelpMessage(userId: string): Promise<string> {
    const skills = await this.getAvailableSkills(userId);

    let message = '## 可用的快捷命令\n\n';
    message += '在聊天中输入以下命令来快速执行任务：\n\n';

    const builtinSkills = skills.filter(s => s.source === 'builtin');
    const localSkills = skills.filter(s => s.source === 'local');
    const customSkills = skills.filter(s => s.source === 'custom');

    if (builtinSkills.length > 0) {
      message += '### 内置命令\n\n';
      for (const skill of builtinSkills) {
        message += `- \`/${skill.name}\` - ${skill.description || '无描述'}\n`;
      }
      message += '\n';
    }

    if (localSkills.length > 0) {
      message += '### 本地命令 (~/.claude/commands/)\n\n';
      for (const skill of localSkills) {
        message += `- \`/${skill.name}\` - ${skill.description || '无描述'}\n`;
      }
      message += '\n';
    }

    if (customSkills.length > 0) {
      message += '### 自定义命令\n\n';
      for (const skill of customSkills) {
        message += `- \`/${skill.name}\` - ${skill.description || '无描述'}\n`;
      }
      message += '\n';
    }

    message += '提示：在命令后面可以添加参数，例如 `/fix 登录页面报错`';

    return message;
  }
}

export const skillsService = new SkillsService();
