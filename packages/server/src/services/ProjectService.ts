import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  Project,
  ProjectCreateInput,
  ProjectListItem,
  ProjectContext,
  FileTreeNode,
} from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../middleware/error.js';

const CLAUDE_MD_FILENAME = 'CLAUDE.md';
const MAX_FILE_TREE_DEPTH = 3;
const IGNORED_DIRS = ['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv'];

export class ProjectService {
  async createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
    const db = getDatabase();

    const normalizedPath = path.normalize(input.path);
    const pathHash = this.hashPath(normalizedPath);

    try {
      const stat = await fs.stat(normalizedPath);
      if (!stat.isDirectory()) {
        throw new ValidationError('Path must be a directory');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ValidationError('Directory does not exist');
      }
      throw error;
    }

    const claudeMdContent = await this.loadClaudeMd(normalizedPath);

    const project = await db.project.upsert({
      where: {
        userId_pathHash: {
          userId,
          pathHash,
        },
      },
      create: {
        userId,
        name: input.name,
        path: normalizedPath,
        pathHash,
        claudeMdContent,
      },
      update: {
        name: input.name,
        claudeMdContent,
        lastAccessedAt: new Date(),
      },
    });

    return this.mapProject(project);
  }

  async getProject(userId: string, projectId: string): Promise<Project> {
    const db = getDatabase();

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project');
    }

    return this.mapProject(project);
  }

  async getProjectContext(userId: string, projectId: string): Promise<ProjectContext> {
    const db = getDatabase();

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project');
    }

    await db.project.update({
      where: { id: projectId },
      data: { lastAccessedAt: new Date() },
    });

    const claudeMd = await this.loadClaudeMd(project.path);

    if (claudeMd !== project.claudeMdContent) {
      await db.project.update({
        where: { id: projectId },
        data: { claudeMdContent: claudeMd },
      });
    }

    const fileTree = await this.buildFileTree(project.path);

    return {
      project: this.mapProject(project),
      claudeMd: claudeMd || undefined,
      fileTree,
    };
  }

  async listProjects(userId: string): Promise<ProjectListItem[]> {
    const db = getDatabase();

    const projects = await db.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: { sessions: true },
        },
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      sessionCount: p._count.sessions,
      lastAccessedAt: p.lastAccessedAt,
    }));
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const db = getDatabase();

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project');
    }

    await db.project.delete({ where: { id: projectId } });
  }

  async refreshClaudeMd(userId: string, projectId: string): Promise<string | null> {
    const db = getDatabase();

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Access denied to this project');
    }

    const claudeMd = await this.loadClaudeMd(project.path);

    await db.project.update({
      where: { id: projectId },
      data: { claudeMdContent: claudeMd },
    });

    return claudeMd;
  }

  private async loadClaudeMd(projectPath: string): Promise<string | null> {
    const claudeMdPath = path.join(projectPath, CLAUDE_MD_FILENAME);

    try {
      return await fs.readFile(claudeMdPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async buildFileTree(rootPath: string, depth = 0): Promise<FileTreeNode[]> {
    if (depth >= MAX_FILE_TREE_DEPTH) {
      return [];
    }

    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      const nodes: FileTreeNode[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env.example') {
          continue;
        }

        if (entry.isDirectory() && IGNORED_DIRS.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(rootPath, entry.name);

        if (entry.isDirectory()) {
          const children = await this.buildFileTree(fullPath, depth + 1);
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children,
          });
        } else {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
          });
        }
      }

      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch {
      return [];
    }
  }

  private hashPath(projectPath: string): string {
    return crypto.createHash('sha256').update(projectPath).digest('hex').substring(0, 16);
  }

  private mapProject(project: {
    id: string;
    userId: string;
    name: string;
    path: string;
    pathHash: string;
    claudeMdContent: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: project.id,
      userId: project.userId,
      name: project.name,
      path: project.path,
      pathHash: project.pathHash,
      claudeMdContent: project.claudeMdContent || undefined,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

export const projectService = new ProjectService();
