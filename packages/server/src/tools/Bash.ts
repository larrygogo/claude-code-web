/**
 * Bash 工具 - 执行 shell 命令
 */

import { spawn } from 'child_process';
import { ToolResult } from './types.js';

export interface BashInput {
  command: string;
  timeout?: number;
}

// 危险命令黑名单（用于警告，不完全阻止）
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,          // rm -rf / 或 rm -rf ~
  /mkfs\./i,                     // 格式化命令
  /dd\s+if=/i,                   // dd 命令
  />\s*\/dev\/sd/i,              // 写入磁盘设备
  /chmod\s+-R\s+777\s+\//i,      // 修改根目录权限
  /:\(\)\{\s*:\|:&\s*\};:/,      // fork 炸弹
];

export async function bashTool(
  input: BashInput,
  workingDir: string
): Promise<ToolResult> {
  const { command, timeout = 30000 } = input;

  // 检查危险命令
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        content: `拒绝执行: 检测到潜在危险命令。如果您确定要执行此操作，请直接在终端中运行。\n命令: ${command}`,
        isError: true,
      };
    }
  }

  return new Promise((resolve) => {
    // 确定使用的 shell
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn(shell, shellArgs, {
      cwd: workingDir,
      env: { ...process.env },
      shell: false,
    });

    // 设置超时
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
      // 给进程一点时间优雅退出
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 1000);
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      // 限制输出大小
      if (stdout.length > 100000) {
        stdout = stdout.substring(0, 100000) + '\n...(输出被截断)';
        proc.kill('SIGTERM');
      }
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
      // 限制输出大小
      if (stderr.length > 50000) {
        stderr = stderr.substring(0, 50000) + '\n...(输出被截断)';
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (killed) {
        resolve({
          content: `命令执行超时 (${timeout / 1000}s)\n\n已收集的输出:\n${stdout}\n${stderr}`.trim(),
          isError: true,
        });
        return;
      }

      // 格式化输出
      let output = '';
      if (stdout) {
        output += stdout;
      }
      if (stderr) {
        output += (output ? '\n\n' : '') + `stderr:\n${stderr}`;
      }
      if (!output) {
        output = '(无输出)';
      }

      // 添加退出码信息
      if (code !== 0) {
        output += `\n\n退出码: ${code}`;
      }

      resolve({
        content: output,
        isError: code !== 0,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        content: `命令执行失败: ${error.message}`,
        isError: true,
      });
    });
  });
}
