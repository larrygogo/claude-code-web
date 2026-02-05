import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectListItem } from '@claude-web/shared';
import { getProjects, createProject, searchProjectPath } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { FolderOpen, Plus, Loader2, X, Sparkles, Search, Check } from 'lucide-react';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [error, setError] = useState('');

  // AI 搜索相关状态
  const [showAISearch, setShowAISearch] = useState(false);
  const [aiSearchQuery, setAISearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchMessage, setSearchMessage] = useState('');

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');

    try {
      await createProject({
        name: newProjectName,
        path: newProjectPath || undefined,
        description: newProjectDescription || undefined,
      });
      setShowCreateForm(false);
      setNewProjectName('');
      setNewProjectPath('');
      setNewProjectDescription('');
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAISearch = async () => {
    if (!aiSearchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSearchMessage('');
    setError('');

    try {
      const result = await searchProjectPath(aiSearchQuery);
      setSearchResults(result.paths || []);
      setSearchMessage(result.message || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (path: string) => {
    setNewProjectPath(path);
    setShowAISearch(false);
    setAISearchQuery('');
    setSearchResults([]);
    setSearchMessage('');
  };

  const { isMobile, setMobileHeaderActions } = useUIStore();

  // 移动端设置 MobileHeader actions
  useEffect(() => {
    if (isMobile) {
      setMobileHeaderActions(
        <Button size="icon" variant="ghost" onClick={() => setShowCreateForm(true)}>
          <Plus className="h-5 w-5" />
        </Button>
      );
      return () => setMobileHeaderActions(null);
    }
  }, [isMobile]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="hidden md:flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建项目
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">新建项目</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  项目名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  placeholder="我的项目"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  项目描述
                </label>
                <Input
                  id="description"
                  placeholder="简要描述项目用途..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="path" className="text-sm font-medium">
                  项目路径 <span className="text-xs text-muted-foreground">(可选)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    id="path"
                    placeholder="/path/to/your/project"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAISearch(!showAISearch)}
                    className="shrink-0"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI 搜索
                  </Button>
                </div>

                {/* AI 搜索面板 */}
                {showAISearch && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex gap-2">
                      <Input
                        placeholder="描述你的项目，例如：我的 React 博客项目"
                        value={aiSearchQuery}
                        onChange={(e) => setAISearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAISearch}
                        disabled={isSearching || !aiSearchQuery.trim()}
                        size="icon"
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {isSearching && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI 正在搜索...
                      </div>
                    )}

                    {searchMessage && !isSearching && (
                      <p className="text-sm text-muted-foreground">{searchMessage}</p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">点击选择路径：</p>
                        {searchResults.map((path, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSelectSearchResult(path)}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-md text-sm font-mono',
                              'hover:bg-primary/10 transition-colors',
                              'flex items-center gap-2',
                              newProjectPath === path && 'bg-primary/10'
                            )}
                          >
                            <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
                            <span className="truncate">{path}</span>
                            {newProjectPath === path && (
                              <Check className="h-4 w-4 ml-auto text-green-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isSearching && searchResults.length === 0 && searchMessage && (
                      <p className="text-sm text-muted-foreground">未找到匹配的项目路径</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  关联本地目录后可自动读取 CLAUDE.md 配置
                </p>
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                创建
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无项目</p>
            <Button onClick={() => setShowCreateForm(true)} variant="outline" className="mt-4">
              创建第一个项目
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 mt-1 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    {project.path && (
                      <p className="text-xs text-muted-foreground truncate mt-1 font-mono">
                        {project.path}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{project.sessionCount} 个会话</span>
                      <span>最近访问: {formatDate(project.lastAccessedAt)}</span>
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
