import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { SessionList } from '@/components/Session';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut, X, MessageSquare, List, FolderOpen, Settings } from 'lucide-react';

interface SidebarProps {
  selectedSessionId?: string;
}

const navItems = [
  { path: '/chat', icon: MessageSquare, label: '聊天' },
  { path: '/sessions', icon: List, label: '会话' },
  { path: '/projects', icon: FolderOpen, label: '项目' },
  { path: '/settings', icon: Settings, label: '设置' },
];

export function Sidebar({ selectedSessionId }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen, isMobile } = useUIStore();
  const { newSession } = useChatStore();
  const { user, logout } = useAuthStore();
  const confirm = useConfirm();

  const isActive = (path: string) => {
    if (path === '/chat') {
      return location.pathname === '/chat' || location.pathname.startsWith('/chat/');
    }
    return location.pathname === path;
  };

  const handleSelectSession = (sessionId: string) => {
    navigate(`/chat/${sessionId}`);
  };

  const handleNewSession = async () => {
    const sessionId = await newSession();
    navigate(`/chat/${sessionId}`);
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: '确定要退出登录吗？',
      confirmText: '退出',
    });
    if (!confirmed) return;
    await logout();
    navigate('/login');
  };

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div
          className="fixed top-0 bottom-16 left-0 right-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'bg-background border-r flex flex-col',
          isMobile
            ? cn(
                'fixed top-0 bottom-16 left-0 z-50 w-80 transition-transform duration-300',
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : 'w-80 shrink-0'
        )}
      >
        {/* 标题区域 */}
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-lg">Claude Code Web</span>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* 桌面端导航菜单 */}
        {!isMobile && (
          <nav className="p-2 border-b">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
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
