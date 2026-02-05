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
import { streamChat, SSEEventHandler } from '@/lib/sse';

interface StreamingState {
  sessionId: string | null;
  messageId: string | null;
  text: string;
  thinking: string;
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown>; result?: string; isError?: boolean }>;
  isComplete: boolean;
}

interface ChatState {
  sessions: SessionListItem[];
  currentSession: SessionWithMessages | null;
  streaming: StreamingState | null;
  isLoadingSessions: boolean;
  isLoadingSession: boolean;
  isStreaming: boolean;
  error: string | null;

  loadSessions: (projectId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: (projectId?: string) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  forkSession: (sessionId: string, messageIndex: number) => Promise<string>;
  sendMessage: (message: string, projectId?: string) => Promise<void>;
  abortStreaming: () => Promise<void>;
  clearError: () => void;
}

const initialStreamingState: StreamingState = {
  sessionId: null,
  messageId: null,
  text: '',
  thinking: '',
  toolUses: [],
  isComplete: false,
};

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  streaming: null,
  isLoadingSessions: false,
  isLoadingSession: false,
  isStreaming: false,
  error: null,

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

  sendMessage: async (message: string, projectId?: string) => {
    const { currentSession, isStreaming } = get();

    if (isStreaming) {
      return;
    }

    set({
      isStreaming: true,
      error: null,
      streaming: { ...initialStreamingState },
    });

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sessionId: currentSession?.id || '',
      role: 'user',
      content: [{ type: 'text', content: message }],
      createdAt: new Date(),
    };

    if (currentSession) {
      set({
        currentSession: {
          ...currentSession,
          messages: [...currentSession.messages, userMessage],
        },
      });
    }

    const handlers: SSEEventHandler = {
      onInit: (data) => {
        set((state) => ({
          streaming: {
            ...state.streaming!,
            sessionId: data.sessionId,
            messageId: data.messageId,
          },
        }));

        // Don't load session during streaming - it will be loaded after done
      },
      onTextDelta: (data) => {
        set((state) => ({
          streaming: {
            ...state.streaming!,
            text: state.streaming!.text + data.content,
          },
        }));
      },
      onThinkingDelta: (data) => {
        set((state) => ({
          streaming: {
            ...state.streaming!,
            thinking: state.streaming!.thinking + data.content,
          },
        }));
      },
      onToolUse: (data) => {
        set((state) => ({
          streaming: {
            ...state.streaming!,
            toolUses: [
              ...state.streaming!.toolUses,
              { id: data.id, name: data.name, input: data.input },
            ],
          },
        }));
      },
      onToolResult: (data) => {
        set((state) => ({
          streaming: {
            ...state.streaming!,
            toolUses: state.streaming!.toolUses.map((t) =>
              t.id === data.toolUseId
                ? { ...t, result: data.content, isError: data.isError }
                : t
            ),
          },
        }));
      },
      onError: (data) => {
        set({
          error: data.message,
          isStreaming: false,
        });
      },
      onDone: async (data) => {
        const { streaming, currentSession } = get();

        if (streaming) {
          const sessionId = streaming.sessionId || currentSession?.id;

          if (sessionId) {
            const assistantMessage: Message = {
              id: data.messageId,
              sessionId,
              role: 'assistant',
              content: buildContentBlocks(streaming),
              createdAt: new Date(),
              stopReason: data.stopReason,
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
            };

            if (currentSession) {
              set({
                currentSession: {
                  ...currentSession,
                  messages: [...currentSession.messages, assistantMessage],
                },
                streaming: null,
                isStreaming: false,
              });
            } else {
              // New session - load it
              set({
                streaming: null,
                isStreaming: false,
              });
              await get().loadSession(sessionId);
            }
          } else {
            set({
              streaming: null,
              isStreaming: false,
            });
          }
        } else {
          set({
            streaming: null,
            isStreaming: false,
          });
        }

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
        handlers
      );
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        set({
          error: error instanceof Error ? error.message : 'Stream failed',
          isStreaming: false,
          streaming: null,
        });
      }
    }
  },

  abortStreaming: async () => {
    const { streaming, isStreaming } = get();
    if (!isStreaming || !streaming?.sessionId) {
      return;
    }

    try {
      await abortChat(streaming.sessionId);
    } catch {
      // Ignore abort errors
    }

    set({
      isStreaming: false,
      streaming: null,
    });
  },

  clearError: () => set({ error: null }),
}));

function buildContentBlocks(streaming: StreamingState): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  if (streaming.thinking) {
    blocks.push({ type: 'thinking', content: streaming.thinking });
  }

  if (streaming.text) {
    blocks.push({ type: 'text', content: streaming.text });
  }

  for (const toolUse of streaming.toolUses) {
    blocks.push({
      type: 'tool_use',
      toolUse: {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
      },
    });

    if (toolUse.result !== undefined) {
      blocks.push({
        type: 'tool_result',
        toolResult: {
          toolUseId: toolUse.id,
          content: toolUse.result,
          isError: toolUse.isError,
        },
      });
    }
  }

  return blocks;
}
