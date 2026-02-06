import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';
import { Save, RefreshCw } from 'lucide-react';

interface FeatureFlags {
  fileSystem: boolean;
  bash: boolean;
}

interface CorsSettings {
  clientUrl: string;
}

export default function AdminSystemSettingsPage() {
  const [features, setFeatures] = useState<FeatureFlags>({
    fileSystem: true,
    bash: true,
  });
  const [cors, setCors] = useState<CorsSettings>({
    clientUrl: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载设置
  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [featuresData, corsData] = await Promise.all([
        apiClient.get<FeatureFlags>('/api/admin/settings/features'),
        apiClient.get<{ clientUrl: string }>('/api/admin/settings/cors'),
      ]);
      setFeatures(featuresData);
      setCors(corsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // 保存功能开关
  const saveFeatures = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.patch<FeatureFlags>('/api/admin/settings/features', features);
      setSuccessMessage('功能设置已保存');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存功能设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 保存 CORS 配置
  const saveCors = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.patch<{ clientUrl: string }>('/api/admin/settings/cors', cors);
      setSuccessMessage('CORS 配置已保存');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 CORS 配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">系统设置</h1>

      <div className="space-y-6">
        {error && (
          <div className="p-4 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 text-sm text-green-600 bg-green-50 dark:bg-green-950 rounded-md">
            {successMessage}
          </div>
        )}

        {/* 功能开关 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>功能开关</CardTitle>
                <CardDescription>
                  控制 AI 助手的系统访问权限
                </CardDescription>
              </div>
              <Button variant="outline" onClick={fetchSettings} disabled={isLoading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
            </div>
          </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">文件系统访问</label>
              <p className="text-xs text-muted-foreground">
                允许 AI 读取和修改文件。启用后，AI 可以使用 Read、Write、Edit 等工具。
              </p>
            </div>
            <Switch
              checked={features.fileSystem}
              onCheckedChange={(checked) =>
                setFeatures({ ...features, fileSystem: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">命令执行</label>
              <p className="text-xs text-muted-foreground">
                允许 AI 执行系统命令。启用后，AI 可以使用 Bash 工具执行 shell 命令。
              </p>
            </div>
            <Switch
              checked={features.bash}
              onCheckedChange={(checked) =>
                setFeatures({ ...features, bash: checked })
              }
            />
          </div>

          {(!features.fileSystem || !features.bash) && (
            <div className="p-3 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-md">
              警告：禁用这些功能会限制 AI 的能力。在受限模式下，AI 只能进行对话和读取操作。
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveFeatures} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存功能设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CORS 配置 */}
      <Card>
        <CardHeader>
          <CardTitle>CORS 配置</CardTitle>
          <CardDescription>
            配置跨域请求允许的来源
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">允许的客户端 URL</label>
            <Input
              type="url"
              value={cors.clientUrl}
              onChange={(e) => setCors({ ...cors, clientUrl: e.target.value })}
              placeholder="http://localhost:3000"
            />
            <p className="text-xs text-muted-foreground">
              设置允许访问 API 的前端地址。修改后可能需要重启服务器才能生效。
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveCors} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存 CORS 配置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
          <CardDescription>
            当前系统状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">操作模式：</span>
              <span className="ml-2 font-medium">
                {features.fileSystem && features.bash ? '完整模式' : '受限模式'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">文件系统：</span>
              <span className={`ml-2 font-medium ${features.fileSystem ? 'text-green-600' : 'text-red-500'}`}>
                {features.fileSystem ? '已启用' : '已禁用'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">命令执行：</span>
              <span className={`ml-2 font-medium ${features.bash ? 'text-green-600' : 'text-red-500'}`}>
                {features.bash ? '已启用' : '已禁用'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">版本：</span>
              <span className="ml-2 font-medium">1.0.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
