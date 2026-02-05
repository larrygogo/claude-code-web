/**
 * Ls 工具 - 目录列表（结构化输出）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface LsInput {
  path?: string;      // 目录路径
  all?: boolean;      // 显示隐藏文件
  long?: boolean;     // 显示详细信息
}

interface FileInfo {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: Date;
  permissions?: string;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (isThisYear) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  } else {
    return `${month}-${day}  ${date.getFullYear()}`;
  }
}

/**
 * 获取文件信息
 */
async function getFileInfo(filePath: string, name: string): Promise<FileInfo | null> {
  try {
    const stat = await fs.lstat(filePath);

    let type: 'file' | 'directory' | 'symlink' = 'file';
    if (stat.isDirectory()) type = 'directory';
    else if (stat.isSymbolicLink()) type = 'symlink';

    return {
      name,
      type,
      size: stat.size,
      modified: stat.mtime,
    };
  } catch {
    return null;
  }
}

export async function lsTool(
  input: LsInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { path: targetPath, all = false, long = false } = input;

    // 解析目录路径
    const dirPath = targetPath ? resolvePath(targetPath, workingDir) : workingDir;

    // 验证路径
    const validation = validatePath(dirPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查目录是否存在
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return {
          content: `错误: "${targetPath || workingDir}" 不是一个目录`,
          isError: true,
        };
      }
    } catch {
      return {
        content: `错误: 目录不存在: ${targetPath || workingDir}`,
        isError: true,
      };
    }

    // 读取目录内容
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // 过滤隐藏文件
    const filteredEntries = all
      ? entries
      : entries.filter(entry => !entry.name.startsWith('.'));

    // 获取文件信息
    const fileInfos: FileInfo[] = [];
    for (const entry of filteredEntries) {
      const fullPath = path.join(dirPath, entry.name);
      const info = await getFileInfo(fullPath, entry.name);
      if (info) {
        fileInfos.push(info);
      }
    }

    // 排序：目录在前，然后按名称排序
    fileInfos.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    // 格式化输出
    if (fileInfos.length === 0) {
      return {
        content: '目录为空',
        isError: false,
      };
    }

    let output = '';

    if (long) {
      // 详细格式
      const lines: string[] = [];
      let totalSize = 0;

      for (const info of fileInfos) {
        const typeChar = info.type === 'directory' ? 'd' : info.type === 'symlink' ? 'l' : '-';
        const sizeStr = info.type === 'directory' ? '-' : formatFileSize(info.size);
        const dateStr = formatDate(info.modified);
        const nameStr = info.type === 'directory' ? `${info.name}/` : info.name;

        lines.push(`${typeChar}  ${sizeStr.padStart(8)}  ${dateStr}  ${nameStr}`);
        totalSize += info.size;
      }

      output = `总计 ${fileInfos.length} 项, ${formatFileSize(totalSize)}\n\n`;
      output += lines.join('\n');
    } else {
      // 简洁格式
      const names = fileInfos.map(info =>
        info.type === 'directory' ? `${info.name}/` : info.name
      );

      // 按列显示（每列最多20个字符）
      const maxNameLen = Math.max(...names.map(n => n.length));
      const colWidth = Math.min(Math.max(maxNameLen + 2, 15), 30);
      const termWidth = 80;
      const cols = Math.max(Math.floor(termWidth / colWidth), 1);

      const rows: string[] = [];
      for (let i = 0; i < names.length; i += cols) {
        const rowItems = names.slice(i, i + cols);
        rows.push(rowItems.map(n => n.padEnd(colWidth)).join(''));
      }

      output = rows.join('\n');
    }

    return {
      content: output,
      isError: false,
    };
  } catch (error) {
    return {
      content: `目录列表失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
