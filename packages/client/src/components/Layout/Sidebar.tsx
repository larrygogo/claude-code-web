'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { SessionList } from '@/components/Session';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut, X } from 'lucide-react';

interface SidebarProps {
  selectedSessionId?: string;
}

export function Sidebar({ selectedSessionId }: SidebarProps) {
  const router = useRouter();
  const { isSidebarOpen, setSidebarOpen, isMobile } = useUIStore();
  const { newSession } = useChatStore();
  const { user, logout } = useAuthStore();

  const handleSelectSession = (sessionId: string) => {
    router.push(`/chat/${sessionId}`);
  };

  const handleNewSession = async () => {
    const sessionId = await newSession();
    router.push(`/chat/${sessionId}`);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'bg-background border-r flex flex-col',
          isMobile
            ? cn(
                'fixed inset-y-0 left-0 z-50 w-80 transition-transform duration-300',
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : 'w-80 shrink-0'
        )}
      >
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b">
            <span className="font-semibold">会话列表</span>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <SessionList
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            selectedSessionId={selectedSessionId}
          />
        </div>

        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <div className="text-sm font-medium">{user?.username}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
