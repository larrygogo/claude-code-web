import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  ContentBlock,
  SSEEvent,
  SSEEventType,
  SSEInitData,
  SSETextDelta,
  SSEThinkingDelta,
  SSEToolUse,
  SSEToolResult,
  SSETitleUpdate,
  SSEError,
  SSEDone,
  ChatRequest,
  ToolUseBlock,
  ToolResultBlock,
  ThinkingBlock,
} from '@claude-web/shared';
import { sessionStorage } from '../storage/SessionStorage.js';
import { sessionService } from './SessionService.js';
import { projectService } from './ProjectService.js';
import { adminService } from './AdminService.js';
import { config } from '../config.js';
import { executeTool, getToolDefinitions } from '../tools/index.js';

type PermissionMode = 'plan' | 'acceptEdits' | 'default';

interface AgentSession {
  sessionId: string;
  userId: string;
  projectId?: string;
  workingDir: string;
  permissionMode: PermissionMode;
  abortController: AbortController;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

const activeSessions = new Map<string, AgentSession>();

// 最大工具调用轮次，防止无限循环
const MAX_TOOL_ITERATIONS = 20;

export class AgentService {
  private defaultBaseUrl: string;
  private defaultApiKey: string;
  private defaultModel: string;

  constructor() {
    this.defaultBaseUrl = config.anthropic.baseUrl || 'https://api.anthropic.com';
    this.defaultApiKey = config.anthropic.apiKey;
    this.defaultModel = config.anthropic.model;
  }

  /**
   * 获取模型配置（优先从数据库，回退到环境变量）
   */
  private async getModelConfig(): Promise<{ baseUrl: string; apiKey: string; model: string }> {
    try {
      const dbConfig = await adminService.getActiveModelConfig();
      if (dbConfig && dbConfig.apiKey) {
        return {
          baseUrl: dbConfig.apiEndpoint || this.defaultBaseUrl,
          apiKey: dbConfig.apiKey,
          model: dbConfig.modelId,
        };
      }
    } catch (error) {
      console.warn('[AgentService] Failed to get model config from database, using env fallback:', error);
    }

    // 回退到环境变量配置
    return {
      baseUrl: this.defaultBaseUrl,
      apiKey: this.defaultApiKey,
      model: this.defaultModel,
    };
  }

  async streamChat(
    userId: string,
    request: ChatRequest,
    res: Response,
    onSessionCreated?: (sessionId: string) => void
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let sessionId = request.sessionId;
    let sessionTitle: string | undefined;
    let isNewSession = false;
    const userMessageText = request.message;

    if (!sessionId) {
      const title = this.generateTitle(request.message);
      const session = await sessionService.createSession(userId, {
        projectId: request.projectId,
        title,
      });
      sessionId = session.id;
      sessionTitle = title;
      isNewSession = true;
    } else {
      // 已有会话，检查是否需要自动生成标题（标题仍为默认值时）
      try {
        const existingSession = await sessionService.getSession(userId, sessionId);
        if (existingSession.title === 'New Chat') {
          sessionTitle = this.generateTitle(request.message);
          await sessionService.updateSessionTitle(userId, sessionId, sessionTitle);
          isNewSession = true;
        }
      } catch {
        // 忽略标题更新失败
      }
    }

    onSessionCreated?.(sessionId);

    const messageId = uuidv4();
    const abortController = new AbortController();

    // 获取工作目录
    let workingDir = process.cwd();
    if (request.projectId) {
      try {
        const project = await projectService.getProject(userId, request.projectId);
        if (project.path) {
          workingDir = project.path;
        }
      } catch {
        console.warn('[AgentService] Could not get project path, using cwd');
      }
    }

    const agentSession: AgentSession = {
      sessionId,
      userId,
      projectId: request.projectId,
      workingDir,
      permissionMode: request.permissionMode || 'default',
      abortController,
    };

    activeSessions.set(sessionId, agentSession);

    this.sendEvent(res, 'init', {
      sessionId,
      messageId,
      title: sessionTitle,
    } as SSEInitData);

    const userMessage: Message = {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: [{ type: 'text', content: request.message }],
      createdAt: new Date(),
    };

    await sessionStorage.appendMessage(userId, sessionId, userMessage);

    try {
      console.log('[AgentService] Processing message for session:', sessionId);
      console.log('[AgentService] Working directory:', workingDir);

      let systemPrompt = this.buildSystemPrompt(workingDir);

      if (request.projectId) {
        const context = await projectService.getProjectContext(userId, request.projectId);
        if (context.claudeMd) {
          systemPrompt += `\n\n## 项目说明 (CLAUDE.md)\n\n${context.claudeMd}`;
        }
      }

      const previousMessages = await sessionStorage.getMessages(userId, sessionId);

      await this.runAgentLoop(
        res,
        agentSession,
        messageId,
        systemPrompt,
        previousMessages
      );
    } catch (error) {
      console.error('Agent error:', error);
      this.sendEvent(res, 'error', {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as SSEError);
    } finally {
      // 新建会话时，在 res.end() 之前异步生成 AI 标题
      if (isNewSession && sessionId) {
        try {
          const aiTitle = await this.generateTitleWithAI(userMessageText);
          if (aiTitle) {
            await sessionService.updateSessionTitle(userId, sessionId, aiTitle);
            this.sendEvent(res, 'title_update', {
              sessionId,
              title: aiTitle,
            } as SSETitleUpdate);
          }
        } catch (error) {
          console.warn('[AgentService] AI title generation failed, keeping fallback title:', error);
        }
      }
      activeSessions.delete(sessionId);
      res.end();
    }
  }

  async abortSession(sessionId: string): Promise<boolean> {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(workingDir: string): string {
    return `你是 Claude，一个有帮助的 AI 助手。

## 工具能力

你可以使用以下工具来帮助用户完成任务：

1. **Read** - 读取文件内容
2. **Write** - 写入文件
3. **Edit** - 编辑文件（查找替换）
4. **Bash** - 执行 shell 命令
5. **Glob** - 查找匹配模式的文件
6. **Grep** - 在文件中搜索内容
7. **WebFetch** - 抓取网页内容

## 工作目录

当前工作目录: ${workingDir}

所有文件操作都相对于此目录。你可以使用相对路径或绝对路径。

## 使用指南

- 在修改文件之前，先使用 Read 工具查看文件内容
- 使用 Glob 查找文件，使用 Grep 搜索代码
- 对于简单修改使用 Edit，对于创建新文件或大量修改使用 Write
- 使用 Bash 运行命令、测试、构建等操作
- 每次只执行一个工具调用，等待结果后再决定下一步

## 注意事项

- 文件操作限制在工作目录内
- 执行危险命令前请谨慎
- 保持输出简洁清晰`;
  }

  /**
   * 运行 Agent 循环 - 处理工具调用直到完成
   */
  private async runAgentLoop(
    res: Response,
    agentSession: AgentSession,
    messageId: string,
    systemPrompt: string,
    previousMessages: Message[]
  ): Promise<void> {
    const allContentBlocks: ContentBlock[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let model = config.anthropic.model;
    let stopReason = 'end_turn';

    // 构建初始消息历史
    const messages = this.convertToClaudeMessages(previousMessages);

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (agentSession.abortController.signal.aborted) {
        stopReason = 'aborted';
        break;
      }

      console.log(`[AgentService] Iteration ${iteration + 1}`);

      // 调用 Claude API
      const result = await this.callClaudeAPI(
        res,
        agentSession,
        systemPrompt,
        messages
      );

      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      model = result.model;
      stopReason = result.stopReason;

      // 收集内容块
      for (const block of result.contentBlocks) {
        allContentBlocks.push(block);
      }

      // 如果没有工具调用或被中止，结束循环
      if (result.stopReason !== 'tool_use' || result.toolUses.length === 0) {
        break;
      }

      // 将助手消息添加到历史
      messages.push({
        role: 'assistant',
        content: result.rawContent,
      });

      // 执行工具调用并收集结果
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const toolUse of result.toolUses) {
        if (agentSession.abortController.signal.aborted) {
          break;
        }

        // 执行工具
        console.log(`[AgentService] Executing tool: ${toolUse.name}`);

        let toolResult: { content: string; isError?: boolean };
        try {
          toolResult = await executeTool(
            toolUse.name,
            toolUse.input,
            agentSession.workingDir
          );
        } catch (error) {
          console.error(`[AgentService] Tool execution error for ${toolUse.name}:`, error);
          toolResult = {
            content: `工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
            isError: true,
          };
        }

        // 发送工具结果事件
        this.sendEvent(res, 'tool_result', {
          toolUseId: toolUse.id,
          content: toolResult.content,
          isError: toolResult.isError,
        } as SSEToolResult);

        // 添加工具结果到内容块
        const resultBlock: ToolResultBlock = {
          type: 'tool_result',
          toolResult: {
            toolUseId: toolUse.id,
            content: toolResult.content,
            isError: toolResult.isError,
          },
        };
        allContentBlocks.push(resultBlock);

        // 收集工具结果用于下一次 API 调用
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult.content,
          is_error: toolResult.isError,
        });
      }

      // 将工具结果添加到消息历史
      messages.push({
        role: 'user',
        content: toolResults as unknown as ClaudeContentBlock[],
      });

      // 达到最大迭代次数警告
      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        console.warn(`[AgentService] Reached MAX_TOOL_ITERATIONS (${MAX_TOOL_ITERATIONS}) for session ${agentSession.sessionId}`);
        this.sendEvent(res, 'error', {
          code: 'MAX_ITERATIONS',
          message: `已达到最大工具调用次数限制 (${MAX_TOOL_ITERATIONS})，处理已停止`,
        } as SSEError);
        stopReason = 'max_iterations';
      }
    }

    // 保存完整的助手消息
    const assistantMessage: Message = {
      id: messageId,
      sessionId: agentSession.sessionId,
      role: 'assistant',
      content: allContentBlocks,
      createdAt: new Date(),
      model,
      stopReason,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };

    await sessionStorage.appendMessage(
      agentSession.userId,
      agentSession.sessionId,
      assistantMessage
    );

    await sessionService.touchSession(agentSession.sessionId);

    this.sendEvent(res, 'done', {
      messageId,
      stopReason,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    } as SSEDone);
  }

  /**
   * 调用 Claude API（单次）
   */
  private async callClaudeAPI(
    res: Response,
    agentSession: AgentSession,
    systemPrompt: string,
    messages: ClaudeMessage[]
  ): Promise<{
    contentBlocks: ContentBlock[];
    rawContent: ClaudeContentBlock[];
    toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
    stopReason: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }> {
    const contentBlocks: ContentBlock[] = [];
    const rawContent: ClaudeContentBlock[] = [];
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let stopReason = 'end_turn';
    let inputTokens = 0;
    let outputTokens = 0;

    // 获取模型配置（优先从数据库）
    const modelConfig = await this.getModelConfig();
    let model = modelConfig.model;

    // 当前文本块的累积内容
    let currentTextContent = '';
    // 当前工具调用的输入 JSON 字符串
    let currentToolInput = '';
    let currentToolId = '';
    let currentToolName = '';
    // 当前思考块的累积内容
    let currentThinkingContent = '';
    let isInThinkingBlock = false;

    // 判断是否需要启用 thinking
    const needsThinking = this.shouldUseThinking(messages);

    try {
      // 构建请求 body
      const requestBody: Record<string, unknown> = {
        model: modelConfig.model,
        max_tokens: needsThinking ? 16000 : 8192,
        system: systemPrompt,
        messages: messages,
        tools: getToolDefinitions(),
        stream: true,
      };

      // 启用 thinking 时添加 thinking 参数
      if (needsThinking) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: 5000,
        };
      }

      const response = await fetch(`${modelConfig.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': modelConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: agentSession.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'message_start') {
                model = event.message?.model || model;
                inputTokens = event.message?.usage?.input_tokens || 0;
              } else if (event.type === 'content_block_start') {
                const block = event.content_block;
                if (block?.type === 'text') {
                  currentTextContent = '';
                } else if (block?.type === 'thinking') {
                  // 开始思考块
                  currentThinkingContent = '';
                  isInThinkingBlock = true;
                  console.log('[AgentService] Starting thinking block');
                } else if (block?.type === 'tool_use') {
                  currentToolId = block.id || '';
                  currentToolName = block.name || '';
                  currentToolInput = '';

                  // 发送工具调用开始事件
                  this.sendEvent(res, 'tool_use', {
                    id: currentToolId,
                    name: currentToolName,
                    input: {},
                  } as SSEToolUse);
                }
              } else if (event.type === 'content_block_delta') {
                const delta = event.delta;
                if (delta?.type === 'text_delta' && delta.text) {
                  currentTextContent += delta.text;
                  this.sendEvent(res, 'text_delta', {
                    content: delta.text,
                  } as SSETextDelta);
                } else if (delta?.type === 'thinking_delta' && delta.thinking) {
                  // 处理思考内容增量
                  currentThinkingContent += delta.thinking;
                  this.sendEvent(res, 'thinking_delta', {
                    content: delta.thinking,
                  } as SSEThinkingDelta);
                } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
                  currentToolInput += delta.partial_json;
                }
              } else if (event.type === 'content_block_stop') {
                // 完成当前内容块
                if (isInThinkingBlock && currentThinkingContent) {
                  // 完成思考块
                  const thinkingBlock: ThinkingBlock = {
                    type: 'thinking',
                    content: currentThinkingContent,
                  };
                  contentBlocks.push(thinkingBlock);
                  // 注意：rawContent 不包含 thinking block，因为它用于发送回 API 的历史消息
                  // Claude API 不接受 thinking 作为输入消息
                  currentThinkingContent = '';
                  isInThinkingBlock = false;
                  console.log('[AgentService] Completed thinking block');
                }

                if (currentTextContent) {
                  contentBlocks.push({ type: 'text', content: currentTextContent });
                  rawContent.push({ type: 'text', text: currentTextContent });
                  currentTextContent = '';
                }

                if (currentToolId && currentToolName) {
                  // 解析工具输入
                  let parsedInput: Record<string, unknown> = {};
                  try {
                    if (currentToolInput) {
                      parsedInput = JSON.parse(currentToolInput);
                    }
                  } catch (e) {
                    console.error('Failed to parse tool input:', currentToolInput);
                  }

                  // 添加工具调用
                  const toolUseBlock: ToolUseBlock = {
                    type: 'tool_use',
                    toolUse: {
                      id: currentToolId,
                      name: currentToolName,
                      input: parsedInput,
                    },
                  };
                  contentBlocks.push(toolUseBlock);
                  rawContent.push({
                    type: 'tool_use',
                    id: currentToolId,
                    name: currentToolName,
                    input: parsedInput,
                  });
                  toolUses.push({
                    id: currentToolId,
                    name: currentToolName,
                    input: parsedInput,
                  });

                  // 发送完整的工具调用事件（带输入）
                  this.sendEvent(res, 'tool_use', {
                    id: currentToolId,
                    name: currentToolName,
                    input: parsedInput,
                  } as SSEToolUse);

                  currentToolId = '';
                  currentToolName = '';
                  currentToolInput = '';
                }
              } else if (event.type === 'message_delta') {
                outputTokens = event.usage?.output_tokens || outputTokens;
                stopReason = event.delta?.stop_reason || stopReason;
              } else if (event.type === 'error') {
                // 处理 Claude API 流式错误事件
                const errorMsg = event.error?.message || 'Unknown API error';
                console.error('[AgentService] Claude API stream error:', event.error);
                throw new Error(`Claude API error: ${errorMsg}`);
              }
            } catch (parseError) {
              // 如果是我们主动抛出的错误，继续向上抛出
              if (parseError instanceof Error && parseError.message.startsWith('Claude API error:')) {
                throw parseError;
              }
              // Ignore parse errors for ping events etc
            }
          }
        }
      }

      return {
        contentBlocks,
        rawContent,
        toolUses,
        stopReason,
        inputTokens,
        outputTokens,
        model,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 保存已有的文本内容
        if (currentTextContent) {
          contentBlocks.push({ type: 'text', content: currentTextContent });
        }
        return {
          contentBlocks,
          rawContent,
          toolUses: [],
          stopReason: 'aborted',
          inputTokens,
          outputTokens,
          model,
        };
      }
      throw error;
    }
  }

  private convertToClaudeMessages(messages: Message[]): ClaudeMessage[] {
    const result: ClaudeMessage[] = [];

    for (const m of messages) {
      if (m.role !== 'user' && m.role !== 'assistant') continue;

      let content: ClaudeContentBlock[] = [];

      for (const block of m.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.content });
        } else if (block.type === 'tool_use') {
          content.push({
            type: 'tool_use',
            id: block.toolUse.id,
            name: block.toolUse.name,
            input: block.toolUse.input,
          });
        } else if (block.type === 'tool_result') {
          // tool_result 需要作为单独的 user 消息
          if (content.length > 0) {
            result.push({ role: m.role as 'user' | 'assistant', content });
            content = [];  // 创建新数组，不影响已 push 的引用
          }
          result.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: block.toolResult.toolUseId,
              content: block.toolResult.content,
              is_error: block.toolResult.isError,
            }] as unknown as ClaudeContentBlock[],
          });
          continue;
        }
      }

      if (content.length > 0) {
        // 如果只有文本，可以简化为字符串
        if (content.length === 1 && content[0].type === 'text') {
          result.push({ role: m.role as 'user' | 'assistant', content: content[0].text || '' });
        } else {
          result.push({ role: m.role as 'user' | 'assistant', content });
        }
      }
    }

    // 过滤空消息
    return result.filter(m => {
      if (typeof m.content === 'string') return m.content.trim() !== '';
      return m.content.length > 0;
    });
  }

  private sendEvent<T>(res: Response, type: SSEEventType, data: T): void {
    const event: SSEEvent<T> = {
      type,
      data,
      timestamp: Date.now(),
    };

    const message = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
    res.write(message);
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
      (res as unknown as { flush: () => void }).flush();
    }
  }

  private generateTitle(message: string): string {
    const maxLength = 50;
    const trimmed = message.trim().replace(/\n/g, ' ');

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return trimmed.substring(0, maxLength - 3) + '...';
  }

  /**
   * 使用 AI 生成会话标题
   * 带 8 秒超时，失败时返回 null（保留原标题）
   */
  private async generateTitleWithAI(message: string): Promise<string | null> {
    const modelConfig = await this.getModelConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${modelConfig.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': modelConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelConfig.model,
          max_tokens: 50,
          stream: false,
          system: '你是标题生成器。根据用户的消息生成一个简洁的会话标题。要求：2-20个字，不加标点符号，不加引号，不加前缀，直接输出标题文本。',
          messages: [
            { role: 'user', content: message },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn('[AgentService] AI title API returned:', response.status);
        return null;
      }

      const data = await response.json() as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.[0]?.text?.trim();

      if (text && text.length >= 2 && text.length <= 30) {
        // 去除可能的引号和标点
        const cleaned = text.replace(/^["'"'「『]+|["'"'」』。，！？.!?,]+$/g, '');
        console.log(`[AgentService] AI generated title: "${cleaned}"`);
        return cleaned || null;
      }

      return null;
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        console.warn('[AgentService] AI title generation timed out');
      } else {
        console.warn('[AgentService] AI title generation error:', error);
      }
      return null;
    }
  }

  /**
   * 判断是否应该启用 extended thinking
   * 根据用户消息的复杂度自动决定
   */
  private shouldUseThinking(messages: ClaudeMessage[]): boolean {
    // 获取最后一条用户消息
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return false;

    // 提取文本内容
    let text = '';
    if (typeof lastUserMessage.content === 'string') {
      text = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage.content)) {
      for (const block of lastUserMessage.content) {
        if (block.type === 'text' && block.text) {
          text += block.text + ' ';
        }
      }
    }
    text = text.trim().toLowerCase();

    // 条件1: 消息长度 > 100 字符
    if (text.length > 100) {
      console.log('[AgentService] Enabling thinking: message length > 100');
      return true;
    }

    // 条件2: 包含代码关键词
    const codeKeywords = [
      'debug', '调试', '实现', 'implement', '分析', 'analyze', 'analysis',
      '优化', 'optimize', 'optimization', '重构', 'refactor',
      'bug', 'error', '错误', '报错', '异常',
      '解释', 'explain', '为什么', 'why', 'how', '怎么', '如何',
      '代码', 'code', '函数', 'function', '算法', 'algorithm',
      '设计', 'design', '架构', 'architecture',
      '性能', 'performance', '复杂', 'complex'
    ];

    for (const keyword of codeKeywords) {
      if (text.includes(keyword)) {
        console.log(`[AgentService] Enabling thinking: found keyword "${keyword}"`);
        return true;
      }
    }

    // 条件3: 包含代码块
    if (text.includes('```') || text.includes('`')) {
      console.log('[AgentService] Enabling thinking: contains code block');
      return true;
    }

    console.log('[AgentService] Not using thinking: simple message');
    return false;
  }
}

export const agentService = new AgentService();
