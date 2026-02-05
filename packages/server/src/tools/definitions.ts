/**
 * 工具定义 - 为 Claude API 定义的工具 JSON Schema
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
      default?: unknown;
    }>;
    required?: string[];
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'Read',
    description: '读取文件内容。可以指定起始行号和读取行数来读取文件的特定部分。',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要读取的文件路径（相对于项目目录或绝对路径）',
        },
        offset: {
          type: 'number',
          description: '起始行号（从1开始），默认为1',
        },
        limit: {
          type: 'number',
          description: '要读取的行数，默认读取全部',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'Write',
    description: '将内容写入文件。如果文件不存在则创建，如果存在则覆盖。',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要写入的文件路径',
        },
        content: {
          type: 'string',
          description: '要写入的内容',
        },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'Edit',
    description: '在文件中查找并替换文本。使用精确字符串匹配，支持替换所有匹配项。',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的文件路径',
        },
        old_string: {
          type: 'string',
          description: '要查找的原始文本',
        },
        new_string: {
          type: 'string',
          description: '替换后的新文本',
        },
        replace_all: {
          type: 'boolean',
          description: '是否替换所有匹配项，默认为 false（只替换第一个）',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'Bash',
    description: '执行 shell 命令并返回输出。用于运行构建、测试、git 操作等命令。',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的 shell 命令',
        },
        timeout: {
          type: 'number',
          description: '命令超时时间（毫秒），默认为 30000（30秒）',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'Glob',
    description: '使用 glob 模式匹配查找文件。支持 * 和 ** 等通配符。',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'glob 模式，如 "**/*.ts" 或 "src/**/*.js"',
        },
        path: {
          type: 'string',
          description: '搜索的起始目录，默认为项目根目录',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: '在文件中搜索匹配正则表达式的内容。支持指定文件类型和搜索路径。',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '要搜索的正则表达式',
        },
        path: {
          type: 'string',
          description: '搜索路径（文件或目录），默认为项目根目录',
        },
        glob: {
          type: 'string',
          description: '文件过滤的 glob 模式，如 "*.ts"',
        },
        output_mode: {
          type: 'string',
          description: '输出模式：content（显示匹配行）、files_with_matches（仅显示文件名）、count（显示匹配数量）',
          enum: ['content', 'files_with_matches', 'count'],
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'WebFetch',
    description: '抓取网页内容并提取信息。用于获取文档、API 响应等网络资源。',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要抓取的 URL',
        },
        prompt: {
          type: 'string',
          description: '描述要从页面提取的信息',
        },
      },
      required: ['url', 'prompt'],
    },
  },
];

/**
 * 获取所有工具定义
 */
export function getToolDefinitions(): ToolDefinition[] {
  return toolDefinitions;
}

/**
 * 根据名称获取工具定义
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolDefinitions.find(t => t.name === name);
}
