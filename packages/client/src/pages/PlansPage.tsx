import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanListItem } from '@claude-web/shared';
import { getPlans, updatePlan, executePlan } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, cn } from '@/lib/utils';
import { FileText, Play, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

const statusConfig = {
  draft: { label: '草稿', icon: Clock, color: 'text-muted-foreground' },
  approved: { label: '已批准', icon: CheckCircle, color: 'text-blue-500' },
  executing: { label: '执行中', icon: Loader2, color: 'text-orange-500' },
  completed: { label: '已完成', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: '已取消', icon: XCircle, color: 'text-destructive' },
};

export default function PlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载计划失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleApprove = async (planId: string) => {
    try {
      await updatePlan(planId, { status: 'approved' });
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批准计划失败');
    }
  };

  const handleExecute = async (planId: string) => {
    try {
      await executePlan(planId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行计划失败');
    }
  };

  const handleCancel = async (planId: string) => {
    try {
      await updatePlan(planId, { status: 'cancelled' });
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消计划失败');
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">计划管理</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无计划</p>
            <p className="text-sm mt-2">在对话中使用 Plan 模式创建计划</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const status = statusConfig[plan.status];
            const StatusIcon = status.icon;

            return (
              <Card key={plan.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <FileText className="h-5 w-5 mt-1 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{plan.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className={cn('flex items-center gap-1', status.color)}>
                          <StatusIcon className={cn('h-4 w-4', plan.status === 'executing' && 'animate-spin')} />
                          {status.label}
                        </span>
                        <span>{formatDate(plan.createdAt)}</span>
                      </div>
                      {plan.projectName && (
                        <div className="text-sm text-blue-500 mt-1">
                          {plan.projectName}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(plan.id)}
                          >
                            批准
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(plan.id)}
                          >
                            取消
                          </Button>
                        </>
                      )}
                      {plan.status === 'approved' && (
                        <Button size="sm" onClick={() => handleExecute(plan.id)}>
                          <Play className="h-4 w-4 mr-1" />
                          执行
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/chat/${plan.sessionId}`)}
                      >
                        查看会话
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
