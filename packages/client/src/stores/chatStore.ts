import { create } from 'zustand';
import {
  Message,
  ContentBlock,
  SessionListItem,
  SessionWithMessages,
} from '@claude-web/shared';
import {
  getSessions,
  getSession,
  createSession,
  deleteSession as apiDeleteSession,
  forkSession as apiForkSession,
  abortChat,
} from '@/lib/api';
import { streamChat, SSEEventHandler, abortStream, abortCurrentStream } from '@/lib/sse';

interface StreamingBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content?: string;
  toolUse?: { id: string; name: string; input: Record<string, unknown> };
  toolResult?: { toolUseId: string; content: string; isError?: boolean };
}

interface StreamingState {
  sessionId: string | null;
  messageId: string | null;
  blocks: StreamingBlock[];
  isComplete: boolean;
}

interface ChatState {
  sessions: SessionListItem[];
  currentSession: SessionWithMessages | null;
  streaming: StreamingState | null;
  isLoadingSessions: boolean;
  isLoadingSession: boolean;
  streamingSessionId: string | null;  // 替代全局 isStreaming，记录正在流式传输的会话 ID
  error: string | null;
  abortController: AbortController | null;

  loadSessions: (projectId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: (projectId?: string) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  forkSession: (sessionId: string, messageIndex: number) => Promise<string>;
  sendMessage: (message: string, projectId?: string, token?: string) => Promise<void>;
  abortStreaming: () => Promise<void>;
  clearError: () => void;
}

const initialStreamingState: StreamingState = {
  sessionId: null,
  messageId: null,
  blocks: [],
  isComplete: false,
};

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  streaming: null,
  isLoadingSessions: false,
  isLoadingSession: false,
  streamingSessionId: null,
  error: null,
  abortController: null,

  loadSessions: async (projectId?: string) => {
    set({ isLoadingSessions: true, error: null });
    try {
      const sessions = await getSessions(projectId);
      set({ sessions, isLoadingSessions: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load sessions',
        isLoadingSessions: false,
      });
    }
  },

  loadSession: async (sessionId: string) => {
    set({ isLoadingSession: true, error: null });
    try {
      const session = await getSession(sessionId);
      set({ currentSession: session, isLoadingSession: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load session',
        isLoadingSession: false,
      });
    }
  },

  newSession: async (projectId?: string) => {
    try {
      const session = await createSession(projectId);
      await get().loadSessions(projectId);
      set({
        currentSession: {
          ...session,
          messages: [],
        },
      });
      return session.id;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create session',
      });
      throw error;
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await apiDeleteSession(sessionId);
      const { currentSession } = get();
      if (currentSession?.id === sessionId) {
        set({ currentSession: null });
      }
      await get().loadSessions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete session',
      });
      throw error;
    }
  },

  forkSession: async (sessionId: string, messageIndex: number) => {
    try {
      const session = await apiForkSession(sessionId, messageIndex);
      await get().loadSessions();
      return session.id;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fork session',
      });
      throw error;
    }
  },

  sendMessage: async (message: string, projectId?: string, token?: string) => {
    const { currentSession, streamingSessionId } = get();
    const currentSessionId = currentSession?.id || null;

    // 只阻止当前会话正在流式传输时重复发送
    if (streamingSessionId && streamingSessionId === currentSessionId) {
      return;
    }

    if (!token) {
      console.error('[ChatStore] No token provided');
      return;
    }

    // Create a temporary user message for immediate display
    const tempUserMessageId = `temp-${Date.now()}`;
    const userMessage: Message = {
      id: tempUserMessageId,
      sessionId: currentSession?.id || '',
      role: 'user',
      content: [{ type: 'text', content: message }],
      createdAt: new Date(),
    };

    // Add user message to current session immediately (optimistic update)
    if (currentSession) {
      set({
        currentSession: {
          ...currentSession,
          messages: [...currentSession.messages, userMessage],
        },
        streamingSessionId: currentSessionId,
        streaming: { ...initialStreamingState },
        error: null,
      });
    } else {
      set({
        streamingSessionId: currentSessionId,
        streaming: { ...initialStreamingState },
        error: null,
      });
    }

    const handlers: SSEEventHandler = {
      onInit: (data) => {
        set((state) => {
          const updates: Partial<ChatState> = {
            streaming: {
              ...state.streaming!,
              sessionId: data.sessionId,
              messageId: data.messageId,
            },
            // 更新为真实的 sessionId（新建会话时，初始可能为 null）
            streamingSessionId: data.sessionId,
          };

          // 如果服务端返回了更新后的标题，同步更新前端状态
          if (data.title && state.currentSession) {
            updates.currentSession = {
              ...state.currentSession,
              id: data.sessionId || state.currentSession.id,
              title: data.title,
            };
            // 同步更新侧边栏的会话列表
            updates.sessions = state.sessions.map(s =>
              s.id === (data.sessionId || state.currentSession?.id)
                ? { ...s, title: data.title! }
                : s
            );
          }

          return updates;
        });
      },
      onTextDelta: (data) => {
        set((state) => {
          const blocks = [...state.streaming!.blocks];
          const lastBlock = blocks[blocks.length - 1];

          // 如果最后一个块是文本块，追加内容；否则创建新的文本块
          if (lastBlock?.type === 'text') {
            blocks[blocks.length - 1] = {
              ...lastBlock,
              content: (lastBlock.content || '') + data.content,
            };
          } else {
            blocks.push({ type: 'text', content: data.content });
          }

          return {
            streaming: { ...state.streaming!, blocks },
          };
        });
      },
      onThinkingDelta: (data) => {
        set((state) => {
          const blocks = [...state.streaming!.blocks];
          const lastBlock = blocks[blocks.length - 1];

          // 如果最后一个块是思考块，追加内容；否则创建新的思考块
          if (lastBlock?.type === 'thinking') {
            blocks[blocks.length - 1] = {
              ...lastBlock,
              content: (lastBlock.content || '') + data.content,
            };
          } else {
            blocks.push({ type: 'thinking', content: data.content });
          }

          return {
            streaming: { ...state.streaming!, blocks },
          };
        });
      },
      onToolUse: (data) => {
        set((state) => {
          const blocks = [...state.streaming!.blocks];
          // 检查是否已存在该工具调用（可能是更新输入参数）
          const existingIndex = blocks.findIndex(
            b => b.type === 'tool_use' && b.toolUse?.id === data.id
          );

          if (existingIndex >= 0) {
            // 更新现有的工具调用
            blocks[existingIndex] = {
              type: 'tool_use',
              toolUse: { id: data.id, name: data.name, input: data.input },
            };
          } else {
            // 添加新的工具调用
            blocks.push({
              type: 'tool_use',
              toolUse: { id: data.id, name: data.name, input: data.input },
            });
          }

          return {
            streaming: { ...state.streaming!, blocks },
          };
        });
      },
      onToolResult: (data) => {
        set((state) => {
          const blocks = [...state.streaming!.blocks];
          blocks.push({
            type: 'tool_result',
            toolResult: {
              toolUseId: data.toolUseId,
              content: data.content,
              isError: data.isError,
            },
          });

          return {
            streaming: { ...state.streaming!, blocks },
          };
        });
      },
      onError: (data) => {
        set({
          error: data.message,
          streamingSessionId: null,
          streaming: null,
        });
      },
      onDone: async (data) => {
        const { streaming, currentSession } = get();
        const sessionId = streaming?.sessionId || currentSession?.id;

        // 将流式消息转换为正式的助手消息，添加到当前会话
        if (streaming && streaming.blocks.length > 0) {
          const assistantMessage: Message = {
            id: streaming.messageId || `msg-${Date.now()}`,
            sessionId: sessionId || '',
            role: 'assistant',
            content: streaming.blocks.map((block): ContentBlock => {
              switch (block.type) {
                case 'text':
                  return { type: 'text', content: block.content || '' };
                case 'thinking':
                  return { type: 'thinking', content: block.content || '' };
                case 'tool_use':
                  return {
                    type: 'tool_use',
                    toolUse: block.toolUse || { id: '', name: '', input: {} },
                  };
                case 'tool_result':
                  return {
                    type: 'tool_result',
                    toolResult: block.toolResult || { toolUseId: '', content: '', isError: false },
                  };
                default:
                  return { type: 'text', content: '' };
              }
            }),
            createdAt: new Date(),
          };

          // 直接添加到当前会话，不重新加载
          if (currentSession) {
            set({
              currentSession: {
                ...currentSession,
                id: sessionId || currentSession.id,
                messages: [...currentSession.messages, assistantMessage],
              },
              streaming: null,
              streamingSessionId: null,
              abortController: null,
            });
          } else {
            set({
              streaming: null,
              streamingSessionId: null,
              abortController: null,
            });
          }
        } else {
          set({
            streaming: null,
            streamingSessionId: null,
            abortController: null,
          });
        }

        // 后台更新会话列表（不影响当前会话）
        get().loadSessions();
      },
    };

    try {
      await streamChat(
        {
          sessionId: currentSession?.id,
          projectId,
          message,
        },
        handlers,
        token
      );
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Stream failed',
        streamingSessionId: null,
        streaming: null,
        abortController: null,
      });
    }
  },

  abortStreaming: async () => {
    const { streaming, streamingSessionId } = get();
    if (!streamingSessionId) {
      return;
    }

    // 按会话中止流
    abortStream(streamingSessionId);

    // Then notify server
    if (streaming?.sessionId) {
      try {
        await abortChat(streaming.sessionId);
      } catch {
        // Ignore abort errors
      }
    }

    set({
      streamingSessionId: null,
      streaming: null,
      abortController: null,
    });
  },

  clearError: () => set({ error: null }),
}));

