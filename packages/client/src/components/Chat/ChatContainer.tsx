import React, { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Loader2, Code, HelpCircle, Bug } from 'lucide-react';

interface ChatContainerProps {
  sessionId?: string;
  projectId?: string;
}

const suggestions = [
  {
    icon: Code,
    text: '帮我写一段 Python 代码',
    description: '生成代码片段',
  },
  {
    icon: HelpCircle,
    text: '解释这段代码的作用',
    description: '理解代码逻辑',
  },
  {
    icon: Bug,
    text: '帮我调试这个错误',
    description: '排查问题原因',
  },
];

export function ChatContainer({ sessionId, projectId }: ChatContainerProps) {
  const { currentSession, isLoadingSession, loadSession, error, clearError } =
    useChatStore();

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, loadSession]);

  const handleSuggestionClick = (text: string) => {
    // Use the global function exposed by InputArea
    const win = window as unknown as { fillChatInput?: (text: string) => void };
    if (win.fillChatInput) {
      win.fillChatInput(text);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-xs underline">
            关闭
          </button>
        </div>
      )}

      {currentSession ? (
        <>
          <MessageList messages={currentSession.messages} />
          <InputArea projectId={projectId} />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-lg">
            {/* Main title with gradient */}
            <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Claude Code Web
            </h2>
            <p className="text-muted-foreground text-lg">
              有什么可以帮您的？
            </p>

            {/* Suggestion chips */}
            <div className="grid gap-3 mt-8">
              {suggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion.text)}
                    className="suggestion-chip flex items-center gap-3 w-full"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{suggestion.text}</div>
                      <div className="text-xs text-muted-foreground">
                        {suggestion.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input area at bottom */}
          <div className="mt-8 w-full max-w-3xl">
            <InputArea projectId={projectId} />
          </div>
        </div>
      )}
    </div>
  );
}
