import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputAreaProps {
  projectId?: string;
  onSuggestionClick?: (text: string) => void;
}

export function InputArea({ projectId, onSuggestionClick }: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, abortStreaming, streamingSessionId, currentSession } = useChatStore();
  const { tokens } = useAuthStore();
  const accessToken = tokens?.accessToken;
  const isMobile = useIsMobile();

  // 只有当前会话正在流式传输时才禁用输入
  const isStreaming = streamingSessionId !== null && streamingSessionId === currentSession?.id;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Allow parent to set input via suggestion click
  useEffect(() => {
    if (onSuggestionClick) {
      // This is a no-op, just to ensure the prop is used for typing
    }
  }, [onSuggestionClick]);

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming || !accessToken) return;

    const message = input.trim();
    setInput('');

    await sendMessage(message, projectId, accessToken);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Expose setInput for parent component
  const fillInput = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  // Attach to window for parent access (simple approach)
  useEffect(() => {
    (window as unknown as { fillChatInput?: (text: string) => void }).fillChatInput = fillInput;
    return () => {
      delete (window as unknown as { fillChatInput?: (text: string) => void }).fillChatInput;
    };
  }, []);

  return (
    <div className="bg-background p-4 mobile-safe-bottom">
      <div className="max-w-3xl mx-auto">
        {/* Input container with capsule style */}
        <div
          className={cn(
            'relative rounded-2xl border bg-background shadow-sm',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            'transition-shadow'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="给 Claude 发送消息..."
            disabled={isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[48px] max-h-[200px]'
            )}
          />

          {/* Send/Stop button inside the container */}
          <div className="absolute right-2 bottom-2">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={abortStreaming}
                className="h-8 w-8 rounded-full"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || !accessToken}
                size="icon"
                className="h-8 w-8 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Hint text - only show on desktop, but keep spacing on mobile */}
        {isMobile ? (
          <div className="h-2" />
        ) : (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enter 发送，Shift+Enter 换行
          </p>
        )}
      </div>
    </div>
  );
}
