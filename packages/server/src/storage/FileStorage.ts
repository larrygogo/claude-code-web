import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

export class FileStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || config.dataDir;
  }

  private getUserDir(userId: string): string {
    return path.join(this.baseDir, 'users', userId);
  }

  async ensureUserDirs(userId: string): Promise<void> {
    const userDir = this.getUserDir(userId);
    const dirs = [
      path.join(userDir, 'sessions'),
      path.join(userDir, 'plans'),
      path.join(userDir, 'projects'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async getSessionFilePath(userId: string, sessionId: string): Promise<string> {
    return path.join(this.getUserDir(userId), 'sessions', `${sessionId}.jsonl`);
  }

  async getPlanFilePath(userId: string, planId: string): Promise<string> {
    return path.join(this.getUserDir(userId), 'plans', `${planId}.md`);
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async appendFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, content, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.filter(e => e.isFile()).map(e => e.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

export const fileStorage = new FileStorage();
