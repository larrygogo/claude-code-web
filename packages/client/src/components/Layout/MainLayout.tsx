import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader, BottomNav } from '@/components/Mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';

function getPageTitle(pathname: string, sessionTitle?: string): string {
  if (pathname.startsWith('/chat')) {
    return sessionTitle || '新对话';
  }
  if (pathname.startsWith('/sessions')) return '会话';
  if (pathname.startsWith('/projects')) return '项目';
  if (pathname.startsWith('/plans')) return '计划';
  if (pathname.startsWith('/settings')) return '设置';
  return 'Claude Code';
}

export default function MainLayout() {
  const location = useLocation();
  const { isMobile } = useUIStore();
  const { currentSession } = useChatStore();
  const sessionIdMatch = location.pathname.match(/\/chat\/([^/]+)/);
  const selectedSessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;

  // 获取当前会话标题
  const sessionTitle = currentSession?.title;

  const isChatPage = location.pathname.startsWith('/chat');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar selectedSessionId={selectedSessionId} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader title={getPageTitle(location.pathname, sessionTitle)} />
        {isChatPage ? (
          <div className="flex-1 overflow-hidden pb-16 md:pb-0">
            <Outlet />
          </div>
        ) : (
          <ScrollArea className="flex-1 pb-16 md:pb-0">
            <Outlet />
          </ScrollArea>
        )}
        {isMobile && <BottomNav />}
      </main>
    </div>
  );
}
