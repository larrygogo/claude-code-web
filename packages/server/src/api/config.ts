import { Router, Request, Response, type Router as RouterType } from 'express';
import { localConfigService } from '../services/LocalConfigService.js';
import { skillsService } from '../services/SkillsService.js';
import { mcpService } from '../services/McpService.js';
import { authMiddleware } from '../middleware/auth.js';

const router: RouterType = Router();

// 所有配置 API 都需要认证
router.use(authMiddleware);

/**
 * 获取本地 Skills 配置
 * GET /api/config/local/skills
 */
router.get('/local/skills', async (_req: Request, res: Response) => {
  try {
    const commands = await localConfigService.getLocalCommands();
    res.json({
      success: true,
      data: {
        commands,
        claudeDir: localConfigService.getClaudeDir(),
      },
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to get local skills:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取本地 MCP 配置
 * GET /api/config/local/mcp
 */
router.get('/local/mcp', async (_req: Request, res: Response) => {
  try {
    const mcpServers = await localConfigService.getLocalMcpServers();
    res.json({
      success: true,
      data: {
        mcpServers,
        claudeDir: localConfigService.getClaudeDir(),
      },
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to get local MCP config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 获取完整的本地配置
 * GET /api/config/local
 */
router.get('/local', async (_req: Request, res: Response) => {
  try {
    const config = await localConfigService.getLocalConfig();
    const exists = await localConfigService.checkLocalConfigExists();
    res.json({
      success: true,
      data: {
        ...config,
        claudeDir: localConfigService.getClaudeDir(),
        exists,
      },
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to get local config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 同步本地 MCP 配置到数据库
 * POST /api/config/sync/mcp
 */
router.post('/sync/mcp', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const localServers = await localConfigService.getLocalMcpServers();
    const existingServers = await mcpService.getServers(userId);

    const synced: string[] = [];
    const skipped: string[] = [];

    for (const localServer of localServers) {
      // 检查是否已存在同名服务器
      const existing = existingServers.find(s => s.name === localServer.name);
      if (existing) {
        skipped.push(localServer.name);
        continue;
      }

      // 创建新服务器
      await mcpService.createServer(userId, {
        name: localServer.name,
        command: localServer.command,
        args: localServer.args,
        env: localServer.env,
        enabled: true,
      });
      synced.push(localServer.name);
    }

    res.json({
      success: true,
      data: {
        synced,
        skipped,
        total: localServers.length,
      },
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to sync MCP config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 同步本地 Skills 到数据库
 * POST /api/config/sync/skills
 */
router.post('/sync/skills', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const localCommands = await localConfigService.getLocalCommands();
    const existingSkills = await skillsService.getUserSkills(userId);

    const synced: string[] = [];
    const skipped: string[] = [];

    for (const command of localCommands) {
      // 检查是否已存在同名 Skill
      const existing = existingSkills.find(s => s.name === command.name);
      if (existing) {
        skipped.push(command.name);
        continue;
      }

      // 创建新 Skill
      try {
        await skillsService.createSkill(userId, {
          name: command.name,
          description: command.description,
          prompt: command.prompt,
          enabled: true,
        });
        synced.push(command.name);
      } catch (error) {
        // 可能与内置 Skill 冲突
        console.warn(`[ConfigAPI] Failed to sync skill ${command.name}:`, error);
        skipped.push(command.name);
      }
    }

    res.json({
      success: true,
      data: {
        synced,
        skipped,
        total: localCommands.length,
      },
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to sync skills:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 同步所有本地配置
 * POST /api/config/sync
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 并行同步 Skills 和 MCP
    const [localCommands, localServers, existingSkills, existingServers] = await Promise.all([
      localConfigService.getLocalCommands(),
      localConfigService.getLocalMcpServers(),
      skillsService.getUserSkills(userId),
      mcpService.getServers(userId),
    ]);

    const result = {
      skills: { synced: [] as string[], skipped: [] as string[] },
      mcp: { synced: [] as string[], skipped: [] as string[] },
    };

    // 同步 Skills
    for (const command of localCommands) {
      const existing = existingSkills.find(s => s.name === command.name);
      if (existing) {
        result.skills.skipped.push(command.name);
        continue;
      }
      try {
        await skillsService.createSkill(userId, {
          name: command.name,
          description: command.description,
          prompt: command.prompt,
          enabled: true,
        });
        result.skills.synced.push(command.name);
      } catch {
        result.skills.skipped.push(command.name);
      }
    }

    // 同步 MCP
    for (const server of localServers) {
      const existing = existingServers.find(s => s.name === server.name);
      if (existing) {
        result.mcp.skipped.push(server.name);
        continue;
      }
      await mcpService.createServer(userId, {
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
        enabled: true,
      });
      result.mcp.synced.push(server.name);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[ConfigAPI] Failed to sync config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
