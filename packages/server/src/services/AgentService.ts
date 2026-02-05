import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  ContentBlock,
  SSEEvent,
  SSEEventType,
  SSEInitData,
  SSETextDelta,
  SSEThinkingDelta,
  SSEError,
  SSEDone,
  ChatRequest,
} from '@claude-web/shared';
import { sessionStorage } from '../storage/SessionStorage.js';
import { sessionService } from './SessionService.js';
import { projectService } from './ProjectService.js';
import { config } from '../config.js';

type PermissionMode = 'plan' | 'acceptEdits' | 'default';

interface AgentSession {
  sessionId: string;
  userId: string;
  projectId?: string;
  permissionMode: PermissionMode;
  abortController: AbortController;
}

const activeSessions = new Map<string, AgentSession>();

export class AgentService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.anthropic.baseUrl || 'https://api.anthropic.com';
    this.apiKey = config.anthropic.apiKey;
  }

  async streamChat(
    userId: string,
    request: ChatRequest,
    res: Response,
    onSessionCreated?: (sessionId: string) => void
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let sessionId = request.sessionId;

    if (!sessionId) {
      const session = await sessionService.createSession(userId, {
        projectId: request.projectId,
        title: this.generateTitle(request.message),
      });
      sessionId = session.id;
    }

    // Notify caller of the session ID for abort handling
    onSessionCreated?.(sessionId);

    const messageId = uuidv4();
    const abortController = new AbortController();

    const agentSession: AgentSession = {
      sessionId,
      userId,
      projectId: request.projectId,
      permissionMode: request.permissionMode || 'default',
      abortController,
    };

    activeSessions.set(sessionId, agentSession);

    this.sendEvent(res, 'init', {
      sessionId,
      messageId,
    } as SSEInitData);

    const userMessage: Message = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: [{ type: 'text', content: request.message }],
      createdAt: new Date(),
    };

    await sessionStorage.appendMessage(userId, sessionId, userMessage);

    try {
      let systemPrompt = 'You are Claude, a helpful AI assistant.';

      if (request.projectId) {
        const context = await projectService.getProjectContext(userId, request.projectId);
        if (context.claudeMd) {
          systemPrompt = `You are Claude, a helpful AI assistant.\n\nProject instructions from CLAUDE.md:\n\n${context.claudeMd}`;
        }
      }

      const previousMessages = await sessionStorage.getMessages(userId, sessionId);

      await this.runAgent(
        res,
        agentSession,
        messageId,
        systemPrompt,
        previousMessages
      );
    } catch (error) {
      console.error('Agent error:', error);
      this.sendEvent(res, 'error', {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as SSEError);
    } finally {
      activeSessions.delete(sessionId);
      res.end();
    }
  }

  async abortSession(sessionId: string): Promise<boolean> {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  private async runAgent(
    res: Response,
    agentSession: AgentSession,
    messageId: string,
    systemPrompt: string,
    previousMessages: Message[]
  ): Promise<void> {
    const contentBlocks: ContentBlock[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let fullText = '';
    let model = config.anthropic.model;
    let stopReason = 'end_turn';

    try {
      const messages = this.convertToClaudeMessages(previousMessages);

      console.log('Calling Anthropic API with:', {
        baseURL: this.baseUrl,
        model: config.anthropic.model,
        messagesCount: messages.length,
      });

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.anthropic.model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: messages,
          stream: true,
        }),
        signal: agentSession.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'message_start') {
                model = event.message?.model || model;
                inputTokens = event.message?.usage?.input_tokens || 0;
              } else if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if (delta?.type === 'text_delta' && delta.text) {
                  fullText += delta.text;
                  this.sendEvent(res, 'text_delta', {
                    content: delta.text,
                  } as SSETextDelta);
                }
              } else if (event.type === 'message_delta') {
                outputTokens = event.usage?.output_tokens || outputTokens;
                stopReason = event.delta?.stop_reason || stopReason;
              }
            } catch (e) {
              // Ignore parse errors for ping events etc
            }
          }
        }
      }

      if (fullText) {
        contentBlocks.push({ type: 'text', content: fullText });
      }

      const assistantMessage: Message = {
        id: messageId,
        sessionId: agentSession.sessionId,
        role: 'assistant',
        content: contentBlocks,
        createdAt: new Date(),
        model,
        stopReason,
        inputTokens,
        outputTokens,
      };

      await sessionStorage.appendMessage(
        agentSession.userId,
        agentSession.sessionId,
        assistantMessage
      );

      await sessionService.touchSession(agentSession.sessionId);

      this.sendEvent(res, 'done', {
        messageId,
        stopReason,
        inputTokens,
        outputTokens,
      } as SSEDone);
    } catch (error) {
      console.error('API Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });

      if ((error as Error).name === 'AbortError') {
        this.sendEvent(res, 'done', {
          messageId,
          stopReason: 'aborted',
          inputTokens,
          outputTokens,
        } as SSEDone);
      } else {
        throw error;
      }
    }
  }

  private convertToClaudeMessages(messages: Message[]): Array<{
    role: 'user' | 'assistant';
    content: string;
  }> {
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
          .filter(b => b.type === 'text')
          .map(b => (b as { type: 'text'; content: string }).content)
          .join('\n'),
      }))
      .filter(m => m.content.trim() !== '');
  }

  private sendEvent<T>(res: Response, type: SSEEventType, data: T): void {
    const event: SSEEvent<T> = {
      type,
      data,
      timestamp: Date.now(),
    };

    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  private generateTitle(message: string): string {
    const maxLength = 50;
    const trimmed = message.trim().replace(/\n/g, ' ');

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return trimmed.substring(0, maxLength - 3) + '...';
  }
}

export const agentService = new AgentService();
