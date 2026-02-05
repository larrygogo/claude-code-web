/**
 * MultiEdit 工具 - 批量编辑（一次多处替换）
 */

import * as fs from 'fs/promises';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface EditOperation {
  old_string: string;
  new_string: string;
}

export interface MultiEditInput {
  file_path: string;
  edits: EditOperation[];
}

interface EditResult {
  index: number;
  old_string: string;
  success: boolean;
  error?: string;
  line?: number;
}

/**
 * 查找字符串在内容中的行号
 */
function findLineNumber(content: string, searchStr: string): number | undefined {
  const index = content.indexOf(searchStr);
  if (index === -1) return undefined;

  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

export async function multiEditTool(
  input: MultiEditInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file_path, edits } = input;

    // 验证输入
    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      return {
        content: '错误: edits 数组不能为空',
        isError: true,
      };
    }

    // 解析路径
    const resolvedPath = resolvePath(file_path, workingDir);

    // 验证路径
    const validation = validatePath(resolvedPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 读取文件内容
    let content: string;
    try {
      content = await fs.readFile(resolvedPath, 'utf-8');
    } catch {
      return {
        content: `错误: 无法读取文件: ${file_path}`,
        isError: true,
      };
    }

    // 验证所有编辑操作（预检查）
    const preCheckResults: EditResult[] = [];
    let tempContent = content;

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];

      if (!edit.old_string) {
        preCheckResults.push({
          index: i,
          old_string: edit.old_string,
          success: false,
          error: 'old_string 不能为空',
        });
        continue;
      }

      const count = (tempContent.match(new RegExp(escapeRegex(edit.old_string), 'g')) || []).length;

      if (count === 0) {
        preCheckResults.push({
          index: i,
          old_string: truncate(edit.old_string, 50),
          success: false,
          error: '未找到匹配的文本',
        });
      } else if (count > 1) {
        preCheckResults.push({
          index: i,
          old_string: truncate(edit.old_string, 50),
          success: false,
          error: `找到 ${count} 个匹配项，请提供更具体的上下文以唯一标识`,
        });
      } else {
        const lineNum = findLineNumber(tempContent, edit.old_string);
        preCheckResults.push({
          index: i,
          old_string: truncate(edit.old_string, 50),
          success: true,
          line: lineNum,
        });
        // 应用更改到临时内容（用于后续检查）
        tempContent = tempContent.replace(edit.old_string, edit.new_string);
      }
    }

    // 检查是否有失败的操作
    const failedOps = preCheckResults.filter(r => !r.success);
    if (failedOps.length > 0) {
      const lines: string[] = ['批量编辑预检查失败:'];
      for (const result of failedOps) {
        lines.push(`  编辑 #${result.index + 1}: ${result.error}`);
        lines.push(`    查找: "${result.old_string}"`);
      }
      lines.push('');
      lines.push('所有编辑操作均未执行，请修正后重试。');

      return {
        content: lines.join('\n'),
        isError: true,
      };
    }

    // 所有检查通过，执行编辑
    let modifiedContent = content;
    const successResults: string[] = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const lineNum = preCheckResults[i].line;
      modifiedContent = modifiedContent.replace(edit.old_string, edit.new_string);
      successResults.push(`  #${i + 1}: 第 ${lineNum} 行 - 已替换`);
    }

    // 写入文件
    await fs.writeFile(resolvedPath, modifiedContent, 'utf-8');

    // 格式化输出
    const output = [
      `成功编辑文件: ${file_path}`,
      `执行了 ${edits.length} 个编辑操作:`,
      '',
      ...successResults,
    ].join('\n');

    return {
      content: output,
      isError: false,
    };
  } catch (error) {
    return {
      content: `批量编辑失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 截断字符串
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
