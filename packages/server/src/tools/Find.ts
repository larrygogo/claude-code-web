/**
 * Find 工具 - 高级文件查找（支持大小/时间过滤）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface FindInput {
  path?: string;
  name?: string;        // 文件名模式
  type?: 'file' | 'directory' | 'all';
  size?: string;        // "+1M", "-100K"
  mtime?: string;       // "-7d", "+1h"
  maxDepth?: number;
  limit?: number;
}

interface FileEntry {
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number;
  mtime: Date;
}

// 忽略的目录
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
  'venv',
  '.venv',
]);

/**
 * 解析大小字符串 (如 "+1M", "-100K")
 * 返回 [comparison, bytes]
 */
function parseSize(sizeStr: string): ['+' | '-' | '=', number] | null {
  const match = sizeStr.match(/^([+\-]?)(\d+(?:\.\d+)?)\s*([BKMGT])?$/i);
  if (!match) return null;

  const comparison = (match[1] || '=') as '+' | '-' | '=';
  let bytes = parseFloat(match[2]);
  const unit = (match[3] || 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'K': 1024,
    'M': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024,
  };

  bytes *= multipliers[unit] || 1;
  return [comparison, bytes];
}

/**
 * 解析时间字符串 (如 "-7d", "+1h")
 * 返回截止日期
 */
function parseTime(timeStr: string): ['+' | '-' | '=', Date] | null {
  const match = timeStr.match(/^([+\-]?)(\d+)\s*([smhdwMy])$/);
  if (!match) return null;

  const comparison = (match[1] || '-') as '+' | '-' | '=';
  const value = parseInt(match[2]);
  const unit = match[3];

  const now = new Date();
  let msOffset = 0;

  switch (unit) {
    case 's': msOffset = value * 1000; break;
    case 'm': msOffset = value * 60 * 1000; break;
    case 'h': msOffset = value * 60 * 60 * 1000; break;
    case 'd': msOffset = value * 24 * 60 * 60 * 1000; break;
    case 'w': msOffset = value * 7 * 24 * 60 * 60 * 1000; break;
    case 'M': msOffset = value * 30 * 24 * 60 * 60 * 1000; break;
    case 'y': msOffset = value * 365 * 24 * 60 * 60 * 1000; break;
    default: return null;
  }

  return [comparison, new Date(now.getTime() - msOffset)];
}

/**
 * 检查大小是否匹配
 */
function matchSize(fileSize: number, sizeFilter: ['+' | '-' | '=', number]): boolean {
  const [comparison, targetSize] = sizeFilter;
  switch (comparison) {
    case '+': return fileSize > targetSize;
    case '-': return fileSize < targetSize;
    case '=': return Math.abs(fileSize - targetSize) < targetSize * 0.01; // 1% 误差
  }
}

/**
 * 检查时间是否匹配
 */
function matchTime(fileMtime: Date, timeFilter: ['+' | '-' | '=', Date]): boolean {
  const [comparison, targetTime] = timeFilter;
  switch (comparison) {
    case '-': return fileMtime > targetTime;  // 最近 N 时间内修改
    case '+': return fileMtime < targetTime;  // N 时间之前修改
    case '=': return Math.abs(fileMtime.getTime() - targetTime.getTime()) < 60000; // 1分钟误差
  }
}

/**
 * 将 glob 模式转为正则
 */
function globToRegex(pattern: string): RegExp {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\?/g, '[^/\\\\]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  return new RegExp(`^${regex}$`, 'i');
}

/**
 * 递归查找文件
 */
async function findFiles(
  dirPath: string,
  basePath: string,
  options: {
    namePattern?: RegExp;
    typeFilter?: 'file' | 'directory' | 'all';
    sizeFilter?: ['+' | '-' | '=', number];
    timeFilter?: ['+' | '-' | '=', Date];
    maxDepth: number;
    limit: number;
  },
  currentDepth: number = 0,
  results: FileEntry[] = []
): Promise<FileEntry[]> {
  if (currentDepth > options.maxDepth || results.length >= options.limit) {
    return results;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= options.limit) break;

      // 跳过忽略的目录
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      // 跳过隐藏文件
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      const isDir = entry.isDirectory();

      // 类型过滤
      const typeFilter = options.typeFilter || 'all';
      if (typeFilter !== 'all') {
        if (typeFilter === 'file' && isDir) {
          // 继续搜索子目录
          if (isDir) {
            await findFiles(fullPath, basePath, options, currentDepth + 1, results);
          }
          continue;
        }
        if (typeFilter === 'directory' && !isDir) {
          continue;
        }
      }

      // 名称过滤
      if (options.namePattern && !options.namePattern.test(entry.name)) {
        if (isDir) {
          await findFiles(fullPath, basePath, options, currentDepth + 1, results);
        }
        continue;
      }

      // 获取文件信息
      try {
        const stat = await fs.stat(fullPath);

        // 大小过滤
        if (options.sizeFilter && !isDir) {
          if (!matchSize(stat.size, options.sizeFilter)) {
            if (isDir) {
              await findFiles(fullPath, basePath, options, currentDepth + 1, results);
            }
            continue;
          }
        }

        // 时间过滤
        if (options.timeFilter) {
          if (!matchTime(stat.mtime, options.timeFilter)) {
            if (isDir) {
              await findFiles(fullPath, basePath, options, currentDepth + 1, results);
            }
            continue;
          }
        }

        results.push({
          path: fullPath,
          relativePath,
          type: isDir ? 'directory' : 'file',
          size: stat.size,
          mtime: stat.mtime,
        });
      } catch {
        // 跳过无法访问的文件
      }

      // 递归搜索子目录
      if (isDir && results.length < options.limit) {
        await findFiles(fullPath, basePath, options, currentDepth + 1, results);
      }
    }
  } catch {
    // 跳过无法访问的目录
  }

  return results;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toISOString().substring(0, 16).replace('T', ' ');
}

export async function findTool(
  input: FindInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const {
      path: targetPath,
      name,
      type = 'all',
      size,
      mtime,
      maxDepth = 10,
      limit = 100,
    } = input;

    // 解析搜索路径
    const searchPath = targetPath ? resolvePath(targetPath, workingDir) : workingDir;

    // 验证路径
    const validation = validatePath(searchPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查目录是否存在
    try {
      const stat = await fs.stat(searchPath);
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

    // 解析过滤条件
    const namePattern = name ? globToRegex(name) : undefined;
    const sizeFilter = size ? parseSize(size) : undefined;
    const timeFilter = mtime ? parseTime(mtime) : undefined;

    if (size && !sizeFilter) {
      return {
        content: `错误: 无效的大小格式 "${size}"，使用 +1M, -100K 等格式`,
        isError: true,
      };
    }

    if (mtime && !timeFilter) {
      return {
        content: `错误: 无效的时间格式 "${mtime}"，使用 -7d, +1h 等格式`,
        isError: true,
      };
    }

    // 执行搜索
    const results = await findFiles(searchPath, searchPath, {
      namePattern,
      typeFilter: type,
      sizeFilter: sizeFilter || undefined,
      timeFilter: timeFilter || undefined,
      maxDepth: Math.min(Math.max(maxDepth, 1), 20),
      limit: Math.min(Math.max(limit, 1), 500),
    });

    // 格式化输出
    if (results.length === 0) {
      return {
        content: '未找到匹配的文件',
        isError: false,
      };
    }

    const lines: string[] = [];
    lines.push(`找到 ${results.length} 个结果:\n`);

    for (const entry of results) {
      const typeIcon = entry.type === 'directory' ? '📁' : '📄';
      const sizeStr = entry.type === 'file' ? formatSize(entry.size).padStart(8) : '       -';
      const dateStr = formatDate(entry.mtime);
      lines.push(`${typeIcon} ${sizeStr}  ${dateStr}  ${entry.relativePath}`);
    }

    if (results.length === limit) {
      lines.push(`\n(结果已截断，显示前 ${limit} 项)`);
    }

    return {
      content: lines.join('\n'),
      isError: false,
    };
  } catch (error) {
    return {
      content: `查找失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
