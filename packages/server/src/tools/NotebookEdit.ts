/**
 * NotebookEdit 工具 - Jupyter Notebook 编辑
 */

import * as fs from 'fs/promises';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface NotebookEditInput {
  file_path: string;
  cell_index: number;
  action: 'update' | 'insert' | 'delete';
  cell_type?: 'code' | 'markdown';
  source?: string;
}

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  metadata: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
}

interface NotebookContent {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

/**
 * 创建空的 code cell
 */
function createCodeCell(source: string): NotebookCell {
  return {
    cell_type: 'code',
    source: source.split('\n').map((line, i, arr) =>
      i === arr.length - 1 ? line : line + '\n'
    ),
    metadata: {},
    execution_count: null,
    outputs: [],
  };
}

/**
 * 创建空的 markdown cell
 */
function createMarkdownCell(source: string): NotebookCell {
  return {
    cell_type: 'markdown',
    source: source.split('\n').map((line, i, arr) =>
      i === arr.length - 1 ? line : line + '\n'
    ),
    metadata: {},
  };
}

export async function notebookEditTool(
  input: NotebookEditInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file_path, cell_index, action, cell_type, source } = input;

    // 验证文件扩展名
    if (!file_path.endsWith('.ipynb')) {
      return {
        content: '错误: 文件必须是 .ipynb 格式',
        isError: true,
      };
    }

    // 解析路径
    const resolvedPath = resolvePath(file_path, workingDir);

    // 验证路径
    const validation = validatePath(resolvedPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 读取 notebook 文件
    let notebook: NotebookContent;
    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      notebook = JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在，对于 insert 操作创建新的 notebook
        if (action === 'insert') {
          notebook = {
            cells: [],
            metadata: {
              kernelspec: {
                display_name: 'Python 3',
                language: 'python',
                name: 'python3',
              },
            },
            nbformat: 4,
            nbformat_minor: 5,
          };
        } else {
          return {
            content: `错误: 文件不存在: ${file_path}`,
            isError: true,
          };
        }
      } else {
        return {
          content: `错误: 无法读取 notebook 文件: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    }

    // 验证 notebook 结构
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return {
        content: '错误: 无效的 notebook 文件格式',
        isError: true,
      };
    }

    const cellCount = notebook.cells.length;

    switch (action) {
      case 'update': {
        // 验证索引
        if (cell_index < 0 || cell_index >= cellCount) {
          return {
            content: `错误: cell 索引 ${cell_index} 超出范围 (0-${cellCount - 1})`,
            isError: true,
          };
        }

        if (source === undefined) {
          return {
            content: '错误: update 操作需要提供 source',
            isError: true,
          };
        }

        // 更新 cell 内容
        const targetCell = notebook.cells[cell_index];
        targetCell.source = source.split('\n').map((line, i, arr) =>
          i === arr.length - 1 ? line : line + '\n'
        );

        // 如果指定了类型，更新类型
        if (cell_type) {
          targetCell.cell_type = cell_type;
          if (cell_type === 'code') {
            targetCell.execution_count = null;
            targetCell.outputs = [];
          } else {
            delete targetCell.execution_count;
            delete targetCell.outputs;
          }
        }

        break;
      }

      case 'insert': {
        // 验证索引（允许在末尾插入）
        if (cell_index < 0 || cell_index > cellCount) {
          return {
            content: `错误: 插入位置 ${cell_index} 超出范围 (0-${cellCount})`,
            isError: true,
          };
        }

        if (source === undefined) {
          return {
            content: '错误: insert 操作需要提供 source',
            isError: true,
          };
        }

        // 创建新 cell
        const newCell = (cell_type || 'code') === 'code'
          ? createCodeCell(source)
          : createMarkdownCell(source);

        // 插入 cell
        notebook.cells.splice(cell_index, 0, newCell);
        break;
      }

      case 'delete': {
        // 验证索引
        if (cell_index < 0 || cell_index >= cellCount) {
          return {
            content: `错误: cell 索引 ${cell_index} 超出范围 (0-${cellCount - 1})`,
            isError: true,
          };
        }

        // 删除 cell
        notebook.cells.splice(cell_index, 1);
        break;
      }

      default:
        return {
          content: `错误: 未知操作 "${action}"，支持 update, insert, delete`,
          isError: true,
        };
    }

    // 写入文件
    await fs.writeFile(resolvedPath, JSON.stringify(notebook, null, 1), 'utf-8');

    // 生成成功消息
    const actionMessages = {
      update: `已更新第 ${cell_index} 个 cell`,
      insert: `已在位置 ${cell_index} 插入新 cell`,
      delete: `已删除第 ${cell_index} 个 cell`,
    };

    return {
      content: `${actionMessages[action]}\n文件: ${file_path}\n当前共 ${notebook.cells.length} 个 cells`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Notebook 编辑失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
