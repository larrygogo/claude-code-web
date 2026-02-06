import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  startMcpServer,
  stopMcpServer,
  getMcpServerTools,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/contexts/ConfirmContext';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Play,
  Square,
  Plug,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { McpServer, McpTool } from '@claude-web/shared';

export default function McpPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', command: '', args: '', env: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '', env: '' });
  const [expandedTools, setExpandedTools] = useState<Record<string, McpTool[]>>({});
  const [loadingTools, setLoadingTools] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await getMcpServers();
      setServers(data);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newServer.name.trim() || !newServer.command.trim()) return;
    try {
      const server = await createMcpServer({
        name: newServer.name,
        command: newServer.command,
        args: newServer.args ? newServer.args.split('\n').filter(Boolean) : [],
        env: newServer.env ? JSON.parse(newServer.env) : undefined,
      });
      setServers([...servers, server]);
      setNewServer({ name: '', command: '', args: '', env: '' });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create MCP server:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const server = await updateMcpServer(id, {
        name: editForm.name,
        command: editForm.command,
        args: editForm.args ? editForm.args.split('\n').filter(Boolean) : [],
        env: editForm.env ? JSON.parse(editForm.env) : undefined,
      });
      setServers(servers.map(s => s.id === id ? server : s));
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update MCP server:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '确定要删除这个 MCP 服务器吗？',
      description: '删除后无法恢复',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteMcpServer(id);
      setServers(servers.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const server = await startMcpServer(id);
      setServers(servers.map(s => s.id === id ? server : s));
    } catch (error) {
      console.error('Failed to start MCP server:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const server = await stopMcpServer(id);
      setServers(servers.map(s => s.id === id ? server : s));
      // Clear tools when stopped
      setExpandedTools(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } catch (error) {
      console.error('Failed to stop MCP server:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleTools = async (id: string) => {
    if (expandedTools[id]) {
      setExpandedTools(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } else {
      setLoadingTools(prev => ({ ...prev, [id]: true }));
      try {
        const tools = await getMcpServerTools(id);
        setExpandedTools(prev => ({ ...prev, [id]: tools }));
      } catch (error) {
        console.error('Failed to load tools:', error);
      } finally {
        setLoadingTools(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const startEdit = (server: McpServer) => {
    setEditingId(server.id);
    setEditForm({
      name: server.name,
      command: server.command,
      args: server.args?.join('\n') || '',
      env: server.env ? JSON.stringify(server.env, null, 2) : '',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      running: { label: '运行中', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      stopped: { label: '已停止', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
      error: { label: '错误', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    };
    const badge = badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
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
        <h1 className="text-2xl font-bold">MCP 插件</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>MCP 说明</CardTitle>
          <CardDescription>
            Model Context Protocol (MCP) 允许 Claude 连接外部工具和数据源。
            添加 MCP 服务器后，其提供的工具将在对话中可用。
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {servers.map(server => (
          <Card key={server.id}>
            <CardContent className="pt-6">
              {editingId === server.id ? (
                <div className="space-y-4">
                  <Input
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="服务器名称"
                  />
                  <Input
                    value={editForm.command}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, command: e.target.value })}
                    placeholder="启动命令（如 npx, node, python）"
                  />
                  <Textarea
                    value={editForm.args}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, args: e.target.value })}
                    placeholder="命令参数（每行一个）"
                    rows={3}
                  />
                  <Textarea
                    value={editForm.env}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, env: e.target.value })}
                    placeholder='环境变量（JSON 格式，如 {"API_KEY": "xxx"}）'
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(server.id)}>
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
                      <Plug className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{server.name}</span>
                      {getStatusBadge(server.status)}
                    </div>
                    <div className="flex gap-2">
                      {server.status === 'running' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStop(server.id)}
                          disabled={actionLoading[server.id]}
                        >
                          {actionLoading[server.id] ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStart(server.id)}
                          disabled={actionLoading[server.id]}
                        >
                          {actionLoading[server.id] ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => startEdit(server)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(server.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <code>{server.command} {server.args?.join(' ')}</code>
                  </div>

                  {server.status === 'running' && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTools(server.id)}
                        className="w-full justify-start"
                      >
                        {loadingTools[server.id] ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : expandedTools[server.id] ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        查看可用工具
                        {expandedTools[server.id] && ` (${expandedTools[server.id].length})`}
                      </Button>

                      {expandedTools[server.id] && (
                        <div className="mt-2 pl-6 space-y-2">
                          {expandedTools[server.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground">没有可用工具</p>
                          ) : (
                            expandedTools[server.id].map(tool => (
                              <div key={tool.name} className="bg-muted rounded-md p-2">
                                <div className="font-mono text-sm">{tool.name}</div>
                                {tool.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {tool.description}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {server.lastError && (
                    <div className="mt-2 text-sm text-red-500">
                      错误: {server.lastError}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {isCreating ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Input
                value={newServer.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="服务器名称"
              />
              <Input
                value={newServer.command}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="启动命令（如 npx, node, python）"
              />
              <Textarea
                value={newServer.args}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewServer({ ...newServer, args: e.target.value })}
                placeholder="命令参数（每行一个）"
                rows={3}
              />
              <Textarea
                value={newServer.env}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewServer({ ...newServer, env: e.target.value })}
                placeholder='环境变量（JSON 格式，如 {"API_KEY": "xxx"}）'
                rows={3}
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
            添加 MCP 服务器
          </Button>
        )}
      </div>
    </div>
  );
}
