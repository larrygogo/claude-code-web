/**
 * Read 工具 - 读取文件内容
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath, formatFileContent } from './utils.js';

export interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export async function readTool(
  input: ReadInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file_path, offset = 1, limit } = input;

    // 解析并验证路径
    const resolvedPath = resolvePath(file_path, workingDir);
    const validation = validatePath(resolvedPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查文件是否存在
    try {
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        return {
          content: `错误: "${file_path}" 是一个目录，不是文件。使用 Bash 工具执行 ls 命令来查看目录内容。`,
          isError: true,
        };
      }
    } catch {
      return {
        content: `错误: 文件不存在: ${file_path}`,
        isError: true,
      };
    }

    // 检查文件大小（限制 10MB）
    const stat = await fs.stat(resolvedPath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stat.size > maxSize) {
      return {
        content: `错误: 文件太大 (${(stat.size / 1024 / 1024).toFixed(2)}MB)，最大支持 10MB`,
        isError: true,
      };
    }

    // 读取文件内容
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    // 应用 offset 和 limit
    const startLine = Math.max(1, offset) - 1; // 转为0索引
    const endLine = limit ? startLine + limit : lines.length;
    const selectedLines = lines.slice(startLine, endLine);

    // 格式化输出（带行号）
    const formattedContent = formatFileContent(selectedLines, startLine + 1);

    // 添加文件信息
    const relativePath = path.relative(workingDir, resolvedPath);
    const header = `文件: ${relativePath}\n行 ${startLine + 1}-${Math.min(endLine, lines.length)} / 共 ${lines.length} 行\n${'─'.repeat(50)}\n`;

    return {
      content: header + formattedContent,
      isError: false,
    };
  } catch (error) {
    return {
      content: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
