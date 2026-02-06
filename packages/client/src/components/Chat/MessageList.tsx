import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Message } from '@claude-web/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from './MessageItem';
import { useChatStore } from '@/stores/chatStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { streaming, streamingSessionId, currentSession, workingDir } = useChatStore();
  const isMobile = useIsMobile();
  const [isAtBottom, setIsAtBottom] = useState(true);

  // 只有当前会话正在流式传输时才显示流式消息
  const isStreaming = streamingSessionId !== null && streamingSessionId === currentSession?.id;

  // 检查是否在底部（允许 50px 的误差）
  const checkIfAtBottom = useCallback(() => {
    if (viewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
    }
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const scrollElement = viewportRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', checkIfAtBottom);
      return () => scrollElement.removeEventListener('scroll', checkIfAtBottom);
    }
  }, [checkIfAtBottom]);

  // 初始化时滚动到底部
  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 已渲染
    const frame = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentSession?.id, scrollToBottom]);

  // 新消息时自动滚动到底部（如果已经在底部）
  useEffect(() => {
    if (isAtBottom && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, streaming?.blocks, isAtBottom]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="py-4">
          {/* 工作目录提示条 */}
          {workingDir && (
            <div className="flex items-center gap-2 px-4 py-2 mb-2 mx-4 rounded-md bg-muted/50 text-muted-foreground text-xs">
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate" title={workingDir}>工作目录: {workingDir}</span>
            </div>
          )}
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          {isStreaming && streaming && (
            <MessageItem
              message={{
                id: streaming.messageId || 'streaming',
                sessionId: streaming.sessionId || '',
                role: 'assistant',
                content: [],
                createdAt: new Date(),
              }}
              isStreaming
              streamingBlocks={streaming.blocks}
            />
          )}
        </div>
      </ScrollArea>

      {/* 回到最新按钮 - 仅移动端且不在底部时显示 */}
      {isMobile && !isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-4 right-4 z-10',
            'flex items-center gap-1 px-3 py-1.5 rounded-full',
            'bg-primary text-primary-foreground text-xs font-medium shadow-lg',
            'transition-all hover:bg-primary/90 active:scale-95'
          )}
        >
          <ChevronDown className="h-3 w-3" />
          回到最新
        </button>
      )}
    </div>
  );
}
