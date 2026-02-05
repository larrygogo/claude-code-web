'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/stores/chatStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { MessageSquare, Plus, Trash2, GitBranch, Loader2 } from 'lucide-react';

export default function SessionsPage() {
  const router = useRouter();
  const { sessions, isLoadingSessions, loadSessions, deleteSession, newSession } = useChatStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewSession = async () => {
    const sessionId = await newSession();
    router.push(`/chat/${sessionId}`);
  };

  const handleSelectSession = (sessionId: string) => {
    router.push(`/chat/${sessionId}`);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
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
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleSelectSession(session.id)}
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/chat/${session.id}?fork=true`);
                      }}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
