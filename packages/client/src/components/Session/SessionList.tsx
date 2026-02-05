import React, { useEffect, useState, useMemo } from 'react';
import { SessionListItem } from '@claude-web/shared';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDate, cn } from '@/lib/utils';
import { MessageSquare, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

// 时间分组顺序
const TIME_GROUP_ORDER = ['今天', '昨天', '一周内', '一个月内', '历史消息'];

// 根据日期获取时间分组
function getTimeGroup(date: Date | string): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const d = new Date(date);
  if (d >= today) return '今天';
  if (d >= yesterday) return '昨天';
  if (d >= weekAgo) return '一周内';
  if (d >= monthAgo) return '一个月内';
  return '历史消息';
}

interface GroupedSessions {
  name: string;
  sessions: SessionListItem[];
}

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
  const confirm = useConfirm();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 按时间分组
  const timeGroups = useMemo<GroupedSessions[]>(() => {
    // 按 lastMessageAt 排序（最新在前）
    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    const groups: Record<string, SessionListItem[]> = {};

    for (const session of sortedSessions) {
      const group = getTimeGroup(session.lastMessageAt);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(session);
    }

    // 按预定义顺序返回
    return TIME_GROUP_ORDER
      .filter(name => groups[name]?.length > 0)
      .map(name => ({
        name,
        sessions: groups[name],
      }));
  }, [sessions]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const isGroupOpen = (group: string) => !collapsedGroups.has(group);

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: '确定要删除这个会话吗？',
      description: '删除后将无法恢复。',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (confirmed) {
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
            {timeGroups.map((group) => (
              <Collapsible
                key={group.name}
                open={isGroupOpen(group.name)}
                onOpenChange={() => toggleGroup(group.name)}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 w-full py-1.5 px-2 text-left hover:bg-muted/50 rounded-md transition-colors text-xs">
                    {isGroupOpen(group.name) ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="font-medium text-muted-foreground">{group.name}</span>
                    <span className="text-muted-foreground/60">({group.sessions.length})</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                  {group.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={session.id === selectedSessionId}
                      isMobile={isMobile}
                      onSelect={() => handleSelect(session.id)}
                      onDelete={(e) => handleDelete(e, session.id)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
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
  isMobile: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionItem({ session, isSelected, isMobile, onSelect, onDelete }: SessionItemProps) {
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
          className={cn(
            'p-1 hover:bg-destructive/10 rounded transition-opacity',
            isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}
