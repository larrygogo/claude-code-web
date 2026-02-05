import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, SessionListItem } from '@claude-web/shared';
import { getProject, updateProject, deleteProject, getSessions } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { useConfirm } from '@/contexts/ConfirmContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  MessageSquare,
  FolderOpen,
  Save,
  X,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { newSession } = useChatStore();
  const confirm = useConfirm();

  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [error, setError] = useState('');

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProject = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await getProject(projectId);
      setProject(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectSessions = async () => {
    if (!projectId) return;
    setIsLoadingSessions(true);
    try {
      const data = await getSessions(projectId);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载会话列表失败');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadProject();
    loadProjectSessions();
  }, [projectId]);

  const handleNewSession = async () => {
    if (!projectId) return;
    const sessionId = await newSession(projectId);
    navigate(`/chat/${sessionId}`);
  };

  const handleSaveEdit = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const updated = await updateProject(projectId, {
        name: editName,
        description: editDescription || undefined,
      });
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新项目失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    const confirmed = await confirm({
      title: '确定要删除这个项目吗？',
      description: '关联的会话不会被删除。',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除项目失败');
    }
  };

  const { isMobile, setMobileHeaderActions } = useUIStore();

  // 移动端设置 MobileHeader actions
  useEffect(() => {
    if (isMobile) {
      setMobileHeaderActions(
        <>
          <Button size="icon" variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
            <Edit2 className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="h-5 w-5" />
          </Button>
        </>
      );
      return () => setMobileHeaderActions(null);
    }
  }, [isMobile, isEditing]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="text-center text-muted-foreground py-12">
          <p>项目不存在</p>
          <Button onClick={() => navigate('/projects')} variant="outline" className="mt-4">
            返回项目列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 顶部导航 */}
      <div className="hidden md:flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">{project.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {/* 编辑表单 */}
      {isEditing && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">编辑项目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="edit-name" className="text-sm font-medium">项目名称</label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-description" className="text-sm font-medium">项目描述</label>
                <Input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="简要描述项目用途..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  保存
                </Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 项目信息 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-5 w-5 mt-0.5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              {project.description && (
                <p className="text-sm text-muted-foreground">{project.description}</p>
              )}
              {project.path && (
                <p className="text-xs text-muted-foreground font-mono mt-1">{project.path}</p>
              )}
              {!project.description && !project.path && (
                <p className="text-sm text-muted-foreground">暂无描述</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 会话列表 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">会话列表</h2>
        <Button onClick={handleNewSession}>
          <Plus className="h-4 w-4 mr-2" />
          新建对话
        </Button>
      </div>

      {isLoadingSessions ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>该项目暂无会话</p>
            <Button onClick={handleNewSession} variant="outline" className="mt-3">
              开始第一个对话
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/chat/${session.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{session.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{session.messageCount} 条消息</span>
                      <span>{formatDate(session.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
