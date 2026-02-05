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
  // ==================== 新增工具 ====================
  // 文件操作增强
  {
    name: 'Ls',
    description: '列出目录内容。支持显示隐藏文件和详细信息（大小、修改时间等）。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径，默认为当前工作目录',
        },
        all: {
          type: 'boolean',
          description: '是否显示隐藏文件，默认为 false',
        },
        long: {
          type: 'boolean',
          description: '是否显示详细信息（大小、修改时间等），默认为 false',
        },
      },
      required: [],
    },
  },
  {
    name: 'FileTree',
    description: '生成目录树可视化。以树形结构展示目录层级。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径，默认为当前工作目录',
        },
        maxDepth: {
          type: 'number',
          description: '最大深度，默认为 3，最大 5',
        },
        includeHidden: {
          type: 'boolean',
          description: '是否包含隐藏文件，默认为 false',
        },
      },
      required: [],
    },
  },
  {
    name: 'MultiEdit',
    description: '批量编辑文件，一次执行多处替换。所有编辑必须有唯一匹配才会执行。',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的文件路径',
        },
        edits: {
          type: 'array',
          description: '编辑操作列表，每个包含 old_string 和 new_string',
          items: {
            type: 'object',
          },
        },
      },
      required: ['file_path', 'edits'],
    },
  },
  {
    name: 'Diff',
    description: '比较两个文件的差异。输出统一 diff 格式。',
    input_schema: {
      type: 'object',
      properties: {
        file1: {
          type: 'string',
          description: '第一个文件路径',
        },
        file2: {
          type: 'string',
          description: '第二个文件路径',
        },
        context: {
          type: 'number',
          description: '上下文行数，默认为 3',
        },
      },
      required: ['file1', 'file2'],
    },
  },
  {
    name: 'NotebookEdit',
    description: '编辑 Jupyter Notebook (.ipynb) 文件。支持更新、插入、删除 cell。',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Notebook 文件路径 (.ipynb)',
        },
        cell_index: {
          type: 'number',
          description: 'Cell 索引（从 0 开始）',
        },
        action: {
          type: 'string',
          description: '操作类型',
          enum: ['update', 'insert', 'delete'],
        },
        cell_type: {
          type: 'string',
          description: 'Cell 类型（用于 insert 和 update）',
          enum: ['code', 'markdown'],
        },
        source: {
          type: 'string',
          description: 'Cell 内容（用于 update 和 insert）',
        },
      },
      required: ['file_path', 'cell_index', 'action'],
    },
  },
  {
    name: 'Find',
    description: '高级文件查找。支持按名称、类型、大小、修改时间过滤。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '搜索起始目录，默认为当前工作目录',
        },
        name: {
          type: 'string',
          description: '文件名模式（支持 glob），如 "*.ts"',
        },
        type: {
          type: 'string',
          description: '类型过滤',
          enum: ['file', 'directory', 'all'],
        },
        size: {
          type: 'string',
          description: '大小过滤，如 "+1M"(大于1MB), "-100K"(小于100KB)',
        },
        mtime: {
          type: 'string',
          description: '修改时间过滤，如 "-7d"(7天内), "+1h"(1小时前)',
        },
        maxDepth: {
          type: 'number',
          description: '最大搜索深度，默认为 10',
        },
        limit: {
          type: 'number',
          description: '结果数量限制，默认为 100',
        },
      },
      required: [],
    },
  },
  // Git 工具
  {
    name: 'GitStatus',
    description: '显示 Git 仓库状态。包含分支信息、暂存更改、未暂存更改、未跟踪文件等。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '仓库路径，默认为当前工作目录',
        },
        short: {
          type: 'boolean',
          description: '是否使用简短格式，默认为 false',
        },
      },
      required: [],
    },
  },
  {
    name: 'GitDiff',
    description: '查看 Git 差异。可以查看工作区、暂存区的更改，或与特定提交比较。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '仓库路径，默认为当前工作目录',
        },
        staged: {
          type: 'boolean',
          description: '只显示暂存的更改，默认为 false',
        },
        file: {
          type: 'string',
          description: '指定文件路径',
        },
        commit: {
          type: 'string',
          description: '与特定提交比较',
        },
      },
      required: [],
    },
  },
  {
    name: 'GitLog',
    description: '显示 Git 提交历史。支持限制数量、过滤作者、查看特定文件的历史。',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '仓库路径，默认为当前工作目录',
        },
        limit: {
          type: 'number',
          description: '显示的提交数量，默认为 10，最大 50',
        },
        oneline: {
          type: 'boolean',
          description: '是否使用单行格式，默认为 false',
        },
        file: {
          type: 'string',
          description: '查看特定文件的提交历史',
        },
        author: {
          type: 'string',
          description: '按作者过滤',
        },
      },
      required: [],
    },
  },
  // 搜索增强
  {
    name: 'WebSearch',
    description: '网络搜索（使用 DuckDuckGo）。返回搜索结果列表。',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
        limit: {
          type: 'number',
          description: '结果数量，默认为 5',
        },
        site: {
          type: 'string',
          description: '限定搜索网站，如 "github.com"',
        },
      },
      required: ['query'],
    },
  },
  // 任务管理
  {
    name: 'TodoRead',
    description: '读取当前会话的任务列表。支持按状态过滤。',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '会话 ID（必需）',
        },
        status: {
          type: 'string',
          description: '状态过滤',
          enum: ['pending', 'in_progress', 'completed', 'all'],
        },
        limit: {
          type: 'number',
          description: '结果数量限制，默认为 50',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'TodoWrite',
    description: '创建、更新或删除任务。任务存储在会话级别。',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '会话 ID（必需）',
        },
        action: {
          type: 'string',
          description: '操作类型',
          enum: ['create', 'update', 'delete'],
        },
        subject: {
          type: 'string',
          description: '任务主题（用于 create 和 update）',
        },
        description: {
          type: 'string',
          description: '任务描述',
        },
        taskId: {
          type: 'string',
          description: '任务 ID（用于 update 和 delete）',
        },
        status: {
          type: 'string',
          description: '任务状态（用于 update）',
          enum: ['pending', 'in_progress', 'completed'],
        },
        blockedBy: {
          type: 'array',
          description: '阻塞该任务的其他任务 ID 列表',
          items: {
            type: 'string',
          },
        },
      },
      required: ['sessionId', 'action'],
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
