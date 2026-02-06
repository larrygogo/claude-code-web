import { create } from 'zustand';
import {
  SystemStatus,
  SetupModelInput,
  SetupAdminInput,
  SetupFeaturesInput,
  AuthResponse,
} from '@claude-web/shared';
import { apiClient } from '@/lib/api';

interface SetupState {
  // 状态
  systemStatus: SystemStatus | null;
  isLoading: boolean;
  error: string | null;

  // 当前初始化步骤
  currentStep: number;

  // 初始化数据（本地存储）
  modelConfig: SetupModelInput | null;
  adminConfig: SetupAdminInput | null;
  featuresConfig: SetupFeaturesInput | null;

  // 操作
  checkSystemStatus: () => Promise<SystemStatus>;
  setupModel: (input: SetupModelInput) => void;
  setupAdmin: (input: SetupAdminInput) => void;
  setupFeatures: (input: SetupFeaturesInput) => void;
  completeSetup: () => Promise<AuthResponse | null>;

  // 辅助
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useSetupStore = create<SetupState>()((set, get) => ({
  systemStatus: null,
  isLoading: false,
  error: null,
  currentStep: 0,
  modelConfig: null,
  adminConfig: null,
  featuresConfig: null,

  checkSystemStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await apiClient.get<SystemStatus>('/api/system/status');
      set({ systemStatus: status, isLoading: false });
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查系统状态失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setupModel: (input: SetupModelInput) => {
    set({ modelConfig: input, error: null, currentStep: 2 });
  },

  setupAdmin: (input: SetupAdminInput) => {
    set({ adminConfig: input, error: null, currentStep: 3 });
  },

  setupFeatures: (input: SetupFeaturesInput) => {
    set({ featuresConfig: input, error: null, currentStep: 4 });
  },

  completeSetup: async () => {
    const { modelConfig, adminConfig, featuresConfig } = get();

    if (!modelConfig || !adminConfig || !featuresConfig) {
      set({ error: '配置数据不完整，请返回检查各步骤' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const result = await apiClient.post<AuthResponse | { message: string }>(
        '/api/setup/all',
        {
          model: modelConfig,
          admin: adminConfig,
          features: featuresConfig,
        }
      );

      // 刷新系统状态
      await get().checkSystemStatus();

      set({ isLoading: false });

      // 如果返回了认证信息，说明自动登录成功
      if ('user' in result && 'tokens' in result) {
        return result as AuthResponse;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : '完成初始化失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setCurrentStep: (step: number) => {
    set({ currentStep: step });
  },

  reset: () => {
    set({
      systemStatus: null,
      isLoading: false,
      error: null,
      currentStep: 0,
      modelConfig: null,
      adminConfig: null,
      featuresConfig: null,
    });
  },
}));
