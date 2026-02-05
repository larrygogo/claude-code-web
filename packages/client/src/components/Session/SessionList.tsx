'use client';

import React, { useEffect } from 'react';
import { SessionListItem } from '@claude-web/shared';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { formatDate, cn } from '@/lib/utils';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  selectedSessionId?: string;
}

export function SessionList({
  onSelectSession,
  onNewSession,
  selectedSessionId,
}: SessionListProps) {
  const { sessions, isLoadingSessions, loadSessions, deleteSession } = useChatStore();
  const { isMobile, setSidebarOpen } = useUIStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      await deleteSession(sessionId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button onClick={onNewSession} className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          新建对话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            暂无会话记录
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onSelect={() => handleSelect(session.id)}
                onDelete={(e) => handleDelete(e, session.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface SessionItemProps {
  session: SessionListItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionItem({ session, isSelected, onSelect, onDelete }: SessionItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors group cursor-pointer',
        'hover:bg-muted',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-start gap-3">
        <MessageSquare className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{session.title}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>{session.messageCount} 条消息</span>
            <span>·</span>
            <span>{formatDate(session.lastMessageAt)}</span>
          </div>
          {session.projectName && (
            <div className="text-xs text-blue-500 mt-1 truncate">
              {session.projectName}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}
