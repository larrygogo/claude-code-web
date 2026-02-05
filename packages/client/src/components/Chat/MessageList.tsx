'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '@claude-web/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from './MessageItem';
import { useChatStore } from '@/stores/chatStore';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { streaming, isStreaming } = useChatStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming?.text, streaming?.thinking]);

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="divide-y">
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
            streamingText={streaming.text}
            streamingThinking={streaming.thinking}
          />
        )}
      </div>
    </ScrollArea>
  );
}
