import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { projectService } from '../services/ProjectService.js';
import { adminService } from '../services/AdminService.js';
import { authMiddleware, requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router: RouterType = Router();

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
});

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const projects = await projectService.listProjects(userId);
  res.json({ success: true, data: projects });
}));

router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const input = createProjectSchema.parse(req.body);
  const project = await projectService.createProject(userId, input);
  res.json({ success: true, data: project });
}));

router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const project = await projectService.getProject(userId, req.params.id);
  res.json({ success: true, data: project });
}));

router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const input = updateProjectSchema.parse(req.body);
  const project = await projectService.updateProject(userId, req.params.id, input);
  res.json({ success: true, data: project });
}));

router.get('/:id/context', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const context = await projectService.getProjectContext(userId, req.params.id);
  res.json({ success: true, data: context });
}));

router.post('/:id/refresh-claude-md', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  const claudeMd = await projectService.refreshClaudeMd(userId, req.params.id);
  res.json({ success: true, data: { claudeMd } });
}));

router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = requireUser(req);
  await projectService.deleteProject(userId, req.params.id);
  res.json({ success: true });
}));

// AI 搜索项目路径
const searchPathSchema = z.object({
  description: z.string().min(1, 'Description is required'),
});

// 执行文件系统搜索
async function searchFileSystem(keywords: string[]): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const os = await import('os');
  const fs = await import('fs');
  const path = await import('path');
  const execAsync = promisify(exec);

  const results: Set<string> = new Set();
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';

  // 搜索位置
  const searchPaths = isWindows
    ? [
        homeDir,
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'Projects'),
        path.join(homeDir, 'Code'),
        path.join(homeDir, 'dev'),
        path.join(homeDir, 'workspace'),
        'C:\\Projects',
        'C:\\Code',
        'D:\\Projects',
        'D:\\Code',
        'E:\\Projects',
        'E:\\Code',
      ]
    : [
        homeDir,
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'projects'),
        path.join(homeDir, 'code'),
        path.join(homeDir, 'dev'),
        path.join(homeDir, 'workspace'),
        '/opt',
        '/var/www',
      ];

  for (const searchPath of searchPaths) {
    // 检查路径是否存在
    try {
      await fs.promises.access(searchPath);
    } catch {
      continue;
    }

    for (const keyword of keywords) {
      if (!keyword || keyword.length < 2) continue;

      try {
        let command: string;
        if (isWindows) {
          // PowerShell 搜索
          command = `Get-ChildItem -Path "${searchPath}" -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*${keyword}*" } | Select-Object -First 10 -ExpandProperty FullName`;
        } else {
          // Linux/Mac find 命令
          command = `find "${searchPath}" -maxdepth 4 -type d -iname "*${keyword}*" 2>/dev/null | head -10`;
        }

        const { stdout } = await execAsync(command, {
          timeout: 15000,
          maxBuffer: 1024 * 1024,
          shell: isWindows ? 'powershell.exe' : '/bin/bash',
        });

        const paths = stdout.split('\n').filter(p => p.trim());
        for (const p of paths) {
          if (p.trim()) {
            results.add(p.trim());
          }
        }
      } catch {
        // 忽略单个搜索失败
      }
    }
  }

  // 对结果进行排序，缓存/临时目录优先级降低
  const lowPriorityPatterns = [
    /node_modules/i,
    /\.cache/i,
    /cache[s]?[\/\\]/i,
    /__pycache__/i,
    /\.git[\/\\]/i,
    /\.svn/i,
    /dist[\/\\]/i,
    /build[\/\\]/i,
    /out[\/\\]/i,
    /target[\/\\]/i,
    /\.next/i,
    /\.nuxt/i,
    /\.output/i,
    /tmp[\/\\]/i,
    /temp[\/\\]/i,
    /\.tmp/i,
    /\.temp/i,
    /AppData[\/\\]Local[\/\\]/i,
    /\.npm/i,
    /\.yarn/i,
    /\.pnpm/i,
    /vendor[\/\\]/i,
    /\.vscode/i,
    /\.idea/i,
    /Backup/i,
    /Old[\/\\]/i,
    /Archive/i,
    /\$Recycle/i,
    /\.Trash/i,
  ];

  const sorted = Array.from(results).sort((a, b) => {
    const aIsLowPriority = lowPriorityPatterns.some(p => p.test(a));
    const bIsLowPriority = lowPriorityPatterns.some(p => p.test(b));

    if (aIsLowPriority && !bIsLowPriority) return 1;
    if (!aIsLowPriority && bIsLowPriority) return -1;

    // 优先显示路径较短的（通常是项目根目录）
    return a.length - b.length;
  });

  return sorted.slice(0, 20);
}

router.post('/search-path', authMiddleware, asyncHandler(async (req, res) => {
  requireUser(req);
  const { description } = searchPathSchema.parse(req.body);

  // 让 AI 提取搜索关键词
  const systemPrompt = `你是一个帮助提取搜索关键词的助手。用户会描述他们要找的项目，你需要提取出可能的目录名称关键词。

规则：
1. 根据描述推断可能的项目目录名称
2. 返回 3-5 个最可能的关键词
3. 关键词应该是目录名可能包含的单词
4. 只返回 JSON，不要其他文字

返回格式：
{"keywords": ["keyword1", "keyword2", "keyword3"]}`;

  try {
    // 获取模型配置
    const modelConfig = await adminService.getActiveModelConfig();
    if (!modelConfig || !modelConfig.apiKey) {
      res.json({
        success: true,
        data: {
          paths: [],
          message: '未配置模型，无法使用 AI 搜索功能',
        },
      });
      return;
    }

    const response = await fetch(`${modelConfig.apiEndpoint || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': modelConfig.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelConfig.modelId,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: `项目描述：${description}` }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = data.content.find(b => b.type === 'text');
    let keywords: string[] = [];

    if (textBlock?.text) {
      try {
        // 尝试提取 JSON
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          keywords = parsed.keywords || [];
        }
      } catch {
        // 如果解析失败，直接用描述中的词
        keywords = description.split(/[\s,，、]+/).filter(w => w.length >= 2);
      }
    }

    // 如果没有提取到关键词，使用描述中的词
    if (keywords.length === 0) {
      keywords = description.split(/[\s,，、]+/).filter(w => w.length >= 2);
    }

    console.log('[SearchPath] Keywords:', keywords);

    // 执行文件系统搜索
    const paths = await searchFileSystem(keywords);

    if (paths.length === 0) {
      res.json({
        success: true,
        data: {
          paths: [],
          message: '未找到匹配的项目路径，请尝试其他描述',
        },
      });
      return;
    }

    // 用 AI 对结果进行分析和排序
    const rankPrompt = `你是一个帮助用户找到正确项目路径的助手。

用户描述：${description}

搜索到的路径列表：
${paths.map((p, i) => `${i + 1}. ${p}`).join('\n')}

请根据用户描述，对这些路径进行排序，把最可能是用户要找的项目路径排在前面。

排序依据：
1. 路径名称与用户描述的相关度
2. 看起来像项目根目录的优先（不是子目录或缓存目录）
3. 路径结构合理性

只返回 JSON，格式：{"ranked": [排序后的路径数组，最多10个], "reason": "简短说明为什么第一个最可能"}`;

    try {
      const rankResponse = await fetch(`${modelConfig.apiEndpoint || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': modelConfig.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelConfig.modelId,
          max_tokens: 512,
          messages: [{ role: 'user', content: rankPrompt }],
        }),
      });

      if (rankResponse.ok) {
        const rankData = await rankResponse.json() as {
          content: Array<{ type: string; text?: string }>;
        };

        const rankText = rankData.content.find(b => b.type === 'text')?.text;
        if (rankText) {
          const jsonMatch = rankText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.ranked && Array.isArray(parsed.ranked)) {
              res.json({
                success: true,
                data: {
                  paths: parsed.ranked.slice(0, 10),
                  message: parsed.reason || `找到 ${parsed.ranked.length} 个可能匹配的路径`,
                },
              });
              return;
            }
          }
        }
      }
    } catch (rankError) {
      console.error('[SearchPath] Rank error:', rankError);
      // 排序失败时使用原始结果
    }

    // 如果 AI 排序失败，返回原始结果
    res.json({
      success: true,
      data: {
        paths: paths.slice(0, 10),
        message: `找到 ${paths.length} 个可能匹配的路径`,
      },
    });
  } catch (error) {
    console.error('Search path error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : '搜索失败',
      },
    });
  }
}));

export default router;
