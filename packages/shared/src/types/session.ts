import { Message } from './message.js';

export interface Session {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  parentSessionId?: string;
  forkMessageIndex?: number;
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}

export interface SessionCreateInput {
  projectId?: string;
  title?: string;
}

export interface SessionForkInput {
  sessionId: string;
  messageIndex: number;
}

export interface SessionListItem {
  id: string;
  title: string;
  projectId?: string;
  projectName?: string;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface SessionImportInput {
  filePath: string;
}

export interface SessionUpdateInput {
  title?: string;
  projectId?: string | null;
}
