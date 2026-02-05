/**
 * WebSearch 工具 - 网络搜索 (使用 DuckDuckGo)
 */

import { ToolResult } from '../types.js';

export interface WebSearchInput {
  query: string;
  limit?: number;       // 默认 5
  site?: string;        // 限定网站
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 使用 DuckDuckGo HTML 搜索
 */
async function searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`搜索请求失败: ${response.status}`);
    }

    const html = await response.text();

    // 解析 HTML 结果
    const results: SearchResult[] = [];

    // 匹配搜索结果
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/g;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=([^&]+).*/, '$1'));
      const title = match[2].trim();
      const snippet = match[3]
        .replace(/<[^>]+>/g, '') // 移除 HTML 标签
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (title && url && url.startsWith('http')) {
        results.push({ title, url, snippet });
      }
    }

    // 如果上面的正则没匹配到，尝试另一种模式
    if (results.length === 0) {
      const altResultRegex = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([^<]+)<\/a>/g;

      while ((match = altResultRegex.exec(html)) !== null && results.length < limit) {
        const rawUrl = match[1];
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          const url = decodeURIComponent(uddgMatch[1]);
          const title = match[2].trim();

          if (title && url && url.startsWith('http')) {
            results.push({
              title,
              url,
              snippet: '',
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    throw error;
  }
}

/**
 * 备用方案：使用 DuckDuckGo Instant Answer API
 * 注意：这个 API 主要返回即时答案，而不是搜索结果列表
 */
interface DuckDuckGoAPIResponse {
  Abstract?: string;
  AbstractURL?: string;
}

async function searchDuckDuckGoAPI(query: string): Promise<{ abstract: string; url: string } | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as DuckDuckGoAPIResponse;

    if (data.Abstract) {
      return {
        abstract: data.Abstract,
        url: data.AbstractURL || '',
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function webSearchTool(
  input: WebSearchInput,
  _workingDir: string
): Promise<ToolResult> {
  try {
    const { query, limit = 5, site } = input;

    if (!query || query.trim().length === 0) {
      return {
        content: '错误: 搜索关键词不能为空',
        isError: true,
      };
    }

    // 限制结果数量
    const effectiveLimit = Math.min(Math.max(limit, 1), 10);

    // 构建搜索查询
    let searchQuery = query;
    if (site) {
      searchQuery = `site:${site} ${query}`;
    }

    // 执行搜索
    let results: SearchResult[] = [];

    try {
      results = await searchDuckDuckGo(searchQuery, effectiveLimit);
    } catch (error) {
      // 如果 HTML 搜索失败，尝试 API
      const apiResult = await searchDuckDuckGoAPI(searchQuery);
      if (apiResult) {
        return {
          content: [
            `搜索: "${query}"`,
            '',
            '即时答案:',
            apiResult.abstract,
            '',
            apiResult.url ? `来源: ${apiResult.url}` : '',
          ].filter(Boolean).join('\n'),
          isError: false,
        };
      }

      return {
        content: `搜索失败: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }

    // 格式化输出
    if (results.length === 0) {
      return {
        content: `未找到与 "${query}" 相关的结果`,
        isError: false,
      };
    }

    const lines: string[] = [];
    lines.push(`搜索: "${query}"`);
    if (site) {
      lines.push(`限定网站: ${site}`);
    }
    lines.push(`找到 ${results.length} 个结果:\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      lines.push(`${i + 1}. ${result.title}`);
      lines.push(`   ${result.url}`);
      if (result.snippet) {
        lines.push(`   ${result.snippet}`);
      }
      lines.push('');
    }

    return {
      content: lines.join('\n'),
      isError: false,
    };
  } catch (error) {
    return {
      content: `网络搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}
