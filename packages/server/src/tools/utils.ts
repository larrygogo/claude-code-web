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
 * @param workingDir 工作目录（未使用，保留参数以保持兼容性）
 */
export function validatePath(
  resolvedPath: string,
  _workingDir: string
): PathValidation {
  const normalizedPath = path.normalize(resolvedPath);
  const isWindows = process.platform === 'win32';

  // 检查是否是危险的系统路径
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
