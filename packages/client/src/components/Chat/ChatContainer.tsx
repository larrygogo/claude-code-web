'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Loader2 } from 'lucide-react';

interface ChatContainerProps {
  sessionId?: string;
  projectId?: string;
}

export function ChatContainer({ sessionId, projectId }: ChatContainerProps) {
  const { currentSession, isLoadingSession, loadSession, error, clearError } = useChatStore();

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId, loadSession]);

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
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-semibold">Claude Code Web</h2>
            <p className="text-muted-foreground">
              开始一个新的对话，或从左侧选择一个历史会话。
            </p>
          </div>
          <div className="mt-8 w-full max-w-md">
            <InputArea projectId={projectId} />
          </div>
        </div>
      )}
    </div>
  );
}
