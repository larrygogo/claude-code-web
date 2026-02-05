export interface BuiltinSkill {
  name: string;
  description: string;
  prompt: string;
}

export const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    name: 'commit',
    description: '提交代码更改',
    prompt: `请帮我提交当前的代码更改。请执行以下步骤：

1. 使用 Bash 工具执行 \`git status\` 查看当前更改
2. 使用 Bash 工具执行 \`git diff --staged\` 查看已暂存的更改
3. 如果没有已暂存的更改，使用 \`git diff\` 查看未暂存的更改
4. 分析更改内容，生成合适的提交信息（使用中文）
5. 使用 Bash 执行 git add 和 git commit
6. 提交信息格式：简短的标题（不超过50字），后面可以跟详细描述

注意事项：
- 不要提交 .env、credentials 等敏感文件
- 提交信息要准确描述更改内容
- 如果用户提供了额外参数，将其作为提交信息的补充`,
  },
  {
    name: 'review-pr',
    description: '审查当前分支的代码更改',
    prompt: `请帮我审查当前分支的代码更改。请执行以下步骤：

1. 使用 Bash 工具执行 \`git log --oneline -10\` 查看最近的提交
2. 使用 Bash 工具执行 \`git diff main...HEAD\` 或 \`git diff master...HEAD\` 查看与主分支的差异
3. 如果上述命令失败，尝试 \`git diff HEAD~5..HEAD\` 查看最近的更改
4. 仔细分析代码更改，检查以下方面：
   - 代码质量和可读性
   - 潜在的 bug 或逻辑错误
   - 安全漏洞（如 SQL 注入、XSS 等）
   - 性能问题
   - 是否遵循项目的代码风格
5. 提供详细的审查报告，包括：
   - 总体评价
   - 发现的问题（按严重程度排序）
   - 改进建议
   - 值得肯定的地方`,
  },
  {
    name: 'fix',
    description: '修复代码中的错误',
    prompt: `请帮我修复代码中的错误。

用户描述的问题：{{args}}

请执行以下步骤：

1. 分析用户描述的问题
2. 使用 Grep 和 Glob 工具定位相关代码
3. 使用 Read 工具查看代码内容
4. 分析问题原因
5. 使用 Edit 工具修复问题
6. 解释修复方案

如果用户没有提供问题描述，请询问具体的错误信息或问题现象。`,
  },
  {
    name: 'explain',
    description: '解释代码的功能和实现',
    prompt: `请帮我解释代码的功能和实现。

用户指定的代码或文件：{{args}}

请执行以下步骤：

1. 如果用户指定了文件路径，使用 Read 工具读取文件
2. 如果用户提供了代码片段，直接分析
3. 如果需要查找文件，使用 Glob 和 Grep 工具
4. 提供详细的解释，包括：
   - 代码的整体功能
   - 关键函数/类的作用
   - 数据流和控制流
   - 依赖关系
   - 潜在的改进点

如果用户没有指定具体代码，请询问要解释哪部分代码。`,
  },
  {
    name: 'test',
    description: '运行项目测试',
    prompt: `请帮我运行项目的测试。

可选参数：{{args}}

请执行以下步骤：

1. 首先检查项目的 package.json 或其他配置文件，了解测试命令
2. 使用 Bash 工具执行测试命令（如 npm test, pnpm test, pytest 等）
3. 分析测试结果
4. 如果有失败的测试，分析失败原因并提供修复建议

如果用户提供了参数，将其传递给测试命令。`,
  },
  {
    name: 'help',
    description: '显示可用命令列表',
    prompt: `请显示所有可用的快捷命令列表。

这是一个特殊命令，请直接列出所有可用的命令及其描述，不需要执行任何工具。`,
  },
];

/**
 * 根据名称获取内置 Skill
 */
export function getBuiltinSkill(name: string): BuiltinSkill | undefined {
  return BUILTIN_SKILLS.find(s => s.name === name);
}

/**
 * 检查是否为内置 Skill
 */
export function isBuiltinSkill(name: string): boolean {
  return BUILTIN_SKILLS.some(s => s.name === name);
}
