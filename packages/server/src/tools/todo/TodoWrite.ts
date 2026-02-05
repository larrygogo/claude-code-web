/**
 * TodoWrite 工具 - 创建/更新任务
 */

import { ToolResult } from '../types.js';
import {
  createTodo,
  getTodo,
  updateTodo,
  deleteTodo,
  TodoItem,
} from './TodoStore.js';

export interface TodoWriteInput {
  sessionId: string;
  action: 'create' | 'update' | 'delete';
  subject?: string;
  description?: string;
  taskId?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  blockedBy?: string[];
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

export async function todoWriteTool(
  input: TodoWriteInput,
  _workingDir: string
): Promise<ToolResult> {
  try {
    const { sessionId, action, subject, description, taskId, status, blockedBy } = input;

    if (!sessionId) {
      return {
        content: '错误: sessionId 不能为空',
        isError: true,
      };
    }

    switch (action) {
      case 'create': {
        if (!subject) {
          return {
            content: '错误: create 操作需要提供 subject',
            isError: true,
          };
        }

        const todo = createTodo(sessionId, subject, description, blockedBy);

        return {
          content: [
            '任务已创建:',
            `  ID: ${todo.id}`,
            `  主题: ${todo.subject}`,
            todo.description ? `  描述: ${todo.description}` : null,
            `  状态: ${formatStatus(todo.status)}`,
            todo.blockedBy && todo.blockedBy.length > 0
              ? `  被阻塞: ${todo.blockedBy.join(', ')}`
              : null,
          ].filter(Boolean).join('\n'),
          isError: false,
        };
      }

      case 'update': {
        if (!taskId) {
          return {
            content: '错误: update 操作需要提供 taskId',
            isError: true,
          };
        }

        const existingTodo = getTodo(sessionId, taskId);
        if (!existingTodo) {
          return {
            content: `错误: 任务不存在: ${taskId}`,
            isError: true,
          };
        }

        // 构建更新内容
        const updates: Partial<Pick<TodoItem, 'subject' | 'description' | 'status' | 'blockedBy'>> = {};

        if (subject !== undefined) updates.subject = subject;
        if (description !== undefined) updates.description = description;
        if (status !== undefined) updates.status = status;
        if (blockedBy !== undefined) updates.blockedBy = blockedBy;

        if (Object.keys(updates).length === 0) {
          return {
            content: '错误: 没有提供任何更新内容',
            isError: true,
          };
        }

        const updatedTodo = updateTodo(sessionId, taskId, updates);

        if (!updatedTodo) {
          return {
            content: `错误: 更新任务失败: ${taskId}`,
            isError: true,
          };
        }

        const changesList: string[] = [];
        if (subject !== undefined) changesList.push(`主题: "${updatedTodo.subject}"`);
        if (description !== undefined) changesList.push(`描述: "${updatedTodo.description || '(无)'}"`);
        if (status !== undefined) changesList.push(`状态: ${formatStatus(updatedTodo.status)}`);
        if (blockedBy !== undefined) {
          changesList.push(`被阻塞: ${updatedTodo.blockedBy?.join(', ') || '(无)'}`);
        }

        return {
          content: [
            `任务已更新: ${taskId}`,
            '更新内容:',
            ...changesList.map(c => `  ${c}`),
          ].join('\n'),
          isError: false,
        };
      }

      case 'delete': {
        if (!taskId) {
          return {
            content: '错误: delete 操作需要提供 taskId',
            isError: true,
          };
        }

        const todoToDelete = getTodo(sessionId, taskId);
        if (!todoToDelete) {
          return {
            content: `错误: 任务不存在: ${taskId}`,
            isError: true,
          };
        }

        const deleted = deleteTodo(sessionId, taskId);

        if (!deleted) {
          return {
            content: `错误: 删除任务失败: ${taskId}`,
            isError: true,
          };
        }

        return {
          content: `任务已删除: ${taskId} - ${todoToDelete.subject}`,
          isError: false,
        };
      }

      default:
        return {
          content: `错误: 未知操作 "${action}"，支持 create, update, delete`,
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: `任务操作失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
