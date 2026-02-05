import React, { useEffect, useState } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Star, Check } from 'lucide-react';
import { ModelConfigInput, ModelConfigUpdateInput, ModelProvider } from '@claude-web/shared';

const providerOptions: { value: ModelProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: '自定义' },
];

interface ModelFormData {
  name: string;
  provider: ModelProvider;
  modelId: string;
  apiEndpoint: string;
  apiKey: string;
  isEnabled: boolean;
  isDefault: boolean;
  priority: number;
}

const defaultFormData: ModelFormData = {
  name: '',
  provider: 'anthropic',
  modelId: '',
  apiEndpoint: 'https://api.anthropic.com',
  apiKey: '',
  isEnabled: true,
  isDefault: false,
  priority: 0,
};

export default function AdminModelsPage() {
  const { models, modelsLoading, fetchModels, createModel, updateModel, deleteModel } = useAdminStore();
  const confirm = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const model = models.find((m) => m.id === id);
    if (model) {
      setEditingId(id);
      setFormData({
        name: model.name,
        provider: model.provider,
        modelId: model.modelId,
        apiEndpoint: model.apiEndpoint,
        apiKey: '', // 不回显 API Key
        isEnabled: model.isEnabled,
        isDefault: model.isDefault,
        priority: model.priority,
      });
      setDialogOpen(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId) {
        // 更新
        const input: ModelConfigUpdateInput = {
          name: formData.name,
          provider: formData.provider,
          modelId: formData.modelId,
          apiEndpoint: formData.apiEndpoint,
          isEnabled: formData.isEnabled,
          isDefault: formData.isDefault,
          priority: formData.priority,
        };
        // 只有填写了新的 API Key 才更新
        if (formData.apiKey) {
          input.apiKey = formData.apiKey;
        }
        await updateModel(editingId, input);
      } else {
        // 创建
        const input: ModelConfigInput = {
          ...formData,
        };
        await createModel(input);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save model:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: `确定要删除模型 "${name}" 吗？`,
      description: '删除后将无法恢复。',
      confirmText: '删除',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteModel(id);
      } catch (error) {
        console.error('Failed to delete model:', error);
      }
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      await updateModel(id, { isEnabled: !currentEnabled });
    } catch (error) {
      console.error('Failed to toggle model:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await updateModel(id, { isDefault: true });
      // 刷新列表以更新其他模型的 isDefault 状态
      fetchModels();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  const isFormValid = editingId
    ? formData.name && formData.modelId && formData.apiEndpoint
    : formData.name && formData.modelId && formData.apiEndpoint && formData.apiKey;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">模型配置</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>模型列表</CardTitle>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {modelsLoading && models.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无模型配置，点击上方按钮添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">名称</th>
                    <th className="text-left py-3 px-4 font-medium">提供商</th>
                    <th className="text-left py-3 px-4 font-medium">模型 ID</th>
                    <th className="text-left py-3 px-4 font-medium">API 端点</th>
                    <th className="text-left py-3 px-4 font-medium">状态</th>
                    <th className="text-left py-3 px-4 font-medium">优先级</th>
                    <th className="text-left py-3 px-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr key={model.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {model.name}
                          {model.isDefault && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              <Star className="h-3 w-3 mr-1" />
                              默认
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {providerOptions.find((p) => p.value === model.provider)?.label || model.provider}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">{model.modelId}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm max-w-48 truncate">
                        {model.apiEndpoint}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleEnabled(model.id, model.isEnabled)}
                          className={cn(
                            'px-2 py-1 rounded text-sm font-medium transition-colors',
                            model.isEnabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                          )}
                        >
                          {model.isEnabled ? '已启用' : '已禁用'}
                        </button>
                      </td>
                      <td className="py-3 px-4">{model.priority}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {!model.isDefault && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSetDefault(model.id)}
                              title="设为默认"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(model.id)}
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(model.id, model.name)}
                            title="删除"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑模型' : '添加模型'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：Claude Sonnet"
              />
            </div>
            <div>
              <label className="text-sm font-medium">提供商</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as ModelProvider })}
                className="w-full px-3 py-2 rounded-md border bg-background"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">模型 ID</label>
              <Input
                value={formData.modelId}
                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                placeholder="例如：claude-sonnet-4-20250514"
              />
            </div>
            <div>
              <label className="text-sm font-medium">API 端点</label>
              <Input
                value={formData.apiEndpoint}
                onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                placeholder="https://api.anthropic.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                API Key {editingId && <span className="text-muted-foreground">(留空则不修改)</span>}
              </label>
              <Input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={editingId ? '留空则保持原有值' : '输入 API Key'}
              />
            </div>
            <div>
              <label className="text-sm font-medium">优先级</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">数值越大优先级越高</p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">启用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">设为默认</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid || isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
