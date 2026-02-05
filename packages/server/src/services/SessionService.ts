import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionWithMessages,
  SessionCreateInput,
  SessionListItem,
} from '@claude-web/shared';
import { getDatabase } from '../storage/Database.js';
import { sessionStorage } from '../storage/SessionStorage.js';
import { NotFoundError, ForbiddenError } from '../middleware/error.js';

export class SessionService {
  async createSession(userId: string, input: SessionCreateInput): Promise<Session> {
    const db = getDatabase();

    const session = await db.session.create({
      data: {
        userId,
        projectId: input.projectId,
        title: input.title || 'New Chat',
      },
    });

    return this.mapSession(session);
  }

  async getSession(userId: string, sessionId: string): Promise<SessionWithMessages> {
    const db = getDatabase();

    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to this session');
    }

    const messages = await sessionStorage.getMessages(userId, sessionId);

    return {
      ...this.mapSession(session),
      messages,
    };
  }

  async listSessions(userId: string, projectId?: string): Promise<SessionListItem[]> {
    const db = getDatabase();

    const sessions = await db.session.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
      },
      include: {
        project: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const sessionList: SessionListItem[] = [];

    for (const session of sessions) {
      const messageCount = await sessionStorage.getMessageCount(userId, session.id);
      const lastMessageAt = await sessionStorage.getLastMessageTime(userId, session.id);

      sessionList.push({
        id: session.id,
        title: session.title,
        projectId: session.projectId || undefined,
        projectName: session.project?.name,
        messageCount,
        lastMessageAt: lastMessageAt || session.createdAt,
        createdAt: session.createdAt,
      });
    }

    return sessionList;
  }

  async updateSessionTitle(userId: string, sessionId: string, title: string): Promise<Session> {
    const db = getDatabase();

    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to this session');
    }

    const updated = await db.session.update({
      where: { id: sessionId },
      data: { title },
    });

    return this.mapSession(updated);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const db = getDatabase();

    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('Access denied to this session');
    }

    await sessionStorage.deleteSession(userId, sessionId);
    await db.session.delete({ where: { id: sessionId } });
  }

  async forkSession(
    userId: string,
    sessionId: string,
    messageIndex: number
  ): Promise<Session> {
    const db = getDatabase();

    const originalSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!originalSession) {
      throw new NotFoundError('Session');
    }

    if (originalSession.userId !== userId) {
      throw new ForbiddenError('Access denied to this session');
    }

    const newSessionId = uuidv4();

    const forkedSession = await db.session.create({
      data: {
        id: newSessionId,
        userId,
        projectId: originalSession.projectId,
        title: `${originalSession.title} (Fork)`,
        parentSessionId: sessionId,
        forkMessageIndex: messageIndex,
      },
    });

    await sessionStorage.copySession(userId, sessionId, newSessionId, messageIndex + 1);

    return this.mapSession(forkedSession);
  }

  async importCliSession(
    userId: string,
    cliSessionPath: string,
    title?: string
  ): Promise<Session> {
    const db = getDatabase();
    const sessionId = uuidv4();

    const session = await db.session.create({
      data: {
        id: sessionId,
        userId,
        title: title || 'Imported from CLI',
      },
    });

    await sessionStorage.importFromCliSession(userId, sessionId, cliSessionPath);

    return this.mapSession(session);
  }

  async touchSession(sessionId: string): Promise<void> {
    const db = getDatabase();

    await db.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  private mapSession(session: {
    id: string;
    userId: string;
    projectId: string | null;
    title: string;
    parentSessionId: string | null;
    forkMessageIndex: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): Session {
    return {
      id: session.id,
      userId: session.userId,
      projectId: session.projectId || undefined,
      title: session.title,
      parentSessionId: session.parentSessionId || undefined,
      forkMessageIndex: session.forkMessageIndex || undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

export const sessionService = new SessionService();
