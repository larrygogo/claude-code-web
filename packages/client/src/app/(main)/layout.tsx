'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Sidebar } from '@/components/Layout';
import { MobileHeader, BottomNav } from '@/components/Mobile';
import { useUIStore } from '@/stores/uiStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isInitialized } = useAuthStore();
  const { isMobile } = useUIStore();

  useEffect(() => {
    if (isInitialized && !user) {
      router.replace('/login');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const sessionIdMatch = pathname.match(/\/chat\/([^/]+)/);
  const selectedSessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar selectedSessionId={selectedSessionId} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader title={getPageTitle(pathname)} />
        <div className="flex-1 overflow-hidden pb-16 md:pb-0">{children}</div>
        {isMobile && <BottomNav />}
      </main>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/chat')) return '聊天';
  if (pathname.startsWith('/sessions')) return '会话';
  if (pathname.startsWith('/projects')) return '项目';
  if (pathname.startsWith('/plans')) return '计划';
  if (pathname.startsWith('/settings')) return '设置';
  return 'Claude Code';
}
