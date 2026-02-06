import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetupStore } from '@/stores/setupStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { SetupModelInput, SetupAdminInput, SetupFeaturesInput } from '@claude-web/shared';

// 步骤组件
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">Claude Web</CardTitle>
        <CardDescription className="text-lg mt-2">
          初始化向导
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          欢迎使用 Claude Web！这是一个基于 Claude AI 的智能助手平台。
        </p>
        <p className="text-center text-muted-foreground">
          接下来，您需要完成以下配置：
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>配置 AI 模型（API Key 等）</li>
          <li>创建管理员账号</li>
          <li>设置功能开关</li>
        </ul>
      </CardContent>
      <CardFooter className="justify-center">
        <Button onClick={onNext} size="lg">
          开始配置
        </Button>
      </CardFooter>
    </Card>
  );
}

function ModelStep({
  onNext,
  onBack,
  error,
  defaultValues,
}: {
  onNext: (data: SetupModelInput) => void;
  onBack: () => void;
  error: string | null;
  defaultValues: SetupModelInput | null;
}) {
  const [formData, setFormData] = useState<SetupModelInput>(
    defaultValues ?? {
      name: 'Claude Default',
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      apiEndpoint: 'https://api.anthropic.com',
      apiKey: '',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>配置 AI 模型</CardTitle>
        <CardDescription>
          请输入您的 Anthropic API 配置信息
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">配置名称</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：Claude Default"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">模型 ID</label>
            <Input
              value={formData.modelId}
              onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
              placeholder="例如：claude-sonnet-4-20250514"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API 端点</label>
            <Input
              type="url"
              value={formData.apiEndpoint}
              onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
              placeholder="https://api.anthropic.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-ant-..."
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              您可以在 Anthropic Console 获取 API Key
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            上一步
          </Button>
          <Button type="submit">
            下一步
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AdminStep({
  onNext,
  onBack,
  error,
  defaultValues,
}: {
  onNext: (data: SetupAdminInput) => void;
  onBack: () => void;
  error: string | null;
  defaultValues: SetupAdminInput | null;
}) {
  const [formData, setFormData] = useState<SetupAdminInput>(
    defaultValues ?? {
      email: '',
      username: '',
      password: '',
    }
  );
  const [confirmPassword, setConfirmPassword] = useState(defaultValues?.password ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== confirmPassword) {
      return;
    }
    onNext(formData);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>创建管理员账号</CardTitle>
        <CardDescription>
          此账号将拥有系统的完全管理权限
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">邮箱地址</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">用户名</label>
            <Input
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Admin"
              minLength={2}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">密码</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="至少 8 个字符"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">确认密码</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              minLength={8}
              required
            />
            {confirmPassword && formData.password !== confirmPassword && (
              <p className="text-xs text-red-500">两次输入的密码不一致</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            上一步
          </Button>
          <Button
            type="submit"
            disabled={formData.password !== confirmPassword}
          >
            下一步
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function FeaturesStep({
  onNext,
  onBack,
  error,
  defaultValues,
}: {
  onNext: (data: SetupFeaturesInput) => void;
  onBack: () => void;
  error: string | null;
  defaultValues: SetupFeaturesInput | null;
}) {
  const [formData, setFormData] = useState<SetupFeaturesInput>(
    defaultValues ?? {
      enableFileSystem: true,
      enableBash: true,
      clientUrl: window.location.origin,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>功能配置</CardTitle>
        <CardDescription>
          配置系统功能开关和安全选项
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">文件系统访问</label>
              <p className="text-xs text-muted-foreground">
                允许 AI 读取和修改文件
              </p>
            </div>
            <Switch
              checked={formData.enableFileSystem}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enableFileSystem: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">命令执行</label>
              <p className="text-xs text-muted-foreground">
                允许 AI 执行系统命令
              </p>
            </div>
            <Switch
              checked={formData.enableBash}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enableBash: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">前端 URL</label>
            <Input
              type="url"
              value={formData.clientUrl}
              onChange={(e) => setFormData({ ...formData, clientUrl: e.target.value })}
              placeholder="http://localhost:3000"
            />
            <p className="text-xs text-muted-foreground">
              用于 CORS 配置，通常保持默认值即可
            </p>
          </div>

          {(!formData.enableFileSystem || !formData.enableBash) && (
            <div className="p-3 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-md">
              提示：禁用这些功能会限制 AI 的能力，但可以提高安全性。
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            上一步
          </Button>
          <Button type="submit">
            下一步
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function CompleteStep({
  onComplete,
  isLoading,
  error,
}: {
  onComplete: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <CardTitle>确认配置</CardTitle>
        <CardDescription>
          请确认所有配置无误
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
            {error}
          </div>
        )}
        <p className="text-muted-foreground">
          点击下方按钮将保存所有配置并进入系统。
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button onClick={onComplete} size="lg" disabled={isLoading}>
          {isLoading ? '保存中...' : '保存配置并进入系统'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// 主组件
export default function SetupPage() {
  const navigate = useNavigate();
  const { setAuthState } = useAuthStore();
  const {
    currentStep,
    setCurrentStep,
    setupModel,
    setupAdmin,
    setupFeatures,
    completeSetup,
    modelConfig,
    adminConfig,
    featuresConfig,
    isLoading,
    error,
    checkSystemStatus,
  } = useSetupStore();

  // 检查系统状态
  useEffect(() => {
    checkSystemStatus().then((status) => {
      if (status.initialized) {
        navigate('/login');
      }
    }).catch(() => {
      // 忽略错误，继续显示初始化页面
    });
  }, [checkSystemStatus, navigate]);

  const handleModelSubmit = (data: SetupModelInput) => {
    setupModel(data);
  };

  const handleAdminSubmit = (data: SetupAdminInput) => {
    setupAdmin(data);
  };

  const handleFeaturesSubmit = (data: SetupFeaturesInput) => {
    setupFeatures(data);
  };

  const handleComplete = async () => {
    try {
      const authResponse = await completeSetup();

      if (authResponse) {
        // 自动登录成功
        setAuthState(authResponse.user, authResponse.tokens);
        navigate('/chat');
      } else {
        // 没有自动登录，跳转到登录页
        navigate('/login');
      }
    } catch {
      // 错误已在 store 中处理
    }
  };

  // 步骤进度指示器
  const steps = ['欢迎', '模型配置', '管理员账号', '功能设置', '完成'];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* 步骤进度 */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{step}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 步骤内容 */}
      {currentStep === 0 && <WelcomeStep onNext={() => setCurrentStep(1)} />}
      {currentStep === 1 && (
        <ModelStep
          onNext={handleModelSubmit}
          onBack={() => setCurrentStep(0)}
          error={error}
          defaultValues={modelConfig}
        />
      )}
      {currentStep === 2 && (
        <AdminStep
          onNext={handleAdminSubmit}
          onBack={() => setCurrentStep(1)}
          error={error}
          defaultValues={adminConfig}
        />
      )}
      {currentStep === 3 && (
        <FeaturesStep
          onNext={handleFeaturesSubmit}
          onBack={() => setCurrentStep(2)}
          error={error}
          defaultValues={featuresConfig}
        />
      )}
      {currentStep === 4 && (
        <CompleteStep
          onComplete={handleComplete}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
}
