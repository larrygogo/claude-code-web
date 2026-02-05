'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, ContentBlock, ToolUse, ToolResult } from '@claude-web/shared';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  User,
  Bot,
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
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  streamingText?: string;
  streamingThinking?: string;
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
  streamingText,
  streamingThinking,
}: MessageItemProps) {
  const isUser = message.role === 'user';

  const content = isStreaming
    ? buildStreamingContent(message.content, streamingText, streamingThinking)
    : message.content;

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'bg-background' : 'bg-muted/30'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? 'bg-primary' : 'bg-orange-500')}>
          {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-white" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="text-sm font-medium">{isUser ? '你' : 'Claude'}</div>
        <div className="space-y-3">
          {content.map((block, index) => (
            <ContentBlockRenderer key={index} block={block} isStreaming={isStreaming && index === content.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function buildStreamingContent(
  existingContent: ContentBlock[],
  streamingText?: string,
  streamingThinking?: string
): ContentBlock[] {
  const content = [...existingContent];

  if (streamingThinking) {
    const lastThinking = content.findIndex(b => b.type === 'thinking');
    if (lastThinking >= 0) {
      content[lastThinking] = { type: 'thinking', content: streamingThinking };
    } else {
      content.push({ type: 'thinking', content: streamingThinking });
    }
  }

  if (streamingText) {
    const lastText = content.findIndex(b => b.type === 'text');
    if (lastText >= 0) {
      content[lastText] = { type: 'text', content: streamingText };
    } else {
      content.push({ type: 'text', content: streamingText });
    }
  }

  return content;
}

function ContentBlockRenderer({ block, isStreaming }: { block: ContentBlock; isStreaming?: boolean }) {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content} isStreaming={isStreaming} />;
    case 'thinking':
      return <ThinkingBlock content={block.content} />;
    case 'tool_use':
      return <ToolUseBlock toolUse={block.toolUse} />;
    case 'tool_result':
      return <ToolResultBlock toolResult={block.toolResult} />;
    default:
      return null;
  }
}

function TextBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', isStreaming && 'typing-cursor')}>
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-md text-sm"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
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
    <div className="border rounded-md bg-muted/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-foreground"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>思考过程</span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

function ToolUseBlock({ toolUse }: { toolUse: ToolUse }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = toolIcons[toolUse.name] || Code;

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full p-2 text-sm hover:bg-muted/50"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{toolUse.name}</span>
        <span className="text-muted-foreground truncate">
          {getToolSummary(toolUse)}
        </span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-3">
          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
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
    <div className={cn('border rounded-md', toolResult.isError && 'border-destructive/50')}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full p-2 text-sm hover:bg-muted/50"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {toolResult.isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        <span className="text-muted-foreground">
          {toolResult.isError ? '执行失败' : '执行成功'}
        </span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-3">
          <pre className={cn(
            'text-xs p-2 rounded overflow-x-auto max-h-60',
            toolResult.isError ? 'bg-destructive/10' : 'bg-muted'
          )}>
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
      return input.file_path as string || '';
    case 'Write':
    case 'Edit':
      return input.file_path as string || '';
    case 'Bash':
      return (input.command as string || '').substring(0, 50);
    case 'Glob':
      return input.pattern as string || '';
    case 'Grep':
      return input.pattern as string || '';
    default:
      return '';
  }
}
