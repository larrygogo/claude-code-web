/**
 * Glob 工具 - 使用 glob 模式匹配查找文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface GlobInput {
  pattern: string;
  path?: string;
}

/**
 * 简单的 glob 模式匹配实现
 * 支持: * (匹配任意字符), ** (匹配任意目录层级), ? (匹配单个字符)
 */
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    // 转义正则特殊字符（除了 * 和 ?）
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // ** 匹配任意目录层级
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    // * 匹配任意字符（不包括路径分隔符）
    .replace(/\*/g, '[^/\\\\]*')
    // ? 匹配单个字符
    .replace(/\?/g, '[^/\\\\]')
    // 恢复 **
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  return new RegExp(`^${regex}$`, 'i');
}

/**
 * 递归遍历目录
 */
async function walkDir(
  dir: string,
  basePath: string,
  maxDepth: number = 20,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth > maxDepth) {
    return [];
  }

  const results: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      // 跳过隐藏文件和常见的忽略目录
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '__pycache__' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        const subResults = await walkDir(fullPath, basePath, maxDepth, currentDepth + 1);
        results.push(...subResults);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  } catch {
    // 忽略无法访问的目录
  }

  return results;
}

export async function globTool(
  input: GlobInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { pattern, path: searchPath } = input;

    // 确定搜索目录
    let searchDir = workingDir;
    if (searchPath) {
      searchDir = resolvePath(searchPath, workingDir);
      const validation = validatePath(searchDir, workingDir);
      if (!validation.valid) {
        return {
          content: validation.error || '路径验证失败',
          isError: true,
        };
      }
    }

    // 检查目录是否存在
    try {
      const stat = await fs.stat(searchDir);
      if (!stat.isDirectory()) {
        return {
          content: `错误: "${searchPath || workingDir}" 不是一个目录`,
          isError: true,
        };
      }
    } catch {
      return {
        content: `错误: 目录不存在: ${searchPath || workingDir}`,
        isError: true,
      };
    }

    // 获取所有文件
    const allFiles = await walkDir(searchDir, searchDir);

    // 匹配 glob 模式
    const regex = globToRegex(pattern);
    const matchedFiles = allFiles.filter(file => {
      // 统一使用正斜杠进行匹配
      const normalizedFile = file.replace(/\\/g, '/');
      return regex.test(normalizedFile);
    });

    // 限制结果数量
    const maxResults = 500;
    const truncated = matchedFiles.length > maxResults;
    const displayFiles = truncated ? matchedFiles.slice(0, maxResults) : matchedFiles;

    // 格式化输出
    if (displayFiles.length === 0) {
      return {
        content: `未找到匹配 "${pattern}" 的文件`,
        isError: false,
      };
    }

    let output = `找到 ${matchedFiles.length} 个匹配文件:\n\n`;
    output += displayFiles.join('\n');

    if (truncated) {
      output += `\n\n... 还有 ${matchedFiles.length - maxResults} 个文件未显示`;
    }

    return {
      content: output,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Glob 搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
