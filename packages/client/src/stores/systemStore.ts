import { create } from 'zustand';
import { SystemConfig, OperationMode } from '@claude-web/shared';
import { getSystemConfig } from '@/lib/api';

interface SystemState {
  config: SystemConfig | null;
  isLoading: boolean;
  error: string | null;

  fetchConfig: () => Promise<void>;
  getOperationMode: () => OperationMode;
  isToolEnabled: (toolName: string) => boolean;
}

export const useSystemStore = create<SystemState>()((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await getSystemConfig();
      set({ config, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取系统配置失败',
        isLoading: false,
      });
    }
  },

  getOperationMode: () => {
    return get().config?.operationMode || 'full';
  },

  isToolEnabled: (toolName: string) => {
    const { config } = get();
    if (!config) return false; // 配置未加载时默认禁止（安全原则）
    return config.enabledTools.includes(toolName);
  },
}));
