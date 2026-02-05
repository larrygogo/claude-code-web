import React, { useState, useEffect } from 'react';
import { ProjectListItem } from '@claude-web/shared';
import { getProjects } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, Folder, FolderX, Check } from 'lucide-react';

interface MoveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  currentProjectId?: string;
}

export function MoveToProjectDialog({
  open,
  onOpenChange,
  sessionId,
  currentProjectId,
}: MoveToProjectDialogProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    currentProjectId ?? null
  );
  const { moveSessionToProject, loadSessions } = useChatStore();

  useEffect(() => {
    if (open) {
      setSelectedProjectId(currentProjectId ?? null);
      loadProjects();
    }
  }, [open, currentProjectId]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await moveSessionToProject(sessionId, selectedProjectId);
      await loadSessions();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to move session:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const isSelected = (projectId: string | null) => selectedProjectId === projectId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移动到项目</DialogTitle>
          <DialogDescription>选择要将此会话移动到的项目</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1 pr-4">
              {/* 无项目选项 */}
              <button
                onClick={() => setSelectedProjectId(null)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  'hover:bg-muted',
                  isSelected(null) && 'bg-primary/10 border border-primary'
                )}
              >
                <FolderX className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="flex-1 font-medium">无项目</span>
                {isSelected(null) && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>

              {/* 项目列表 */}
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    'hover:bg-muted',
                    isSelected(project.id) && 'bg-primary/10 border border-primary'
                  )}
                >
                  <Folder className="h-5 w-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.name}</div>
                    {project.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </div>
                    )}
                  </div>
                  {isSelected(project.id) && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  暂无可用项目
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleMove}
            disabled={isMoving || selectedProjectId === (currentProjectId ?? null)}
          >
            {isMoving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                移动中...
              </>
            ) : (
              '确认移动'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
