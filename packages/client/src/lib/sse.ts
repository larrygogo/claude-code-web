import {
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
} from '@claude-web/shared';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 按会话管理 AbortController，支持多会话并发
const abortControllers = new Map<string, AbortController>();

/**
 * 中止指定会话的流
 */
export function abortStream(sessionId: string): void {
  const controller = abortControllers.get(sessionId);
  if (controller) {
    controller.abort();
    abortControllers.delete(sessionId);
  }
}

/**
 * 兼容旧接口：中止所有流
 */
export function abortCurrentStream(): void {
  for (const [sessionId, controller] of abortControllers) {
    controller.abort();
  }
  abortControllers.clear();
}

export type SSEEventHandler = {
  onInit?: (data: SSEInitData) => void;
  onTextDelta?: (data: SSETextDelta) => void;
  onThinkingDelta?: (data: SSEThinkingDelta) => void;
  onToolUse?: (data: SSEToolUse) => void;
  onToolResult?: (data: SSEToolResult) => void;
  onTitleUpdate?: (data: SSETitleUpdate) => void;
  onError?: (data: SSEError) => void;
  onDone?: (data: SSEDone) => void;
};

export async function streamChat(
  request: ChatRequest,
  handlers: SSEEventHandler,
  token: string
): Promise<void> {
  if (!token) {
    throw new Error('Not authenticated');
  }

  // 为此次流创建 AbortController
  const abortController = new AbortController();
  const signal = abortController.signal;

  // 如果有 sessionId，按会话管理；否则用临时 key
  const streamKey = request.sessionId || `temp-${Date.now()}`;
  // 先中止该会话之前的流（如果有）
  abortStream(streamKey);
  abortControllers.set(streamKey, abortController);

  const response = await window.fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    // Note: NOT passing signal here to avoid premature abort
  });

  if (!response.ok) {
    abortControllers.delete(streamKey);
    const error = await response.json();
    throw new Error(error.error?.message || 'Stream request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    abortControllers.delete(streamKey);
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  // 跟踪实际的 sessionId（可能在 init 事件中更新）
  let actualSessionId = streamKey;

  try {
    while (true) {
      // Check if manually aborted
      if (signal.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEventType: SSEEventType | null = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim() as SSEEventType;
        } else if (line.startsWith('data: ') && currentEventType) {
          const dataStr = line.substring(6);
          try {
            const event: SSEEvent = JSON.parse(dataStr);

            // 如果是 init 事件，更新 sessionId 映射
            if (event.type === 'init' && (event.data as SSEInitData).sessionId) {
              const newSessionId = (event.data as SSEInitData).sessionId;
              if (newSessionId !== streamKey) {
                abortControllers.delete(streamKey);
                abortControllers.set(newSessionId, abortController);
                actualSessionId = newSessionId;
              }
            }

            handleEvent(event.type, event.data, handlers);
          } catch (e) {
            console.error('[SSE] Failed to parse SSE data:', e);
          }
          currentEventType = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
    abortControllers.delete(actualSessionId);
    // 也清理原始 key（以防不同）
    if (actualSessionId !== streamKey) {
      abortControllers.delete(streamKey);
    }
  }
}

function handleEvent(type: SSEEventType, data: unknown, handlers: SSEEventHandler): void {
  console.log('[SSE] Event received:', type);
  switch (type) {
    case 'init':
      console.log('[SSE] Init data:', data);
      handlers.onInit?.(data as SSEInitData);
      break;
    case 'text_delta':
      handlers.onTextDelta?.(data as SSETextDelta);
      break;
    case 'thinking_delta':
      handlers.onThinkingDelta?.(data as SSEThinkingDelta);
      break;
    case 'tool_use':
      handlers.onToolUse?.(data as SSEToolUse);
      break;
    case 'tool_result':
      handlers.onToolResult?.(data as SSEToolResult);
      break;
    case 'title_update':
      console.log('[SSE] Title update:', data);
      handlers.onTitleUpdate?.(data as SSETitleUpdate);
      break;
    case 'error':
      console.log('[SSE] Error:', data);
      handlers.onError?.(data as SSEError);
      break;
    case 'done':
      console.log('[SSE] Done:', data);
      handlers.onDone?.(data as SSEDone);
      break;
  }
}
