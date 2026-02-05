/**
 * GitDiff 工具 - 查看代码差异
 */

import { ToolResult } from '../types.js';
import { resolvePath, validatePath } from '../utils.js';
import { execGit } from './GitStatus.js';

export interface GitDiffInput {
  path?: string;
  staged?: boolean;     // 只看暂存的
  file?: string;        // 特定文件
  commit?: string;      // 与特定提交比较
}

/**
 * 格式化 diff 输出，添加颜色标记
 */
function formatDiffOutput(diff: string): string {
  if (!diff.trim()) {
    return '没有差异';
  }

  const lines = diff.split('\n');
  const formattedLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      formattedLines.push(`\n${'═'.repeat(60)}`);
      formattedLines.push(line);
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      formattedLines.push(line);
    } else if (line.startsWith('@@')) {
      // 块头信息
      formattedLines.push(`\n${line}`);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      formattedLines.push(`+ ${line.substring(1)}`);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      formattedLines.push(`- ${line.substring(1)}`);
    } else {
      formattedLines.push(`  ${line}`);
    }
  }

  return formattedLines.join('\n');
}

export async function gitDiffTool(
  input: GitDiffInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { path: targetPath, staged = false, file, commit } = input;

    // 解析路径
    const repoPath = targetPath ? resolvePath(targetPath, workingDir) : workingDir;

    // 验证路径
    const validation = validatePath(repoPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查是否是 git 仓库
    const checkResult = await execGit(['rev-parse', '--git-dir'], repoPath);
    if (checkResult.exitCode !== 0) {
      return {
        content: `错误: "${repoPath}" 不是一个 Git 仓库`,
        isError: true,
      };
    }

    // 构建 git diff 命令
    const args = ['diff'];

    // 添加选项
    if (staged) {
      args.push('--staged');
    }

    if (commit) {
      args.push(commit);
    }

    // 添加文件路径
    if (file) {
      args.push('--', file);
    }

    const result = await execGit(args, repoPath);

    if (result.exitCode !== 0) {
      return {
        content: `Git diff 失败: ${result.stderr || result.stdout}`,
        isError: true,
      };
    }

    // 格式化输出
    const formatted = formatDiffOutput(result.stdout);

    // 添加摘要
    let summary = '';
    if (staged) {
      summary = '暂存区的更改';
    } else if (commit) {
      summary = `与提交 ${commit} 的差异`;
    } else {
      summary = '工作区的更改';
    }

    if (file) {
      summary += ` (文件: ${file})`;
    }

    return {
      content: `${summary}\n\n${formatted}`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Git diff 失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
