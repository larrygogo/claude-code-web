import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/contexts/ConfirmContext';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import type { UserRule } from '@claude-web/shared';

export default function RulesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [rules, setRules] = useState<UserRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', content: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', content: '' });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await getRules();
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newRule.name.trim() || !newRule.content.trim()) return;
    try {
      const rule = await createRule(newRule);
      setRules([...rules, rule]);
      setNewRule({ name: '', content: '' });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const rule = await updateRule(id, editForm);
      setRules(rules.map(r => r.id === id ? rule : r));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '确定要删除这条规则吗？',
      description: '删除后无法恢复',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteRule(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const rule = await toggleRule(id);
      setRules(rules.map(r => r.id === id ? rule : r));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const startEdit = (rule: UserRule) => {
    setEditingId(rule.id);
    setEditForm({ name: rule.name, content: rule.content });
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">全局规则</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>规则说明</CardTitle>
          <CardDescription>
            规则会被注入到每次对话的系统提示词中，用于自定义 Claude 的行为。
            例如：代码风格、语言偏好、回复格式等。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {rules.map(rule => (
          <Card key={rule.id}>
            <CardContent className="pt-6">
              {editingId === rule.id ? (
                <div className="space-y-4">
                  <Input
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="规则名称"
                  />
                  <Textarea
                    value={editForm.content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, content: e.target.value })}
                    placeholder="规则内容"
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(rule.id)}>
                      <Save className="h-4 w-4 mr-2" />
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 mr-2" />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggle(rule.id)}
                      />
                      <span className="font-medium">{rule.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {rule.content}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {isCreating ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Input
                value={newRule.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="规则名称"
              />
              <Textarea
                value={newRule.content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewRule({ ...newRule, content: e.target.value })}
                placeholder="规则内容"
                rows={4}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate}>
                  <Save className="h-4 w-4 mr-2" />
                  创建
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setIsCreating(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            添加规则
          </Button>
        )}
      </div>
    </div>
  );
}
