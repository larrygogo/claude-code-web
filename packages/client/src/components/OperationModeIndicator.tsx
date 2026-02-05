import React, { useState } from 'react';
import { useSystemStore } from '@/stores/systemStore';
import { Shield, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OperationModeIndicator() {
  const { config, isLoading } = useSystemStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading || !config) {
    return null;
  }

  const isFullMode = config.operationMode === 'full';

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          isFullMode
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
            : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20'
        )}
      >
        <div className="flex items-center gap-2">
          {isFullMode ? (
            <Shield className="h-3.5 w-3.5" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          <span>{isFullMode ? '完整模式' : '受限模式'}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div
          className={cn(
            'px-3 py-2 rounded-lg text-xs space-y-2',
            isFullMode
              ? 'bg-green-500/5 text-green-700 dark:text-green-300'
              : 'bg-yellow-500/5 text-yellow-700 dark:text-yellow-300'
          )}
        >
          <p className="text-muted-foreground">
            {isFullMode
              ? '所有工具功能均可用'
              : '部分工具功能已禁用以保护系统安全'}
          </p>
          <div>
            <p className="text-muted-foreground mb-1">可用工具：</p>
            <div className="flex flex-wrap gap-1">
              {config.enabledTools.map((tool) => (
                <span
                  key={tool}
                  className="px-1.5 py-0.5 bg-accent/50 rounded text-xs"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
          {!isFullMode && (
            <p className="text-muted-foreground border-t pt-2">
              禁用功能：
              {!config.features.fileSystem && ' 文件写入'}
              {!config.features.bash && ' 命令执行'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
