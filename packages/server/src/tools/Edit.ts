/**
 * Edit 工具 - 编辑文件内容（查找并替换）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from './types.js';
import { resolvePath, validatePath } from './utils.js';

export interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export async function editTool(
  input: EditInput,
  workingDir: string
): Promise<ToolResult> {
  try {
    const { file_path, old_string, new_string, replace_all = false } = input;

    // 解析并验证路径
    const resolvedPath = resolvePath(file_path, workingDir);
    const validation = validatePath(resolvedPath, workingDir);
    if (!validation.valid) {
      return {
        content: validation.error || '路径验证失败',
        isError: true,
      };
    }

    // 检查文件是否存在
    try {
      await fs.access(resolvedPath);
    } catch {
      return {
        content: `错误: 文件不存在: ${file_path}`,
        isError: true,
      };
    }

    // 读取文件内容
    const content = await fs.readFile(resolvedPath, 'utf-8');

    // 检查原字符串是否存在
    if (!content.includes(old_string)) {
      // 尝试提供有用的提示
      const lines = content.split('\n');
      const preview = lines.slice(0, 10).join('\n');
      return {
        content: `错误: 在文件中找不到要替换的文本。\n\n要搜索的文本:\n"${old_string.substring(0, 200)}${old_string.length > 200 ? '...' : ''}"\n\n文件前 10 行预览:\n${preview}`,
        isError: true,
      };
    }

    // 执行替换
    let newContent: string;
    let replaceCount: number;

    if (replace_all) {
      // 计算替换次数
      replaceCount = content.split(old_string).length - 1;
      newContent = content.split(old_string).join(new_string);
    } else {
      // 只替换第一个
      replaceCount = 1;
      const index = content.indexOf(old_string);
      newContent = content.substring(0, index) + new_string + content.substring(index + old_string.length);
    }

    // 写回文件
    await fs.writeFile(resolvedPath, newContent, 'utf-8');

    const relativePath = path.relative(workingDir, resolvedPath);

    return {
      content: `成功编辑文件: ${relativePath}\n替换了 ${replaceCount} 处匹配`,
      isError: false,
    };
  } catch (error) {
    return {
      content: `编辑文件失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
