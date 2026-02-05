import React, { useEffect } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, MessageSquare, FolderOpen, Cpu } from 'lucide-react';

export default function AdminDashboardPage() {
  const { stats, statsLoading, fetchDashboard } = useAdminStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (statsLoading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const statCards = [
    { title: '总用户数', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-600' },
    { title: '活跃用户', value: stats?.activeUsers ?? 0, icon: UserCheck, color: 'text-green-600' },
    { title: '已禁用用户', value: stats?.disabledUsers ?? 0, icon: UserX, color: 'text-red-600' },
    { title: '总会话数', value: stats?.totalSessions ?? 0, icon: MessageSquare, color: 'text-purple-600' },
    { title: '总项目数', value: stats?.totalProjects ?? 0, icon: FolderOpen, color: 'text-orange-600' },
    { title: '已启用模型', value: `${stats?.enabledModels ?? 0}/${stats?.totalModels ?? 0}`, icon: Cpu, color: 'text-cyan-600' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">仪表板</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
