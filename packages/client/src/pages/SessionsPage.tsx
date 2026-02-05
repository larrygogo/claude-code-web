import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDate } from '@/lib/utils';
import { MessageSquare, Plus, Trash2, Loader2, ChevronDown, ChevronRight, Clock, Folder } from 'lucide-react';
import type { SessionListItem } from '@claude-web/shared';

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

// 会话卡片组件
function SessionCard({
  session,
  onSelect,
  onDelete,
}: {
  session: SessionListItem;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onSelect(session.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <MessageSquare className="h-5 w-5 mt-1 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{session.title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{session.messageCount} 条消息</span>
              <span>{formatDate(session.lastMessageAt)}</span>
            </div>
            {session.projectName && (
              <div className="text-sm text-blue-500 mt-1">
                {session.projectName}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => onDelete(e, session.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 可折叠分组组件
function CollapsibleGroup({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full py-2 px-1 text-left hover:bg-muted/50 rounded-md transition-colors">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">({count})</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pl-6 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const { sessions, isLoadingSessions, loadSessions, deleteSession, newSession } = useChatStore();
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

  // 按项目分组
  const projectGroups = useMemo<GroupedSessions[]>(() => {
    // 过滤有项目的会话并按 lastMessageAt 排序
    const sessionsWithProject = sessions
      .filter(s => s.projectId && s.projectName)
      .sort((a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

    const groups: Record<string, SessionListItem[]> = {};

    for (const session of sessionsWithProject) {
      const projectName = session.projectName!;
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      groups[projectName].push(session);
    }

    // 按项目名称排序
    return Object.keys(groups)
      .sort()
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

  const handleNewSession = async () => {
    const sessionId = await newSession();
    navigate(`/chat/${sessionId}`);
  };

  const handleSelectSession = (sessionId: string) => {
    navigate(`/chat/${sessionId}`);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
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
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">会话管理</h1>
        <Button onClick={handleNewSession}>
          <Plus className="h-4 w-4 mr-2" />
          新建会话
        </Button>
      </div>

      {isLoadingSessions ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无会话记录</p>
            <Button onClick={handleNewSession} variant="outline" className="mt-4">
              开始第一个对话
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="time">
          <TabsList className="mb-4">
            <TabsTrigger value="time" className="gap-2">
              <Clock className="h-4 w-4" />
              按时间
            </TabsTrigger>
            <TabsTrigger value="project" className="gap-2">
              <Folder className="h-4 w-4" />
              按项目
            </TabsTrigger>
          </TabsList>

          <TabsContent value="time">
            <div className="space-y-4">
              {timeGroups.map((group) => (
                <CollapsibleGroup
                  key={group.name}
                  title={group.name}
                  count={group.sessions.length}
                  isOpen={isGroupOpen(`time-${group.name}`)}
                  onToggle={() => toggleGroup(`time-${group.name}`)}
                >
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onSelect={handleSelectSession}
                      onDelete={handleDeleteSession}
                    />
                  ))}
                </CollapsibleGroup>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="project">
            {projectGroups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无关联项目的会话</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {projectGroups.map((group) => (
                  <CollapsibleGroup
                    key={group.name}
                    title={group.name}
                    count={group.sessions.length}
                    isOpen={isGroupOpen(`project-${group.name}`)}
                    onToggle={() => toggleGroup(`project-${group.name}`)}
                  >
                    {group.sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onSelect={handleSelectSession}
                        onDelete={handleDeleteSession}
                      />
                    ))}
                  </CollapsibleGroup>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
