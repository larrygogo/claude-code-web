import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Send, Square, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatAttachment, Skill } from '@claude-web/shared';
import { CommandPalette, getFilteredSkills } from './CommandPalette';
import { getSkills } from '@/lib/api';

// 文件类型和大小限制
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_DOC_TYPES = ['application/pdf'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_DOC_SIZE = 10 * 1024 * 1024;    // 10MB
const MAX_FILES = 10;

// 将文件转换为 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 "data:xxx;base64," 前缀
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface InputAreaProps {
  projectId?: string;
  onSuggestionClick?: (text: string) => void;
}

export function InputArea({ projectId, onSuggestionClick }: InputAreaProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, abortStreaming, streamingSessionId, currentSession } = useChatStore();
  const { tokens } = useAuthStore();
  const accessToken = tokens?.accessToken;
  const isMobile = useIsMobile();

  // 加载 skills
  useEffect(() => {
    if (accessToken) {
      getSkills().then(setSkills).catch(console.error);
    }
  }, [accessToken]);

  // 只有当前会话正在流式传输时才禁用输入
  const isStreaming = streamingSessionId !== null && streamingSessionId === currentSession?.id;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Allow parent to set input via suggestion click
  useEffect(() => {
    if (onSuggestionClick) {
      // This is a no-op, just to ensure the prop is used for typing
    }
  }, [onSuggestionClick]);

  // 处理文件的核心函数
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) return;

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newAttachments: ChatAttachment[] = [];

    for (const file of filesToProcess) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        console.warn(`文件类型不支持: ${file.type}`);
        continue;
      }

      const maxSize = file.type.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
      if (file.size > maxSize) {
        console.warn(`文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      try {
        const data = await fileToBase64(file);
        newAttachments.push({
          name: file.name,
          mediaType: file.type,
          data,
          size: file.size,
        });
      } catch (error) {
        console.error(`处理文件失败: ${file.name}`, error);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  }, [attachments.length]);

  // 移除附件
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 点击附件按钮
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // 文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
      e.target.value = ''; // 重置，允许再次选择相同文件
    }
  };

  // 拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  };

  // 粘贴事件
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleSubmit = async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || !accessToken) return;

    // 仅有附件无文本时使用默认文本
    const message = input.trim() || '请分析这些文件';
    setInput('');
    const currentAttachments = attachments;
    setAttachments([]);

    await sendMessage(message, projectId, accessToken, currentAttachments.length > 0 ? currentAttachments : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果命令面板打开，处理键盘导航
    if (showCommandPalette) {
      const filteredSkills = getFilteredSkills(skills, commandFilter);

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.min(i + 1, filteredSkills.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.max(i - 1, 0));
        return;
      }

      // 回车键选中命令，而不是发送
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (filteredSkills.length > 0 && filteredSkills[selectedCommandIndex]) {
          handleSelectCommand(filteredSkills[selectedCommandIndex]);
        }
        return;
      }
    }

    // 命令面板未打开时，回车发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 监控输入变化，检测 / 命令
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // 检查是否以 / 开头
    if (value.startsWith('/')) {
      const match = value.match(/^\/([a-z0-9-]*)$/i);
      if (match) {
        const newFilter = match[1];
        // 如果 filter 变化，重置选中索引
        if (newFilter !== commandFilter) {
          setSelectedCommandIndex(0);
        }
        setCommandFilter(newFilter);
        setShowCommandPalette(true);
      } else if (value.includes(' ')) {
        // 如果有空格，说明命令已输入完成，关闭面板
        setShowCommandPalette(false);
      }
    } else {
      setShowCommandPalette(false);
    }
  };

  // 选择命令
  const handleSelectCommand = (skill: Skill) => {
    setInput(`/${skill.name} `);
    setShowCommandPalette(false);
    setSelectedCommandIndex(0);
    textareaRef.current?.focus();
  };

  // Expose setInput for parent component
  const fillInput = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  // Attach to window for parent access (simple approach)
  useEffect(() => {
    (window as unknown as { fillChatInput?: (text: string) => void }).fillChatInput = fillInput;
    return () => {
      delete (window as unknown as { fillChatInput?: (text: string) => void }).fillChatInput;
    };
  }, []);

  return (
    <div className="bg-background p-4 mobile-safe-bottom">
      <div className="max-w-3xl mx-auto">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Input container with capsule style */}
        <div
          className={cn(
            'relative rounded-2xl border bg-background shadow-sm',
            'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            'transition-shadow',
            isDragOver && 'ring-2 ring-primary ring-offset-2 border-primary'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Attachments preview area */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
              {attachments.map((att, index) => (
                <div
                  key={`${att.name}-${index}`}
                  className="relative group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 border text-xs"
                >
                  {att.mediaType.startsWith('image/') ? (
                    <>
                      <img
                        src={`data:${att.mediaType};base64,${att.data}`}
                        alt={att.name}
                        className="h-8 w-8 object-cover rounded"
                      />
                      <span className="max-w-[100px] truncate">{att.name}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="max-w-[100px] truncate">{att.name}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                    title="移除"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="flex items-end">
            {/* Attachment button */}
            <div className="pl-2 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleAttachClick}
                disabled={isStreaming || attachments.length >= MAX_FILES}
                className="h-8 w-8 rounded-full"
                title={`添加附件 (${attachments.length}/${MAX_FILES})`}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 relative">
              {/* Command Palette */}
              <CommandPalette
                isOpen={showCommandPalette}
                filter={commandFilter}
                skills={skills}
                selectedIndex={selectedCommandIndex}
                onSelectedIndexChange={setSelectedCommandIndex}
                onSelect={handleSelectCommand}
                onClose={() => {
                  setShowCommandPalette(false);
                  setSelectedCommandIndex(0);
                }}
                position="top"
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="给 Claude 发送消息... (输入 / 查看命令)"
                disabled={isStreaming}
                rows={1}
                className={cn(
                  'w-full resize-none bg-transparent px-2 py-3 pr-12 text-sm',
                  'placeholder:text-muted-foreground',
                  'focus:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'min-h-[48px] max-h-[200px]'
                )}
              />
            </div>

            {/* Send/Stop button */}
            <div className="pr-2 pb-2">
              {isStreaming ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={abortStreaming}
                  className="h-8 w-8 rounded-full"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={(!input.trim() && attachments.length === 0) || !accessToken}
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-primary/10 rounded-2xl flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 text-primary font-medium">
                <ImageIcon className="h-5 w-5" />
                <span>放开以添加文件</span>
              </div>
            </div>
          )}
        </div>

        {/* Hint text - only show on desktop, but keep spacing on mobile */}
        {isMobile ? (
          <div className="h-2" />
        ) : (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enter 发送，Shift+Enter 换行 | 支持拖拽或 Ctrl+V 粘贴图片/PDF
          </p>
        )}
      </div>
    </div>
  );
}
