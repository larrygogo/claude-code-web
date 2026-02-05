/**
 * Grep 工具 - 在文件中搜索内容
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
}

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

/**
 * 简单的 glob 匹配
 */
function matchGlob(filename: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`, 'i').test(filename);
}

/**
 * 递归搜索文件
 */
async function searchFiles(
  dir: string,
  basePath: string,
  pattern: RegExp,
  globPattern: string | undefined,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<GrepMatch[]> {
  if (currentDepth > maxDepth) {
    return [];
  }

  const results: GrepMatch[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // 跳过隐藏文件和常见忽略目录
      if (entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === '__pycache__' ||
          entry.name === 'dist' ||
          entry.name === 'build') {
        continue;
      }

      if (entry.isDirectory()) {
        const subResults = await searchFiles(
          fullPath, basePath, pattern, globPattern, maxDepth, currentDepth + 1
        );
        results.push(...subResults);
      } else if (entry.isFile()) {
        // 检查 glob 过滤
        if (globPattern && !matchGlob(entry.name, globPattern)) {
          continue;
        }

        // 只搜索文本文件
        const ext = path.extname(entry.name).toLowerCase();
        const textExtensions = [
          '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
          '.json', '.md', '.txt', '.yaml', '.yml',
          '.html', '.css', '.scss', '.less',
          '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
          '.sh', '.bash', '.zsh', '.fish',
          '.xml', '.svg', '.vue', '.svelte',
          '.sql', '.graphql', '.prisma',
          '.env', '.gitignore', '.dockerignore',
          '.toml', '.ini', '.cfg', '.conf',
        ];

        // 允许无扩展名的特定文件
        const noExtFiles = ['Dockerfile', 'Makefile', 'README', 'LICENSE'];

        if (!textExtensions.includes(ext) && !noExtFiles.includes(entry.name)) {
          continue;
        }

        try {
          // 检查文件大小
          const stat = await fs.stat(fullPath);
          if (stat.size > 1024 * 1024) { // 跳过大于 1MB 的文件
            continue;
          }

          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const relativePath = path.relative(basePath, fullPath);

          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              results.push({
                file: relativePath,
                line: i + 1,
                content: lines[i].substring(0, 200), // 限制行长度
              });

              // 限制每个文件的匹配数
              if (results.filter(r => r.file === relativePath).length >= 50) {
                break;
              }
            }
          }
        } catch {
          // 忽略无法读取的文件
        }

        // 限制总结果数
        if (results.length >= 1000) {
          break;
        }
      }
    }
  } catch {
    // 忽略无法访问的目录
  }

  return results;
}

export async function grepTool(
  input: GrepInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { pattern, path: searchPath, glob: globPattern, output_mode = 'content' } = input;

    // 编译正则表达式
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      return {
        content: `错误: 无效的正则表达式: ${pattern}`,
        isError: true,
      };
    }

    // 确定搜索路径
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

    // 检查是文件还是目录
    let results: GrepMatch[] = [];

    try {
      const stat = await fs.stat(searchDir);

      if (stat.isFile()) {
        // 搜索单个文件
        const content = await fs.readFile(searchDir, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(workingDir, searchDir);

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({
              file: relativePath,
              line: i + 1,
              content: lines[i].substring(0, 200),
            });
          }
        }
      } else {
        // 搜索目录
        results = await searchFiles(searchDir, searchDir, regex, globPattern);
      }
    } catch {
      return {
        content: `错误: 路径不存在: ${searchPath || workingDir}`,
        isError: true,
      };
    }

    // 格式化输出
    if (results.length === 0) {
      return {
        content: `未找到匹配 "${pattern}" 的内容`,
        isError: false,
      };
    }

    let output = '';

    switch (output_mode) {
      case 'files_with_matches': {
        const files = [...new Set(results.map(r => r.file))];
        output = `找到 ${files.length} 个匹配文件:\n\n${files.join('\n')}`;
        break;
      }

      case 'count': {
        const fileCounts = results.reduce((acc, r) => {
          acc[r.file] = (acc[r.file] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const entries = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]);
        output = `找到 ${results.length} 处匹配:\n\n`;
        output += entries.map(([file, count]) => `${file}: ${count}`).join('\n');
        break;
      }

      case 'content':
      default: {
        output = `找到 ${results.length} 处匹配:\n\n`;

        // 按文件分组
        const byFile = results.reduce((acc, r) => {
          if (!acc[r.file]) acc[r.file] = [];
          acc[r.file].push(r);
          return acc;
        }, {} as Record<string, GrepMatch[]>);

        for (const [file, matches] of Object.entries(byFile)) {
          output += `── ${file} ──\n`;
          for (const match of matches.slice(0, 10)) { // 每个文件最多显示 10 个匹配
            output += `  ${match.line}: ${match.content}\n`;
          }
          if (matches.length > 10) {
            output += `  ... 还有 ${matches.length - 10} 处匹配\n`;
          }
          output += '\n';
        }

        if (results.length >= 1000) {
          output += '\n(结果已截断，请使用更精确的模式或限制搜索范围)';
        }
        break;
      }
    }

    return {
      content: output,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Grep 搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
