import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Cpu, Settings, ArrowLeft, LogOut } from 'lucide-react';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: '仪表板', end: true },
  { path: '/admin/users', icon: Users, label: '用户管理' },
  { path: '/admin/models', icon: Cpu, label: '模型配置' },
  { path: '/admin/settings', icon: Settings, label: '系统设置' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <aside className="w-64 bg-background border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-lg">管理后台</h1>
          <p className="text-xs text-muted-foreground mt-1">Claude Code Web</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回主站
          </Button>

          <div className="flex items-center justify-between pt-2">
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

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
