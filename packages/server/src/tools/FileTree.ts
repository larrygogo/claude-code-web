/**
 * FileTree 工具 - 目录树可视化
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface FileTreeInput {
  path?: string;
  maxDepth?: number;      // 默认 3，最大 5
  includeHidden?: boolean;
}

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
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
 * 递归构建目录树
 */
async function buildTree(
  dirPath: string,
  maxDepth: number,
  includeHidden: boolean,
  currentDepth: number = 0
): Promise<TreeNode[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const results: TreeNode[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // 排序：目录在前，然后按名称
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      // 跳过隐藏文件（如果不包含）
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // 跳过忽略的目录
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const node: TreeNode = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      };

      if (entry.isDirectory()) {
        const childPath = path.join(dirPath, entry.name);
        node.children = await buildTree(childPath, maxDepth, includeHidden, currentDepth + 1);
      }

      results.push(node);
    }
  } catch {
    // 忽略无法访问的目录
  }

  return results;
}

/**
 * 渲染目录树为字符串
 */
function renderTree(nodes: TreeNode[], prefix: string = '', isLast: boolean[] = []): string {
  const lines: string[] = [];

  nodes.forEach((node, index) => {
    const isLastNode = index === nodes.length - 1;

    // 构建前缀
    let linePrefix = prefix;
    for (let i = 0; i < isLast.length; i++) {
      linePrefix += isLast[i] ? '    ' : '│   ';
    }

    // 当前节点的连接符
    const connector = isLastNode ? '└── ' : '├── ';

    // 显示名称（目录后加 /）
    const displayName = node.type === 'directory' ? `${node.name}/` : node.name;
    lines.push(`${linePrefix}${connector}${displayName}`);

    // 递归渲染子节点
    if (node.children && node.children.length > 0) {
      const childLines = renderTree(node.children, prefix, [...isLast, isLastNode]);
      lines.push(childLines);
    }
  });

  return lines.join('\n');
}

/**
 * 统计文件和目录数量
 */
function countNodes(nodes: TreeNode[]): { files: number; directories: number } {
  let files = 0;
  let directories = 0;

  for (const node of nodes) {
    if (node.type === 'directory') {
      directories++;
      if (node.children) {
        const childCounts = countNodes(node.children);
        files += childCounts.files;
        directories += childCounts.directories;
      }
    } else {
      files++;
    }
  }

  return { files, directories };
}

export async function fileTreeTool(
  input: FileTreeInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const {
      path: targetPath,
      maxDepth = 3,
      includeHidden = false,
    } = input;

    // 限制最大深度
    const effectiveMaxDepth = Math.min(Math.max(maxDepth, 1), 5);

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

    // 获取目录名
    const rootName = path.basename(dirPath) || dirPath;

    // 构建目录树
    const tree = await buildTree(dirPath, effectiveMaxDepth, includeHidden);

    // 统计数量
    const counts = countNodes(tree);

    // 渲染输出
    let output = `${rootName}/\n`;

    if (tree.length > 0) {
      output += renderTree(tree);
    } else {
      output += '(空目录)';
    }

    output += `\n\n${counts.directories} 个目录, ${counts.files} 个文件`;

    if (effectiveMaxDepth !== maxDepth) {
      output += `\n(深度已限制为 ${effectiveMaxDepth} 层)`;
    }

    return {
      content: output,
      isError: false,
    };
  } catch (error) {
    return {
      content: `目录树生成失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
