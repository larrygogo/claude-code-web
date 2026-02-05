/**
 * GitLog 工具 - 提交历史
 */

import { ToolResult } from '../types.js';
import { resolvePath, validatePath } from '../utils.js';
import { execGit } from './GitStatus.js';

export interface GitLogInput {
  path?: string;
  limit?: number;       // 默认 10，最大 50
  oneline?: boolean;
  file?: string;
  author?: string;
}

interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  date: string;
  relativeDate: string;
  subject: string;
  body: string;
}

/**
 * 解析 git log 输出
 */
function parseGitLog(stdout: string): CommitInfo[] {
  if (!stdout.trim()) {
    return [];
  }

  const commits: CommitInfo[] = [];
  const commitBlocks = stdout.split('\n---COMMIT_SEPARATOR---\n').filter(block => block.trim());

  for (const block of commitBlocks) {
    const lines = block.split('\n');
    if (lines.length < 6) continue;

    commits.push({
      hash: lines[0] || '',
      shortHash: lines[1] || '',
      author: lines[2] || '',
      authorEmail: lines[3] || '',
      date: lines[4] || '',
      relativeDate: lines[5] || '',
      subject: lines[6] || '',
      body: lines.slice(7).join('\n').trim(),
    });
  }

  return commits;
}

/**
 * 格式化提交历史
 */
function formatCommitHistory(commits: CommitInfo[], oneline: boolean): string {
  if (commits.length === 0) {
    return '没有提交记录';
  }

  if (oneline) {
    return commits
      .map(c => `${c.shortHash} ${c.subject}`)
      .join('\n');
  }

  const lines: string[] = [];

  for (const commit of commits) {
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`提交: ${commit.shortHash} (${commit.hash.substring(0, 12)})`);
    lines.push(`作者: ${commit.author} <${commit.authorEmail}>`);
    lines.push(`日期: ${commit.date} (${commit.relativeDate})`);
    lines.push('');
    lines.push(`    ${commit.subject}`);
    if (commit.body) {
      lines.push('');
      for (const bodyLine of commit.body.split('\n')) {
        lines.push(`    ${bodyLine}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function gitLogTool(
  input: GitLogInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const {
      path: targetPath,
      limit = 10,
      oneline = false,
      file,
      author,
    } = input;

    // 限制数量
    const effectiveLimit = Math.min(Math.max(limit, 1), 50);

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

    // 构建 git log 命令
    const args = ['log'];

    if (oneline) {
      args.push('--oneline');
    } else {
      // 使用自定义格式
      args.push(
        '--format=%H%n%h%n%an%n%ae%n%ci%n%cr%n%s%n%b%n---COMMIT_SEPARATOR---'
      );
    }

    args.push(`-n`, String(effectiveLimit));

    if (author) {
      args.push(`--author=${author}`);
    }

    // 添加文件路径
    if (file) {
      args.push('--', file);
    }

    const result = await execGit(args, repoPath);

    if (result.exitCode !== 0) {
      // 可能是空仓库
      if (result.stderr.includes('does not have any commits')) {
        return {
          content: '仓库没有任何提交记录',
          isError: false,
        };
      }
      return {
        content: `Git log 失败: ${result.stderr || result.stdout}`,
        isError: true,
      };
    }

    // 格式化输出
    let output: string;
    if (oneline) {
      output = result.stdout || '没有提交记录';
    } else {
      const commits = parseGitLog(result.stdout);
      output = formatCommitHistory(commits, oneline);
    }

    // 添加标题
    let title = `最近 ${effectiveLimit} 条提交记录`;
    if (author) {
      title += ` (作者: ${author})`;
    }
    if (file) {
      title += ` (文件: ${file})`;
    }

    return {
      content: `${title}\n\n${output}`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Git log 失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
