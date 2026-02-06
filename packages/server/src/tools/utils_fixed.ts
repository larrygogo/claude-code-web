/**
 * 工具通用工具函数
 */

import * as path from 'path';
import { PathValidation } from './types.js';

/**
 * 解析路径（支持相对路径和绝对路径）
 */
export function resolvePath(filePath: string, workingDir: string): string {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.normalize(path.join(workingDir, filePath));
}

/**
 * 危险路径黑名单（Windows 系统目录）
 */
const DANGEROUS_PATHS_WIN = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
];

/**
 * 危险路径黑名单（Unix 系统目录）
 */
const DANGEROUS_PATHS_UNIX = [
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/etc',
  '/var',
  '/root',
];

/**
 * 验证路径安全性
 * @param resolvedPath 已解析的绝对路径
 * @param workingDir 工作目录（必须在此目录内）
 */
export function validatePath(
  resolvedPath: string,
  workingDir: string
): PathValidation {
  const normalizedPath = path.normalize(resolvedPath);
  const normalizedWorkingDir = path.normalize(workingDir);
  const isWindows = process.platform === 'win32';

  // 1. 检查是否在工作目录内
  const relativePath = path.relative(normalizedWorkingDir, normalizedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return {
      valid: false,
      error: `安全限制: 只能访问工作目录内的文件。工作目录: ${normalizedWorkingDir}，尝试访问: ${normalizedPath}`,
    };
  }

  // 2. 检查是否是危险的系统路径（双重保险）
  const dangerousPaths = isWindows ? DANGEROUS_PATHS_WIN : DANGEROUS_PATHS_UNIX;

  for (const dangerousPath of dangerousPaths) {
    const normalizedDangerous = path.normalize(dangerousPath);
    if (normalizedPath.toLowerCase().startsWith(normalizedDangerous.toLowerCase())) {
      return {
        valid: false,
        error: `安全限制: 不允许访问系统目录: ${normalizedDangerous}`,
      };
    }
  }

  // 3. 禁止访问敏感文件模式
  const sensitivePatterns = [
    /\.env$/i,
    /\.key$/i,
    /\.pem$/i,
    /\.p12$/i,
    /\.pfx$/i,
    /password/i,
    /secret/i,
    /credential/i,
    /private.*key/i,
  ];

  const fileName = path.basename(normalizedPath);
  for (const pattern of sensitivePatterns) {
    if (pattern.test(fileName)) {
      return {
        valid: false,
        error: `安全限制: 不允许访问可能包含敏感信息的文件: ${fileName}`,
      };
    }
  }

  return { valid: true };
}

/**
 * 格式化文件内容（添加行号）
 */
export function formatFileContent(lines: string[], startLine: number): string {
  const maxLineNum = startLine + lines.length - 1;
  const lineNumWidth = String(maxLineNum).length;

  return lines
    .map((line, index) => {
      const lineNum = String(startLine + index).padStart(lineNumWidth, ' ');
      return `${lineNum} │ ${line}`;
    })
    .join('\n');
}

/**
 * 截断长字符串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * 解析大小字符串 (如 "+1M", "-100K")
 * 返回字节数，如果格式无效返回 null
 */
export function parseSize(sizeStr: string): number | null {
  const match = sizeStr.match(/^([+\-]?)(\d+(?:\.\d+)?)\s*([BKMGT])?$/i);
  if (!match) return null;

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
  return bytes;
}

/**
 * 解析时间字符串 (如 "-7d", "+1h")
 * 返回 Date 对象，如果格式无效返回 null
 */
export function parseTime(timeStr: string): Date | null {
  const match = timeStr.match(/^([+\-]?)(\d+)\s*([smhdwMy])$/);
  if (!match) return null;

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

  return new Date(now.getTime() - msOffset);
}