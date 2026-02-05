/**
 * TodoRead 工具 - 读取任务列表
 */

import { ToolResult } from '../types.js';
import {
  getAllTodos,
  getTodosByStatus,
  getTodoStats,
  TodoItem,
} from './TodoStore.js';

export interface TodoReadInput {
  sessionId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'all';
  limit?: number;
}

/**
 * 格式化状态
 */
function formatStatus(status: TodoItem['status']): string {
  switch (status) {
    case 'pending': return '⏳ 待处理';
    case 'in_progress': return '🔄 进行中';
    case 'completed': return '✅ 已完成';
  }
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化任务项
 */
function formatTodoItem(todo: TodoItem): string {
  const lines: string[] = [];

  lines.push(`[${todo.id}] ${todo.subject}`);
  lines.push(`    状态: ${formatStatus(todo.status)}`);

  if (todo.description) {
    lines.push(`    描述: ${todo.description}`);
  }

  if (todo.blockedBy && todo.blockedBy.length > 0) {
    lines.push(`    被阻塞: ${todo.blockedBy.join(', ')}`);
  }

  lines.push(`    创建: ${formatDate(todo.createdAt)} | 更新: ${formatDate(todo.updatedAt)}`);

  return lines.join('\n');
}

export async function todoReadTool(
  input: TodoReadInput,
  _workingDir: string
): Promise<ToolResult> {
  try {
    const { sessionId, status = 'all', limit = 50 } = input;

    if (!sessionId) {
      return {
        content: '错误: sessionId 不能为空',
        isError: true,
      };
    }

    // 获取任务列表
    let todos: TodoItem[];
    if (status === 'all') {
      todos = getAllTodos(sessionId);
    } else {
      todos = getTodosByStatus(sessionId, status);
    }

    // 应用限制
    const effectiveLimit = Math.min(Math.max(limit, 1), 100);
    const displayTodos = todos.slice(0, effectiveLimit);

    // 获取统计信息
    const stats = getTodoStats(sessionId);

    // 格式化输出
    const lines: string[] = [];

    lines.push('任务列表');
    lines.push('═'.repeat(40));
    lines.push(`总计: ${stats.total} | 待处理: ${stats.pending} | 进行中: ${stats.inProgress} | 已完成: ${stats.completed}`);
    lines.push('');

    if (displayTodos.length === 0) {
      if (status === 'all') {
        lines.push('没有任务');
      } else {
        lines.push(`没有 "${status}" 状态的任务`);
      }
    } else {
      for (const todo of displayTodos) {
        lines.push(formatTodoItem(todo));
        lines.push('');
      }

      if (todos.length > effectiveLimit) {
        lines.push(`... 还有 ${todos.length - effectiveLimit} 个任务未显示`);
      }
    }

    return {
      content: lines.join('\n'),
      isError: false,
    };
  } catch (error) {
    return {
      content: `读取任务失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
