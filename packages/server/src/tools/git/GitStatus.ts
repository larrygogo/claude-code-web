/**
 * GitStatus 工具 - 格式化的 git status
 */

import { spawn } from 'child_process';
import { ToolResult } from '../types.js';
import { resolvePath, validatePath } from '../utils.js';

export interface GitStatusInput {
  path?: string;
  short?: boolean;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 执行 Git 命令
 */
export async function execGit(args: string[], workingDir: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd: workingDir,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code || 0,
      });
    });

    proc.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

interface StatusSummary {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  deleted: string[];
  renamed: string[];
  conflicted: string[];
}

/**
 * 解析 git status 输出
 */
function parseGitStatus(stdout: string): StatusSummary {
  const lines = stdout.split('\n');
  const summary: StatusSummary = {
    branch: 'unknown',
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    deleted: [],
    renamed: [],
    conflicted: [],
  };

  for (const line of lines) {
    if (!line) continue;

    // 分支信息
    if (line.startsWith('##')) {
      const branchMatch = line.match(/^## (\S+?)(?:\.\.\.(\S+))?/);
      if (branchMatch) {
        summary.branch = branchMatch[1];
      }

      const aheadMatch = line.match(/ahead (\d+)/);
      if (aheadMatch) summary.ahead = parseInt(aheadMatch[1]);

      const behindMatch = line.match(/behind (\d+)/);
      if (behindMatch) summary.behind = parseInt(behindMatch[1]);
      continue;
    }

    // 文件状态
    const status = line.substring(0, 2);
    const file = line.substring(3);

    // 暂存区状态 (索引)
    const indexStatus = status[0];
    // 工作区状态
    const workStatus = status[1];

    // 冲突文件
    if (status === 'UU' || status === 'AA' || status === 'DD') {
      summary.conflicted.push(file);
      continue;
    }

    // 暂存的更改
    if (indexStatus !== ' ' && indexStatus !== '?') {
      if (indexStatus === 'A') {
        summary.staged.push(`新文件: ${file}`);
      } else if (indexStatus === 'M') {
        summary.staged.push(`修改: ${file}`);
      } else if (indexStatus === 'D') {
        summary.staged.push(`删除: ${file}`);
      } else if (indexStatus === 'R') {
        summary.renamed.push(file);
      }
    }

    // 工作区更改
    if (workStatus === 'M') {
      summary.modified.push(file);
    } else if (workStatus === 'D') {
      summary.deleted.push(file);
    } else if (workStatus === '?') {
      summary.untracked.push(file);
    }
  }

  return summary;
}

/**
 * 格式化状态摘要
 */
function formatStatusSummary(summary: StatusSummary): string {
  const lines: string[] = [];

  // 分支信息
  lines.push(`分支: ${summary.branch}`);
  if (summary.ahead > 0 || summary.behind > 0) {
    const parts: string[] = [];
    if (summary.ahead > 0) parts.push(`领先 ${summary.ahead} 个提交`);
    if (summary.behind > 0) parts.push(`落后 ${summary.behind} 个提交`);
    lines.push(`  ${parts.join(', ')}`);
  }
  lines.push('');

  // 冲突文件
  if (summary.conflicted.length > 0) {
    lines.push('冲突文件:');
    for (const file of summary.conflicted) {
      lines.push(`  ⚠️  ${file}`);
    }
    lines.push('');
  }

  // 暂存的更改
  if (summary.staged.length > 0) {
    lines.push('暂存的更改:');
    for (const item of summary.staged) {
      lines.push(`  ✓ ${item}`);
    }
    lines.push('');
  }

  // 已修改
  if (summary.modified.length > 0) {
    lines.push('已修改 (未暂存):');
    for (const file of summary.modified) {
      lines.push(`  M ${file}`);
    }
    lines.push('');
  }

  // 已删除
  if (summary.deleted.length > 0) {
    lines.push('已删除 (未暂存):');
    for (const file of summary.deleted) {
      lines.push(`  D ${file}`);
    }
    lines.push('');
  }

  // 重命名
  if (summary.renamed.length > 0) {
    lines.push('重命名:');
    for (const file of summary.renamed) {
      lines.push(`  R ${file}`);
    }
    lines.push('');
  }

  // 未跟踪
  if (summary.untracked.length > 0) {
    lines.push('未跟踪的文件:');
    for (const file of summary.untracked) {
      lines.push(`  ? ${file}`);
    }
    lines.push('');
  }

  // 如果没有任何更改
  if (
    summary.staged.length === 0 &&
    summary.modified.length === 0 &&
    summary.deleted.length === 0 &&
    summary.untracked.length === 0 &&
    summary.conflicted.length === 0 &&
    summary.renamed.length === 0
  ) {
    lines.push('工作区是干净的');
  }

  return lines.join('\n').trim();
}

export async function gitStatusTool(
  input: GitStatusInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { path: targetPath, short = false } = input;

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

    // 获取 git status
    const args = ['status', '--porcelain=2', '--branch'];
    if (short) {
      args.push('--short');
    }

    const result = await execGit(args, repoPath);

    if (result.exitCode !== 0) {
      return {
        content: `Git status 失败: ${result.stderr || result.stdout}`,
        isError: true,
      };
    }

    if (short) {
      // 短格式直接返回
      return {
        content: result.stdout || '工作区是干净的',
        isError: false,
      };
    }

    // 解析并格式化输出
    const summary = parseGitStatus(result.stdout);
    const formatted = formatStatusSummary(summary);

    return {
      content: formatted,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Git status 失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
