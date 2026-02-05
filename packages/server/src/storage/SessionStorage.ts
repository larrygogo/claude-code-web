import { Message, ContentBlock } from '@claude-web/shared';
import { fileStorage } from './FileStorage.js';

interface JsonlMessage {
  id: string;
  role: string;
  content: ContentBlock[];
  createdAt: string;
  model?: string;
  stopReason?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class SessionStorage {
  async getMessages(userId: string, sessionId: string): Promise<Message[]> {
    const filePath = await fileStorage.getSessionFilePath(userId, sessionId);
    const content = await fileStorage.readFile(filePath);

    if (!content) {
      return [];
    }

    const messages: Message[] = [];
    const lines = content.trim().split('\n');

    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line) as JsonlMessage;
          messages.push({
            ...parsed,
            sessionId,
            createdAt: new Date(parsed.createdAt),
          } as Message);
        } catch (error) {
          console.error('Failed to parse message line:', error);
        }
      }
    }

    return messages;
  }

  async appendMessage(userId: string, sessionId: string, message: Message): Promise<void> {
    const filePath = await fileStorage.getSessionFilePath(userId, sessionId);
    const jsonLine = JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      model: message.model,
      stopReason: message.stopReason,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
    }) + '\n';

    await fileStorage.appendFile(filePath, jsonLine);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const filePath = await fileStorage.getSessionFilePath(userId, sessionId);
    await fileStorage.deleteFile(filePath);
  }

  async copySession(
    userId: string,
    sourceSessionId: string,
    targetSessionId: string,
    messageLimit?: number
  ): Promise<void> {
    const messages = await this.getMessages(userId, sourceSessionId);
    const messagesToCopy = messageLimit ? messages.slice(0, messageLimit) : messages;

    for (const message of messagesToCopy) {
      await this.appendMessage(userId, targetSessionId, {
        ...message,
        sessionId: targetSessionId,
      });
    }
  }

  async getMessageCount(userId: string, sessionId: string): Promise<number> {
    const messages = await this.getMessages(userId, sessionId);
    return messages.length;
  }

  async getLastMessageTime(userId: string, sessionId: string): Promise<Date | null> {
    const messages = await this.getMessages(userId, sessionId);
    if (messages.length === 0) {
      return null;
    }
    return messages[messages.length - 1].createdAt;
  }

  async importFromCliSession(
    userId: string,
    sessionId: string,
    cliSessionPath: string
  ): Promise<void> {
    const content = await fileStorage.readFile(cliSessionPath);
    if (!content) {
      throw new Error(`CLI session file not found: ${cliSessionPath}`);
    }

    const targetPath = await fileStorage.getSessionFilePath(userId, sessionId);
    await fileStorage.writeFile(targetPath, content);
  }
}

export const sessionStorage = new SessionStorage();
