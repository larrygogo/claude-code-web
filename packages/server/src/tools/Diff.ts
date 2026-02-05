/**
 * Diff 工具 - 比较两个文件差异
 */

import * as fs from 'fs/promises';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface DiffInput {
  file1: string;
  file2: string;
  context?: number;     // 上下文行数，默认 3
}

interface DiffChange {
  type: 'add' | 'remove' | 'equal';
  line: string;
  lineNum1?: number;
  lineNum2?: number;
}

/**
 * 简单的行级别 diff 算法（基于 LCS）
 */
function computeDiff(lines1: string[], lines2: string[]): DiffChange[] {
  const m = lines1.length;
  const n = lines2.length;

  // 计算 LCS 矩阵
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯构建 diff
  const changes: DiffChange[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      changes.unshift({
        type: 'equal',
        line: lines1[i - 1],
        lineNum1: i,
        lineNum2: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({
        type: 'add',
        line: lines2[j - 1],
        lineNum2: j,
      });
      j--;
    } else {
      changes.unshift({
        type: 'remove',
        line: lines1[i - 1],
        lineNum1: i,
      });
      i--;
    }
  }

  return changes;
}

/**
 * 格式化 diff 输出（带上下文）
 */
function formatDiff(
  changes: DiffChange[],
  file1: string,
  file2: string,
  contextLines: number
): string {
  const output: string[] = [];

  output.push(`--- ${file1}`);
  output.push(`+++ ${file2}`);
  output.push('');

  // 找出有差异的区域
  const diffIndices: number[] = [];
  changes.forEach((change, index) => {
    if (change.type !== 'equal') {
      diffIndices.push(index);
    }
  });

  if (diffIndices.length === 0) {
    output.push('文件内容相同');
    return output.join('\n');
  }

  // 合并相邻的差异区域
  const hunks: { start: number; end: number }[] = [];
  let currentHunk: { start: number; end: number } | null = null;

  for (const idx of diffIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(changes.length - 1, idx + contextLines);

    if (currentHunk === null) {
      currentHunk = { start, end };
    } else if (start <= currentHunk.end + 1) {
      currentHunk.end = end;
    } else {
      hunks.push(currentHunk);
      currentHunk = { start, end };
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // 输出每个 hunk
  for (const hunk of hunks) {
    // 计算行号范围
    let line1Start = 0;
    let line1Count = 0;
    let line2Start = 0;
    let line2Count = 0;

    for (let i = hunk.start; i <= hunk.end; i++) {
      const change = changes[i];
      if (change.type === 'equal' || change.type === 'remove') {
        if (line1Start === 0 && change.lineNum1) line1Start = change.lineNum1;
        line1Count++;
      }
      if (change.type === 'equal' || change.type === 'add') {
        if (line2Start === 0 && change.lineNum2) line2Start = change.lineNum2;
        line2Count++;
      }
    }

    output.push(`@@ -${line1Start},${line1Count} +${line2Start},${line2Count} @@`);

    // 输出变更行
    for (let i = hunk.start; i <= hunk.end; i++) {
      const change = changes[i];
      switch (change.type) {
        case 'equal':
          output.push(` ${change.line}`);
          break;
        case 'add':
          output.push(`+${change.line}`);
          break;
        case 'remove':
          output.push(`-${change.line}`);
          break;
      }
    }

    output.push('');
  }

  return output.join('\n');
}

/**
 * 生成统计摘要
 */
function generateSummary(changes: DiffChange[]): string {
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    if (change.type === 'add') additions++;
    if (change.type === 'remove') deletions++;
  }

  if (additions === 0 && deletions === 0) {
    return '文件内容相同';
  }

  return `${additions} 行新增, ${deletions} 行删除`;
}

export async function diffTool(
  input: DiffInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file1, file2, context = 3 } = input;

    // 验证上下文行数
    const contextLines = Math.min(Math.max(context, 0), 10);

    // 解析路径
    const resolvedPath1 = resolvePath(file1, workingDir);
    const resolvedPath2 = resolvePath(file2, workingDir);

    // 验证路径
    const validation1 = validatePath(resolvedPath1, workingDir);
    if (!validation1.valid) {
      return {
        content: `文件1 ${validation1.error || '路径验证失败'}`,
        isError: true,
      };
    }

    const validation2 = validatePath(resolvedPath2, workingDir);
    if (!validation2.valid) {
      return {
        content: `文件2 ${validation2.error || '路径验证失败'}`,
        isError: true,
      };
    }

    // 读取文件内容
    let content1: string;
    let content2: string;

    try {
      content1 = await fs.readFile(resolvedPath1, 'utf-8');
    } catch {
      return {
        content: `错误: 无法读取文件: ${file1}`,
        isError: true,
      };
    }

    try {
      content2 = await fs.readFile(resolvedPath2, 'utf-8');
    } catch {
      return {
        content: `错误: 无法读取文件: ${file2}`,
        isError: true,
      };
    }

    // 分割成行
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // 计算 diff
    const changes = computeDiff(lines1, lines2);

    // 格式化输出
    const diffOutput = formatDiff(changes, file1, file2, contextLines);
    const summary = generateSummary(changes);

    return {
      content: `${summary}\n\n${diffOutput}`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Diff 失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
