/**
 * Write 工具 - 写入文件内容
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface WriteInput {
  file_path: string;
  content: string;
}

export async function writeTool(
  input: WriteInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file_path, content } = input;

    // 解析并验证路径
    const resolvedPath = resolvePath(file_path, workingDir);
    const validation = validatePath(resolvedPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查文件大小（限制 10MB）
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentSize = Buffer.byteLength(content, 'utf-8');
    if (contentSize > maxSize) {
      return {
        content: `错误: 内容太大 (${(contentSize / 1024 / 1024).toFixed(2)}MB)，最大支持 10MB`,
        isError: true,
      };
    }

    // 确保目录存在
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // 检查是否是新建文件
    let isNewFile = false;
    try {
      await fs.access(resolvedPath);
    } catch {
      isNewFile = true;
    }

    // 写入文件
    await fs.writeFile(resolvedPath, content, 'utf-8');

    const relativePath = path.relative(workingDir, resolvedPath);
    const lineCount = content.split('\n').length;
    const action = isNewFile ? '创建' : '更新';

    return {
      content: `成功${action}文件: ${relativePath}\n写入 ${lineCount} 行，${contentSize} 字节`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `写入文件失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
