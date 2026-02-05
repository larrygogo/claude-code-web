/**
 * WebFetch 工具 - 抓取网页内容
 */

import { ToolResult } from './types.js';

export interface WebFetchInput {
  url: string;
  prompt: string;
}

/**
 * 将 HTML 转换为简单的文本
 */
function htmlToText(html: string): string {
  return html
    // 移除 script 和 style 标签及其内容
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // 移除 HTML 注释
    .replace(/<!--[\s\S]*?-->/g, '')
    // 将常见块级标签转换为换行
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
    // 移除所有其他标签
    .replace(/<[^>]+>/g, ' ')
    // 解码 HTML 实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // 清理多余空白
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function webFetchTool(
  input: WebFetchInput,
  _workingDir: string
): Promise<ToolResult> {
  try {
    const { url, prompt } = input;

    // 验证 URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      // 自动升级 HTTP 到 HTTPS
      if (parsedUrl.protocol === 'http:') {
        parsedUrl.protocol = 'https:';
      }
    } catch {
      return {
        content: `错误: 无效的 URL: ${url}`,
        isError: true,
      };
    }

    // 只允许 HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        content: `错误: 只支持 HTTP/HTTPS 协议`,
        isError: true,
      };
    }

    // 发起请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClaudeBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: `HTTP 错误: ${response.status} ${response.statusText}`,
          isError: true,
        };
      }

      // 检查内容类型
      const contentType = response.headers.get('content-type') || '';

      let content: string;

      if (contentType.includes('application/json')) {
        // JSON 响应
        const json = await response.json();
        content = JSON.stringify(json, null, 2);

        // 限制 JSON 大小
        if (content.length > 50000) {
          content = content.substring(0, 50000) + '\n...(JSON 被截断)';
        }
      } else if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        // HTML 或文本响应
        const html = await response.text();

        // 限制 HTML 大小
        const limitedHtml = html.length > 500000 ? html.substring(0, 500000) : html;

        // 转换为文本
        content = htmlToText(limitedHtml);

        // 限制最终文本大小
        if (content.length > 30000) {
          content = content.substring(0, 30000) + '\n...(内容被截断)';
        }
      } else {
        return {
          content: `不支持的内容类型: ${contentType}`,
          isError: true,
        };
      }

      // 构建输出
      let output = `URL: ${parsedUrl.toString()}\n`;
      output += `提取目标: ${prompt}\n`;
      output += `${'─'.repeat(50)}\n\n`;
      output += content;

      return {
        content: output,
        isError: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        return {
          content: `请求超时 (30s)`,
          isError: true,
        };
      }

      throw error;
    }
  } catch (error) {
    return {
      content: `WebFetch 失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
