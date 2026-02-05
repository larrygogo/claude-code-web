/**
 * 工具执行器 - 统一管理所有工具的调用
 */

import type { ToolResult } from './types.js';
import { getToolDefinitions } from './definitions.js';
import { readTool } from './Read.js';
import { writeTool } from './Write.js';
import { editTool } from './Edit.js';
import { bashTool } from './Bash.js';
import { globTool } from './Glob.js';
import { grepTool } from './Grep.js';
import { webFetchTool } from './WebFetch.js';
import { isToolEnabled, getOperationMode } from '../config.js';

export type { ToolResult } from './types.js';
export { getToolDefinitions };
export type { ToolDefinition } from './definitions.js';

/**
 * 工具名称类型
 */
export type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebFetch';

/**
 * 获取工具被禁用时的友好提示
 */
function getDisabledToolMessage(toolName: string): string {
  const mode = getOperationMode();
  const messages: Record<string, string> = {
    Write: '文件写入功能已禁用。当前系统运行在受限模式下，不允许创建或修改文件。',
    Edit: '文件编辑功能已禁用。当前系统运行在受限模式下，不允许修改文件内容。',
    Bash: '命令执行功能已禁用。当前系统运行在受限模式下，不允许执行系统命令。',
  };
  return messages[toolName] || `工具 ${toolName} 已禁用。当前操作模式: ${mode}`;
}

/**
 * 执行工具
 * @param name 工具名称
 * @param input 工具输入参数
 * @param workingDir 工作目录
 * @returns 工具执行结果
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  workingDir: string
): Promise<ToolResult> {
  console.log(`[Tools] Executing tool: ${name}`);
  console.log(`[Tools] Input:`, JSON.stringify(input, null, 2));
  console.log(`[Tools] Working directory: ${workingDir}`);

  // 检查工具是否启用
  if (!isToolEnabled(name)) {
    console.log(`[Tools] Tool ${name} is disabled in current operation mode`);
    return {
      content: getDisabledToolMessage(name),
      isError: true,
    };
  }

  try {
    switch (name) {
      case 'Read':
        return await readTool(input as never, workingDir);

      case 'Write':
        return await writeTool(input as never, workingDir);

      case 'Edit':
        return await editTool(input as never, workingDir);

      case 'Bash':
        return await bashTool(input as never, workingDir);

      case 'Glob':
        return await globTool(input as never, workingDir);

      case 'Grep':
        return await grepTool(input as never, workingDir);

      case 'WebFetch':
        return await webFetchTool(input as never, workingDir);

      default:
        return {
          content: `未知工具: ${name}`,
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[Tools] Error executing ${name}:`, error);
    return {
      content: `工具执行出错: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * 检查工具是否需要用户确认
 */
export function requiresConfirmation(toolName: string): boolean {
  // 写入类操作需要确认
  const confirmTools = ['Write', 'Edit', 'Bash'];
  return confirmTools.includes(toolName);
}

/**
 * 获取工具描述（用于确认对话框）
 */
export function getToolDescription(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case 'Write':
      return `写入文件: ${input.file_path}`;

    case 'Edit':
      return `编辑文件: ${input.file_path}`;

    case 'Bash':
      return `执行命令: ${input.command}`;

    case 'Read':
      return `读取文件: ${input.file_path}`;

    case 'Glob':
      return `查找文件: ${input.pattern}`;

    case 'Grep':
      return `搜索内容: ${input.pattern}`;

    case 'WebFetch':
      return `抓取网页: ${input.url}`;

    default:
      return `执行: ${toolName}`;
  }
}
