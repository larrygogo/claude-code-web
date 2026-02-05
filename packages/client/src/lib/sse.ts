import {
  SSEEvent,
  SSEEventType,
  SSEInitData,
  SSETextDelta,
  SSEThinkingDelta,
  SSEToolUse,
  SSEToolResult,
  SSEError,
  SSEDone,
  ChatRequest,
} from '@claude-web/shared';
import { apiClient } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type SSEEventHandler = {
  onInit?: (data: SSEInitData) => void;
  onTextDelta?: (data: SSETextDelta) => void;
  onThinkingDelta?: (data: SSEThinkingDelta) => void;
  onToolUse?: (data: SSEToolUse) => void;
  onToolResult?: (data: SSEToolResult) => void;
  onError?: (data: SSEError) => void;
  onDone?: (data: SSEDone) => void;
};

export async function streamChat(
  request: ChatRequest,
  handlers: SSEEventHandler,
  abortSignal?: AbortSignal
): Promise<void> {
  const token = apiClient.getAccessToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal: abortSignal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Stream request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
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
            handleEvent(event.type, event.data, handlers);
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
          currentEventType = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function handleEvent(type: SSEEventType, data: unknown, handlers: SSEEventHandler): void {
  switch (type) {
    case 'init':
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
    case 'error':
      handlers.onError?.(data as SSEError);
      break;
    case 'done':
      handlers.onDone?.(data as SSEDone);
      break;
  }
}
