import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, ContentBlock, ToolUse, ToolResult } from '@claude-web/shared';
import { cn, formatDate } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Edit,
  Terminal,
  Search,
  Globe,
  Code,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface StreamingBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content?: string;
  toolUse?: { id: string; name: string; input: Record<string, unknown> };
  toolResult?: { toolUseId: string; content: string; isError?: boolean };
}

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  streamingBlocks?: StreamingBlock[];
}

const toolIcons: Record<string, React.ElementType> = {
  Read: FileText,
  Write: Edit,
  Edit: Edit,
  Bash: Terminal,
  Glob: Search,
  Grep: Search,
  WebFetch: Globe,
  WebSearch: Globe,
  Task: Code,
};

export function MessageItem({
  message,
  isStreaming,
  streamingBlocks,
}: MessageItemProps) {
  const isUser = message.role === 'user';

  const content = isStreaming
    ? buildStreamingContent(streamingBlocks)
    : message.content;

  return (
    <div className={cn('py-6 message-fade-in overflow-hidden')}>
      <div className="max-w-3xl mx-auto px-4 overflow-hidden">
        {/* Role indicator */}
        <div className="flex items-center gap-2 mb-3">
          {isUser ? (
            <span className="text-sm font-medium text-muted-foreground">你</span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-sm font-medium">Claude</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(message.createdAt)}
          </span>
        </div>

        {/* Content */}
        <div className="space-y-3 overflow-hidden">
          {content.map((block, index) => (
            <ContentBlockRenderer
              key={index}
              block={block}
              isStreaming={isStreaming && index === content.length - 1}
              allBlocks={content}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildStreamingContent(
  streamingBlocks?: StreamingBlock[]
): ContentBlock[] {
  if (!streamingBlocks || streamingBlocks.length === 0) {
    return [];
  }

  // 直接将 StreamingBlock 转换为 ContentBlock，保持原有顺序
  return streamingBlocks.map((block): ContentBlock => {
    switch (block.type) {
      case 'text':
        return { type: 'text', content: block.content || '' };
      case 'thinking':
        return { type: 'thinking', content: block.content || '' };
      case 'tool_use':
        return {
          type: 'tool_use',
          toolUse: block.toolUse || { id: '', name: '', input: {} },
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          toolResult: block.toolResult || { toolUseId: '', content: '', isError: false },
        };
      default:
        return { type: 'text', content: '' };
    }
  });
}

function ContentBlockRenderer({
  block,
  isStreaming,
  allBlocks,
}: {
  block: ContentBlock;
  isStreaming?: boolean;
  allBlocks?: ContentBlock[];
}) {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content} isStreaming={isStreaming} />;
    case 'thinking':
      return <ThinkingBlock content={block.content} />;
    case 'tool_use': {
      // Check if this tool use has a corresponding result
      const hasResult = allBlocks?.some(
        b => b.type === 'tool_result' && b.toolResult.toolUseId === block.toolUse.id
      );
      return <ToolUseBlock toolUse={block.toolUse} isExecuting={!hasResult} />;
    }
    case 'tool_result':
      return <ToolResultBlock toolResult={block.toolResult} />;
    default:
      return null;
  }
}

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="language-label">{language}</span>
        <button
          onClick={handleCopy}
          className={cn('copy-button', copied && 'copied')}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function TextBlock({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none prose-chat',
        isStreaming && 'typing-cursor'
      )}
    >
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match[1]}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="thinking-block">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="thinking-block-header"
      >
        <Sparkles className="h-4 w-4" />
        <span>思考中...</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {isExpanded && (
        <div className="thinking-block-content whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

function ToolUseBlock({ toolUse, isExecuting }: { toolUse: ToolUse; isExecuting?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = toolIcons[toolUse.name] || Code;

  return (
    <div className="flex flex-col max-w-full overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors max-w-full",
          isExecuting
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
        )}
      >
        {isExecuting ? (
          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
        ) : (
          <Icon className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">{toolUse.name}</span>
        <span className={cn(
          "truncate min-w-0",
          isExecuting ? "text-amber-500/70" : "text-blue-500/70"
        )}>
          {getToolSummary(toolUse)}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 overflow-x-auto">
          <pre className="text-xs bg-muted p-2 rounded whitespace-pre w-fit min-w-full">
            {JSON.stringify(toolUse.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultBlock({ toolResult }: { toolResult: ToolResult }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col max-w-full overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
          toolResult.isError
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
            : 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
        )}
      >
        {toolResult.isError ? (
          <XCircle className="h-3 w-3 flex-shrink-0" />
        ) : (
          <CheckCircle className="h-3 w-3 flex-shrink-0" />
        )}
        <span>{toolResult.isError ? '执行失败' : '执行成功'}</span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 overflow-x-auto">
          <pre
            className={cn(
              'text-xs p-2 rounded max-h-60 whitespace-pre w-fit min-w-full',
              toolResult.isError ? 'bg-destructive/10' : 'bg-muted'
            )}
          >
            {toolResult.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function getToolSummary(toolUse: ToolUse): string {
  const input = toolUse.input;

  switch (toolUse.name) {
    case 'Read':
      return (input.file_path as string) || '';
    case 'Write':
    case 'Edit':
      return (input.file_path as string) || '';
    case 'Bash':
      return ((input.command as string) || '').substring(0, 50);
    case 'Glob':
      return (input.pattern as string) || '';
    case 'Grep':
      return (input.pattern as string) || '';
    default:
      return '';
  }
}
