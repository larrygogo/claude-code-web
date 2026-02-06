import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSkills, createSkill, updateSkill, deleteSkill } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/contexts/ConfirmContext';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Terminal } from 'lucide-react';
import type { Skill, UserSkill } from '@claude-web/shared';

// 统一的展示类型
type DisplaySkill = (Skill & { id?: string; source?: string }) | (UserSkill & { source: string; isBuiltin?: boolean });

export default function SkillsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [skills, setSkills] = useState<DisplaySkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', prompt: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', description: '', prompt: '' });

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const data = await getSkills();
      setSkills(data);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newSkill.name.trim() || !newSkill.prompt.trim()) return;
    try {
      const skill = await createSkill(newSkill);
      setSkills([...skills, { ...skill, source: 'custom' }]);
      setNewSkill({ name: '', description: '', prompt: '' });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create skill:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const skill = await updateSkill(id, editForm);
      setSkills(skills.map(s => getSkillId(s) === id ? { ...skill, source: 'custom' } : s));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update skill:', error);
    }
  };

  // 获取技能的 ID（自定义技能有 id，内置技能使用 name）
  const getSkillId = (skill: DisplaySkill): string => {
    return 'id' in skill && skill.id ? skill.id : skill.name;
  };

  // 获取技能的来源
  const getSkillSource = (skill: DisplaySkill): string => {
    if ('source' in skill && skill.source) return skill.source;
    if ('isBuiltin' in skill && skill.isBuiltin) return 'builtin';
    return 'custom';
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '确定要删除这个技能吗？',
      description: '删除后无法恢复',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteSkill(id);
      setSkills(skills.filter(s => getSkillId(s) !== id));
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  const startEdit = (skill: DisplaySkill) => {
    if (getSkillSource(skill) !== 'custom') return;
    const skillId = getSkillId(skill);
    setEditingId(skillId);
    setEditForm({
      name: skill.name,
      description: skill.description || '',
      prompt: skill.prompt,
    });
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      builtin: { label: '内置', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      local: { label: '本地', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      custom: { label: '自定义', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    };
    const badge = badges[source] || { label: source, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
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
        <h1 className="text-2xl font-bold">快捷命令 (Skills)</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>技能说明</CardTitle>
          <CardDescription>
            技能是预定义的提示词模板，可以通过 /command 快速调用。
            在聊天输入框中输入 / 即可查看可用技能列表。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {skills.map(skill => {
          const skillId = getSkillId(skill);
          const skillSource = getSkillSource(skill);
          return (
          <Card key={skillId}>
            <CardContent className="pt-6">
              {editingId === skillId ? (
                <div className="space-y-4">
                  <Input
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="技能名称（不含 /）"
                  />
                  <Input
                    value={editForm.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="技能描述（可选）"
                  />
                  <Textarea
                    value={editForm.prompt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, prompt: e.target.value })}
                    placeholder="提示词模板"
                    rows={6}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(skillId)}>
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
                      <Terminal className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium font-mono">/{skill.name}</span>
                      {getSourceBadge(skillSource)}
                    </div>
                    {skillSource === 'custom' && (
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(skill)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(skillId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {skill.description}
                    </p>
                  )}
                  <div className="bg-muted rounded-md p-3 mt-2">
                    <p className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                      {skill.prompt.length > 200 ? skill.prompt.slice(0, 200) + '...' : skill.prompt}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
        })}

        {isCreating ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Input
                value={newSkill.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSkill({ ...newSkill, name: e.target.value })}
                placeholder="技能名称（不含 /）"
              />
              <Input
                value={newSkill.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSkill({ ...newSkill, description: e.target.value })}
                placeholder="技能描述（可选）"
              />
              <Textarea
                value={newSkill.prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSkill({ ...newSkill, prompt: e.target.value })}
                placeholder="提示词模板"
                rows={6}
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
            添加自定义技能
          </Button>
        )}
      </div>
    </div>
  );
}
