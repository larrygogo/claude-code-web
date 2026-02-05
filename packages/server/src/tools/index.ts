/**
 * 工具执行器 - 统一管理所有工具的调用
 */

import type { ToolResult } from './types.js';
import { getToolDefinitions } from './definitions.js';

// 原有工具
import { readTool } from './Read.js';
import { writeTool } from './Write.js';
import { editTool } from './Edit.js';
import { bashTool } from './Bash.js';
import { globTool } from './Glob.js';
import { grepTool } from './Grep.js';
import { webFetchTool } from './WebFetch.js';
import { isToolEnabled, getOperationMode } from '../config.js';

// 新增工具 - 文件操作增强
import { lsTool } from './Ls.js';
import { fileTreeTool } from './FileTree.js';
import { multiEditTool } from './MultiEdit.js';
import { diffTool } from './Diff.js';
import { notebookEditTool } from './NotebookEdit.js';
import { findTool } from './Find.js';

// 新增工具 - Git
import { gitStatusTool } from './git/GitStatus.js';
import { gitDiffTool } from './git/GitDiff.js';
import { gitLogTool } from './git/GitLog.js';

// 新增工具 - 搜索增强
import { webSearchTool } from './search/WebSearch.js';

// 新增工具 - 任务管理
import { todoReadTool } from './todo/TodoRead.js';
import { todoWriteTool } from './todo/TodoWrite.js';

export type { ToolResult } from './types.js';
export { getToolDefinitions };
export type { ToolDefinition } from './definitions.js';

/**
 * 工具名称类型
 */
export type ToolName =
  | 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebFetch'
  | 'Ls' | 'FileTree' | 'MultiEdit' | 'Diff' | 'NotebookEdit' | 'Find'
  | 'GitStatus' | 'GitDiff' | 'GitLog'
  | 'WebSearch'
  | 'TodoRead' | 'TodoWrite';

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
      // 原有工具
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

      // 新增工具 - 文件操作增强
      case 'Ls':
        return await lsTool(input as never, workingDir);

      case 'FileTree':
        return await fileTreeTool(input as never, workingDir);

      case 'MultiEdit':
        return await multiEditTool(input as never, workingDir);

      case 'Diff':
        return await diffTool(input as never, workingDir);

      case 'NotebookEdit':
        return await notebookEditTool(input as never, workingDir);

      case 'Find':
        return await findTool(input as never, workingDir);

      // 新增工具 - Git
      case 'GitStatus':
        return await gitStatusTool(input as never, workingDir);

      case 'GitDiff':
        return await gitDiffTool(input as never, workingDir);

      case 'GitLog':
        return await gitLogTool(input as never, workingDir);

      // 新增工具 - 搜索增强
      case 'WebSearch':
        return await webSearchTool(input as never, workingDir);

      // 新增工具 - 任务管理
      case 'TodoRead':
        return await todoReadTool(input as never, workingDir);

      case 'TodoWrite':
        return await todoWriteTool(input as never, workingDir);

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
  const confirmTools = ['Write', 'Edit', 'Bash', 'MultiEdit', 'NotebookEdit'];
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

    // 新增工具描述
    case 'Ls':
      return `列出目录: ${input.path || '当前目录'}`;

    case 'FileTree':
      return `显示目录树: ${input.path || '当前目录'}`;

    case 'MultiEdit':
      return `批量编辑文件: ${input.file_path}`;

    case 'Diff':
      return `比较文件: ${input.file1} vs ${input.file2}`;

    case 'NotebookEdit':
      return `编辑 Notebook: ${input.file_path}`;

    case 'Find':
      return `查找文件: ${input.name || '*'} in ${input.path || '当前目录'}`;

    case 'GitStatus':
      return `Git 状态: ${input.path || '当前仓库'}`;

    case 'GitDiff':
      return `Git 差异: ${input.file || '所有更改'}`;

    case 'GitLog':
      return `Git 日志: ${input.limit || 10} 条`;

    case 'WebSearch':
      return `网络搜索: ${input.query}`;

    case 'TodoRead':
      return `读取任务列表`;

    case 'TodoWrite':
      return `${input.action === 'create' ? '创建' : input.action === 'update' ? '更新' : '删除'}任务`;

    default:
      return `执行: ${toolName}`;
  }
}
