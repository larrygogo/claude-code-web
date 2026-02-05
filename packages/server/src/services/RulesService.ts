import { prisma } from '../storage/Database.js';
import type { UserRule } from '@prisma/client';

export interface CreateRuleInput {
  name: string;
  content: string;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateRuleInput {
  name?: string;
  content?: string;
  enabled?: boolean;
  priority?: number;
}

export class RulesService {
  /**
   * 获取用户所有规则
   */
  async getUserRules(userId: string) {
    return prisma.userRule.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * 获取单个规则
   */
  async getRule(userId: string, ruleId: string) {
    const rule = await prisma.userRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      throw new Error('Rule not found');
    }
    return rule;
  }

  /**
   * 创建规则
   */
  async createRule(userId: string, data: CreateRuleInput) {
    // 检查名称是否已存在
    const existing = await prisma.userRule.findUnique({
      where: { userId_name: { userId, name: data.name } },
    });
    if (existing) {
      throw new Error('Rule with this name already exists');
    }

    return prisma.userRule.create({
      data: {
        userId,
        name: data.name,
        content: data.content,
        enabled: data.enabled ?? true,
        priority: data.priority ?? 0,
      },
    });
  }

  /**
   * 更新规则
   */
  async updateRule(userId: string, ruleId: string, data: UpdateRuleInput) {
    // 验证规则存在且属于该用户
    const rule = await prisma.userRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      throw new Error('Rule not found');
    }

    // 如果更新名称，检查新名称是否已被使用
    if (data.name && data.name !== rule.name) {
      const existing = await prisma.userRule.findUnique({
        where: { userId_name: { userId, name: data.name } },
      });
      if (existing) {
        throw new Error('Rule with this name already exists');
      }
    }

    return prisma.userRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        content: data.content,
        enabled: data.enabled,
        priority: data.priority,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除规则
   */
  async deleteRule(userId: string, ruleId: string) {
    const rule = await prisma.userRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      throw new Error('Rule not found');
    }

    await prisma.userRule.delete({ where: { id: ruleId } });
  }

  /**
   * 启用/禁用规则
   */
  async toggleRule(userId: string, ruleId: string) {
    const rule = await prisma.userRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) {
      throw new Error('Rule not found');
    }

    return prisma.userRule.update({
      where: { id: ruleId },
      data: { enabled: !rule.enabled, updatedAt: new Date() },
    });
  }

  /**
   * 获取用户所有已启用规则的内容（用于注入系统提示词）
   */
  async getEnabledRulesContent(userId: string): Promise<string> {
    const rules = await prisma.userRule.findMany({
      where: { userId, enabled: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (rules.length === 0) {
      return '';
    }

    // 格式化规则内容
    const formattedRules = rules.map((rule: UserRule) => {
      return `### ${rule.name}\n\n${rule.content}`;
    }).join('\n\n---\n\n');

    return formattedRules;
  }
}

export const rulesService = new RulesService();
