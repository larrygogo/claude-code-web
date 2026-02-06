import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useSystemStore } from '@/stores/systemStore';
import { useSetupStore } from '@/stores/setupStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ConfirmProvider } from '@/contexts/ConfirmContext';

import LoginPage from '@/pages/LoginPage';
import SetupPage from '@/pages/SetupPage';
import ChatPage from '@/pages/ChatPage';
import SessionsPage from '@/pages/SessionsPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import PlansPage from '@/pages/PlansPage';
import SettingsPage from '@/pages/SettingsPage';
import RulesPage from '@/pages/settings/RulesPage';
import SkillsPage from '@/pages/settings/SkillsPage';
import McpPage from '@/pages/settings/McpPage';
import MainLayout from '@/components/Layout/MainLayout';
import { AdminRoute } from '@/components/AdminRoute';
import { AdminLayout } from '@/components/Layout/AdminLayout';
import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminUsersPage from '@/pages/admin/UsersPage';
import AdminModelsPage from '@/pages/admin/ModelsPage';
import AdminSystemSettingsPage from '@/pages/admin/SystemSettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

// 初始化检查路由守卫
function InitializationGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { systemStatus, checkSystemStatus } = useSetupStore();
  const [isChecking, setIsChecking] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // 如果已经在 setup 页面，不需要检查
    if (location.pathname === '/setup') {
      setIsChecking(false);
      return;
    }

    // 检查系统状态
    checkSystemStatus()
      .then(() => {
        setConnectionError(null);
        setIsChecking(false);
      })
      .catch((error: unknown) => {
        // 区分网络错误和业务错误
        // TypeError 通常是 fetch 网络层错误（服务器不可达、CORS 等）
        if (error instanceof TypeError) {
          setConnectionError('无法连接到服务器，请检查后端服务是否已启动');
        } else {
          setConnectionError(
            error instanceof Error ? error.message : '检查系统状态失败，请稍后重试'
          );
        }
        setIsChecking(false);
      });
  }, [checkSystemStatus, location.pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 网络/连接错误：显示错误提示，不跳转 setup
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="text-destructive text-lg font-medium">连接失败</div>
          <p className="text-muted-foreground">{connectionError}</p>
          <button
            onClick={() => {
              setIsChecking(true);
              setConnectionError(null);
              checkSystemStatus()
                .then(() => {
                  setConnectionError(null);
                  setIsChecking(false);
                })
                .catch((err: unknown) => {
                  if (err instanceof TypeError) {
                    setConnectionError('无法连接到服务器，请检查后端服务是否已启动');
                  } else {
                    setConnectionError(
                      err instanceof Error ? err.message : '检查系统状态失败，请稍后重试'
                    );
                  }
                  setIsChecking(false);
                });
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 仅当 API 成功返回且系统确实未初始化时，才重定向到 setup
  if (location.pathname !== '/setup' && systemStatus && !systemStatus.initialized) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize, isInitialized, user } = useAuthStore();
  const { setIsMobile } = useUIStore();
  const { fetchConfig } = useSystemStore();
  const isMobile = useIsMobile();

  const theme = user?.settings?.theme || 'system';

  useEffect(() => {
    initialize();
    fetchConfig();
  }, [initialize, fetchConfig]);

  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  // 应用主题
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);

      const listener = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches);
      };
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <InitializationGuard>
        <Routes>
          {/* 初始化向导（公开） */}
          <Route path="/setup" element={<SetupPage />} />

          {/* 登录（公开） */}
          <Route path="/login" element={<LoginPage />} />

          {/* 主应用（需认证） */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/chat" />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:sessionId" element={<ChatPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/rules" element={<RulesPage />} />
            <Route path="settings/skills" element={<SkillsPage />} />
            <Route path="settings/mcp" element={<McpPage />} />
          </Route>

          {/* 管理后台（需管理员权限） */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="models" element={<AdminModelsPage />} />
            <Route path="settings" element={<AdminSystemSettingsPage />} />
          </Route>
        </Routes>
      </InitializationGuard>
    </ConfirmProvider>
  );
}
